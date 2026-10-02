// Galaxy Strike - Space Shooter Arcade Engine
class SpaceShooterGame {
    constructor(canvas, onGameOver, onScoreUpdate) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onGameOver = onGameOver;
        this.onScoreUpdate = onScoreUpdate;
        this.reset();
    }

    reset() {
        this.score = 0;
        this.wave = 1;
        this.lives = 3;
        this.bombs = 2;
        this.isGameOver = false;
        this.isPaused = false;
        this.screenShake = 0;

        // Player setup
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 80,
            width: 36,
            height: 42,
            speed: 6,
            shield: 0,
            weaponType: 'single', // 'single', 'triple', 'spread', 'laser'
            weaponTimer: 0,
            lastShot: 0,
            fireRate: 150, // ms
            invulnerable: 120 // frames
        };

        // Entities
        this.bullets = [];
        this.enemyBullets = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.floatingTexts = [];
        this.stars = [];

        // Spawn timer
        this.enemySpawnTimer = 0;
        this.bossActive = false;
        this.boss = null;

        // Starfield
        this.initStars();

        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);
        }
    }

    initStars() {
        this.stars = [];
        for (let i = 0; i < 60; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 2.2 + 0.6,
                speed: Math.random() * 2.5 + 0.5,
                color: Math.random() > 0.3 ? '#ffffff' : '#00f0ff'
            });
        }
    }

    triggerBomb() {
        if (this.bombs <= 0 || this.isGameOver || this.isPaused) return;
        this.bombs--;
        this.screenShake = 20;
        retroAudio.playExplosion();

        // Clear all enemies and bullets
        for (const enemy of this.enemies) {
            this.createExplosion(enemy.x, enemy.y, 25, '#ff0055');
            this.score += enemy.points || 50;
        }
        this.enemies = [];
        this.enemyBullets = [];

        if (this.boss) {
            this.boss.hp -= 80;
            this.createExplosion(this.boss.x, this.boss.y, 40, '#ffaa00');
            if (this.boss.hp <= 0) {
                this.defeatBoss();
            }
        }

        this.addFloatingText('BOMB CLEARED!', this.canvas.width / 2, this.canvas.height / 2, '#ff0055');
        this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);
    }

    spawnPowerup(x, y) {
        if (Math.random() > 0.28) return; // 28% drop rate
        const types = ['triple', 'spread', 'laser', 'shield', 'bomb', 'life'];
        const weights = [0.3, 0.25, 0.15, 0.15, 0.1, 0.05];
        let rand = Math.random();
        let chosen = types[0];
        let cumulative = 0;
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (rand <= cumulative) {
                chosen = types[i];
                break;
            }
        }

        this.powerups.push({
            x: x,
            y: y,
            type: chosen,
            speedY: 1.8,
            radius: 14,
            pulse: 0
        });
    }

    createExplosion(x, y, count = 15, color = '#ff0055') {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 1;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.04 + 0.02,
                color: color,
                size: Math.random() * 3 + 2
            });
        }
    }

    addFloatingText(text, x, y, color = '#00f0ff') {
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            alpha: 1.0,
            vy: -1.2
        });
    }

    update(controller) {
        if (this.isGameOver || this.isPaused) return;

        // Screen shake decay
        if (this.screenShake > 0) this.screenShake *= 0.9;
        if (this.screenShake < 0.2) this.screenShake = 0;

        // Player invulnerability timer
        if (this.player.invulnerable > 0) this.player.invulnerable--;

        // Weapon timer decay
        if (this.player.weaponTimer > 0) {
            this.player.weaponTimer--;
            if (this.player.weaponTimer <= 0) {
                this.player.weaponType = 'single';
            }
        }

        // Starfield update
        for (const star of this.stars) {
            star.y += star.speed;
            if (star.y > this.canvas.height) {
                star.y = 0;
                star.x = Math.random() * this.canvas.width;
            }
        }

        // Player Movement Controls
        if (controller.isTouchActive && controller.touchPos) {
            const dx = controller.touchPos.x - this.player.x;
            const dy = (controller.touchPos.y - 45) - this.player.y;
            this.player.x += dx * 0.25;
            this.player.y += dy * 0.25;
        } else {
            if (controller.left) this.player.x -= this.player.speed;
            if (controller.right) this.player.x += this.player.speed;
            if (controller.up) this.player.y -= this.player.speed;
            if (controller.down) this.player.y += this.player.speed;
        }

        // Clamp player inside screen
        this.player.x = Math.max(20, Math.min(this.canvas.width - 20, this.player.x));
        this.player.y = Math.max(50, Math.min(this.canvas.height - 30, this.player.y));

        // Player Auto-Firing
        const now = Date.now();
        if (now - this.player.lastShot > this.player.fireRate) {
            this.firePlayerWeapon();
            this.player.lastShot = now;
        }

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx;
            b.y += b.vy;
            if (b.y < -20 || b.x < -20 || b.x > this.canvas.width + 20) {
                this.bullets.splice(i, 1);
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const eb = this.enemyBullets[i];
            eb.x += eb.vx;
            eb.y += eb.vy;

            // Collision with player
            if (this.player.invulnerable <= 0) {
                const dist = Math.hypot(eb.x - this.player.x, eb.y - this.player.y);
                if (dist < 18) {
                    this.enemyBullets.splice(i, 1);
                    this.hitPlayer();
                    continue;
                }
            }

            if (eb.y > this.canvas.height + 20 || eb.x < -20 || eb.x > this.canvas.width + 20) {
                this.enemyBullets.splice(i, 1);
            }
        }

        // Spawn Enemies
        this.enemySpawnTimer++;
        if (!this.bossActive && this.enemySpawnTimer % Math.max(35, 90 - this.wave * 8) === 0) {
            this.spawnEnemyWave();
        }

        // Spawn Boss when reaching wave milestone
        if (!this.bossActive && this.score > this.wave * 1200) {
            this.spawnBoss();
        }

        // Update Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(this);

            // Bullet vs Enemy collision
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
                if (dist < enemy.radius + b.radius) {
                    enemy.hp -= b.damage;
                    this.createExplosion(b.x, b.y, 4, '#00f0ff');
                    this.bullets.splice(j, 1);

                    if (enemy.hp <= 0) {
                        retroAudio.playExplosion();
                        this.createExplosion(enemy.x, enemy.y, 16, enemy.color);
                        this.spawnPowerup(enemy.x, enemy.y);
                        this.score += enemy.points;
                        this.addFloatingText('+' + enemy.points, enemy.x, enemy.y);
                        this.enemies.splice(i, 1);
                        this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);
                        break;
                    }
                }
            }

            // Enemy vs Player collision
            if (this.player.invulnerable <= 0 && this.enemies[i]) {
                const dist = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);
                if (dist < enemy.radius + 15) {
                    this.hitPlayer();
                    enemy.hp -= 5;
                    if (enemy.hp <= 0) {
                        this.createExplosion(enemy.x, enemy.y, 14, enemy.color);
                        this.enemies.splice(i, 1);
                    }
                }
            }

            if (enemy.y > this.canvas.height + 40) {
                this.enemies.splice(i, 1);
            }
        }

        // Update Boss
        if (this.bossActive && this.boss) {
            this.boss.update(this);

            // Bullets vs Boss
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                const dist = Math.hypot(b.x - this.boss.x, b.y - this.boss.y);
                if (dist < this.boss.radius + b.radius) {
                    this.boss.hp -= b.damage;
                    this.createExplosion(b.x, b.y, 4, '#ffff00');
                    this.bullets.splice(j, 1);

                    if (this.boss.hp <= 0) {
                        this.defeatBoss();
                        break;
                    }
                }
            }
        }

        // Update Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.speedY;
            p.pulse += 0.08;

            const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
            if (dist < p.radius + 20) {
                this.collectPowerup(p);
                this.powerups.splice(i, 1);
                continue;
            }

            if (p.y > this.canvas.height + 30) {
                this.powerups.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const part = this.particles[i];
            part.x += part.vx;
            part.y += part.vy;
            part.life -= part.decay;
            if (part.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy;
            ft.alpha -= 0.02;
            if (ft.alpha <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    firePlayerWeapon() {
        retroAudio.playLaser();
        const px = this.player.x;
        const py = this.player.y - 20;

        switch (this.player.weaponType) {
            case 'single':
                this.bullets.push({ x: px, y: py, vx: 0, vy: -12, radius: 4, damage: 1, color: '#00f0ff' });
                break;
            case 'triple':
                this.bullets.push({ x: px - 8, y: py, vx: 0, vy: -12, radius: 4, damage: 1, color: '#00ff88' });
                this.bullets.push({ x: px + 8, y: py, vx: 0, vy: -12, radius: 4, damage: 1, color: '#00ff88' });
                this.bullets.push({ x: px, y: py - 4, vx: 0, vy: -13, radius: 5, damage: 1.5, color: '#00ff88' });
                break;
            case 'spread':
                this.bullets.push({ x: px, y: py, vx: 0, vy: -12, radius: 4, damage: 1.2, color: '#ff00aa' });
                this.bullets.push({ x: px, y: py, vx: -3, vy: -11, radius: 4, damage: 1.2, color: '#ff00aa' });
                this.bullets.push({ x: px, y: py, vx: 3, vy: -11, radius: 4, damage: 1.2, color: '#ff00aa' });
                this.bullets.push({ x: px, y: py, vx: -5, vy: -10, radius: 3, damage: 1.0, color: '#ff00aa' });
                this.bullets.push({ x: px, y: py, vx: 5, vy: -10, radius: 3, damage: 1.0, color: '#ff00aa' });
                break;
            case 'laser':
                this.bullets.push({ x: px, y: py, vx: 0, vy: -16, radius: 6, damage: 3.5, color: '#ffe600' });
                break;
        }
    }

    collectPowerup(powerup) {
        retroAudio.playPowerup();
        if (navigator.vibrate) navigator.vibrate(50);

        switch (powerup.type) {
            case 'triple':
                this.player.weaponType = 'triple';
                this.player.weaponTimer = 450;
                this.addFloatingText('TRIPLE CANNON!', this.player.x, this.player.y, '#00ff88');
                break;
            case 'spread':
                this.player.weaponType = 'spread';
                this.player.weaponTimer = 400;
                this.addFloatingText('SPREAD SHOT!', this.player.x, this.player.y, '#ff00aa');
                break;
            case 'laser':
                this.player.weaponType = 'laser';
                this.player.weaponTimer = 350;
                this.addFloatingText('HYPER LASER!', this.player.x, this.player.y, '#ffe600');
                break;
            case 'shield':
                this.player.shield = 2;
                this.addFloatingText('PLASMA SHIELD!', this.player.x, this.player.y, '#00f0ff');
                break;
            case 'bomb':
                this.bombs = Math.min(5, this.bombs + 1);
                this.addFloatingText('+1 BOMB!', this.player.x, this.player.y, '#ff3300');
                break;
            case 'life':
                this.lives = Math.min(5, this.lives + 1);
                this.addFloatingText('+1 EXTRA LIFE!', this.player.x, this.player.y, '#33ff33');
                break;
        }

        this.score += 100;
        this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);
    }

    hitPlayer() {
        if (this.player.shield > 0) {
            this.player.shield--;
            retroAudio.playHit();
            this.screenShake = 10;
            this.addFloatingText('SHIELD BLOCKED!', this.player.x, this.player.y, '#00f0ff');
            return;
        }

        this.lives--;
        this.screenShake = 18;
        this.player.invulnerable = 90;
        retroAudio.playExplosion();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        this.createExplosion(this.player.x, this.player.y, 25, '#ff3300');
        this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);

        if (this.lives <= 0) {
            this.isGameOver = true;
            retroAudio.playGameOver();
            this.onGameOver(this.score);
        }
    }

    spawnEnemyWave() {
        const types = ['drone', 'fighter', 'zigzag', 'cruiser'];
        const chosen = types[Math.floor(Math.random() * Math.min(types.length, 2 + Math.floor(this.wave / 2)))];

        if (chosen === 'drone') {
            const count = 3 + Math.floor(Math.random() * 3);
            const startX = 40 + Math.random() * (this.canvas.width - 120);
            for (let i = 0; i < count; i++) {
                this.enemies.push(new Enemy(startX + i * 28, -30 - i * 25, 'drone', this.wave));
            }
        } else if (chosen === 'fighter') {
            const x = 50 + Math.random() * (this.canvas.width - 100);
            this.enemies.push(new Enemy(x, -40, 'fighter', this.wave));
        } else if (chosen === 'zigzag') {
            const x = 60 + Math.random() * (this.canvas.width - 120);
            this.enemies.push(new Enemy(x, -40, 'zigzag', this.wave));
        } else if (chosen === 'cruiser') {
            const x = 80 + Math.random() * (this.canvas.width - 160);
            this.enemies.push(new Enemy(x, -60, 'cruiser', this.wave));
        }
    }

    spawnBoss() {
        this.bossActive = true;
        this.boss = new BossEnemy(this.canvas.width / 2, -80, this.wave);
        this.addFloatingText('WARNING: BOSS INCOMING!', this.canvas.width / 2, 100, '#ff0033');
    }

    defeatBoss() {
        retroAudio.playExplosion();
        this.createExplosion(this.boss.x, this.boss.y, 50, '#ffaa00');
        this.createExplosion(this.boss.x - 30, this.boss.y - 20, 30, '#ff0055');
        this.createExplosion(this.boss.x + 30, this.boss.y + 20, 30, '#00ffff');
        this.score += 1500 * this.wave;
        this.wave++;
        this.bossActive = false;
        this.boss = null;
        this.addFloatingText('SECTOR CLEARED! WAVE ' + this.wave, this.canvas.width / 2, this.canvas.height / 2, '#00ff88');
        this.onScoreUpdate(this.score, this.lives, this.bombs, this.wave);
    }

    draw() {
        this.ctx.save();

        // Screen Shake
        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(shakeX, shakeY);
        }

        // Background
        this.ctx.fillStyle = '#060814';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Stars
        for (const star of this.stars) {
            this.ctx.fillStyle = star.color;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Particles
        for (const part of this.particles) {
            this.ctx.fillStyle = part.color;
            this.ctx.globalAlpha = part.life;
            this.ctx.beginPath();
            this.ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Player Bullets
        for (const b of this.bullets) {
            this.ctx.fillStyle = b.color;
            this.ctx.shadowColor = b.color;
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.shadowBlur = 0;

        // Enemy Bullets
        for (const eb of this.enemyBullets) {
            this.ctx.fillStyle = '#ff2a2a';
            this.ctx.shadowColor = '#ff0055';
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.arc(eb.x, eb.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.shadowBlur = 0;

        // Powerups
        for (const p of this.powerups) {
            this.drawPowerup(p);
        }

        // Enemies
        for (const enemy of this.enemies) {
            enemy.draw(this.ctx);
        }

        // Boss
        if (this.bossActive && this.boss) {
            this.boss.draw(this.ctx);
        }

        // Player Ship
        if (this.player.invulnerable <= 0 || Math.floor(Date.now() / 80) % 2 === 0) {
            this.drawPlayerShip();
        }

        // Floating Texts
        for (const ft of this.floatingTexts) {
            this.ctx.fillStyle = ft.text.includes('WARNING') ? '#ff0055' : '#00ffff';
            this.ctx.globalAlpha = ft.alpha;
            this.ctx.font = 'bold 16px "Press Start 2P", monospace, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
        }
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }

    drawPlayerShip() {
        const px = this.player.x;
        const py = this.player.y;

        this.ctx.save();
        this.ctx.translate(px, py);

        // Ship Thruster Engine Glow
        const flameHeight = 12 + Math.random() * 8;
        this.ctx.fillStyle = '#ff9900';
        this.ctx.shadowColor = '#ff3300';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.moveTo(-6, 18);
        this.ctx.lineTo(0, 18 + flameHeight);
        this.ctx.lineTo(6, 18);
        this.ctx.fill();

        // Ship Hull
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#0df';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -22);
        this.ctx.lineTo(16, 16);
        this.ctx.lineTo(6, 12);
        this.ctx.lineTo(-6, 12);
        this.ctx.lineTo(-16, 16);
        this.ctx.closePath();
        this.ctx.fill();

        // Cockpit
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -10);
        this.ctx.lineTo(4, 2);
        this.ctx.lineTo(-4, 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Shield Aura
        if (this.player.shield > 0) {
            this.ctx.strokeStyle = '#00f0ff';
            this.ctx.lineWidth = 2.5;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 26, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    drawPowerup(p) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        const scale = 1 + Math.sin(p.pulse) * 0.15;
        this.ctx.scale(scale, scale);

        let color = '#00ff88';
        let label = 'P';
        if (p.type === 'triple') { color = '#00ff88'; label = '3X'; }
        else if (p.type === 'spread') { color = '#ff00aa'; label = 'SP'; }
        else if (p.type === 'laser') { color = '#ffe600'; label = 'LZ'; }
        else if (p.type === 'shield') { color = '#00f0ff'; label = 'SH'; }
        else if (p.type === 'bomb') { color = '#ff3300'; label = '💣'; }
        else if (p.type === 'life') { color = '#33ff33'; label = '❤️'; }

        this.ctx.fillStyle = color;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(label, 0, 1);

        this.ctx.restore();
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, type, wave) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.wave = wave;
        this.shootTimer = Math.random() * 60;

        switch (type) {
            case 'drone':
                this.hp = 1;
                this.points = 100;
                this.radius = 12;
                this.color = '#ff3366';
                this.vy = 2.2 + wave * 0.2;
                this.vx = 0;
                break;
            case 'fighter':
                this.hp = 2 + Math.floor(wave * 0.5);
                this.points = 200;
                this.radius = 16;
                this.color = '#ffaa00';
                this.vy = 1.8;
                this.vx = (Math.random() - 0.5) * 2;
                break;
            case 'zigzag':
                this.hp = 2;
                this.points = 250;
                this.radius = 14;
                this.color = '#aa00ff';
                this.vy = 1.5;
                this.vx = 2.5;
                this.freq = 0.05;
                this.timer = 0;
                break;
            case 'cruiser':
                this.hp = 8 + wave;
                this.points = 500;
                this.radius = 24;
                this.color = '#00ffcc';
                this.vy = 0.8;
                this.vx = 0.5;
                break;
        }
    }

    update(game) {
        this.y += this.vy;
        this.x += this.vx;

        if (this.type === 'zigzag') {
            this.timer++;
            this.x += Math.sin(this.timer * this.freq) * 4;
        }

        if (this.type === 'cruiser') {
            if (this.x < 40 || this.x > game.canvas.width - 40) {
                this.vx *= -1;
            }
        }

        // Enemy shooting
        this.shootTimer++;
        if (this.type === 'fighter' && this.shootTimer > 90) {
            this.shootTimer = 0;
            game.enemyBullets.push({ x: this.x, y: this.y + 10, vx: 0, vy: 4.5 });
        } else if (this.type === 'cruiser' && this.shootTimer > 80) {
            this.shootTimer = 0;
            game.enemyBullets.push({ x: this.x - 12, y: this.y + 15, vx: -1.2, vy: 4 });
            game.enemyBullets.push({ x: this.x + 12, y: this.y + 15, vx: 1.2, vy: 4 });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;

        if (this.type === 'drone') {
            ctx.beginPath();
            ctx.moveTo(0, 12);
            ctx.lineTo(-10, -10);
            ctx.lineTo(10, -10);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'fighter') {
            ctx.beginPath();
            ctx.moveTo(0, 16);
            ctx.lineTo(-14, -8);
            ctx.lineTo(0, -4);
            ctx.lineTo(14, -8);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'zigzag') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'cruiser') {
            ctx.beginPath();
            ctx.moveTo(0, 24);
            ctx.lineTo(-22, -16);
            ctx.lineTo(-8, -22);
            ctx.lineTo(8, -22);
            ctx.lineTo(22, -16);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }
}

// Boss Class
class BossEnemy {
    constructor(x, y, wave) {
        this.x = x;
        this.y = y;
        this.targetY = 90;
        this.maxHp = 60 + wave * 30;
        this.hp = this.maxHp;
        this.radius = 42;
        this.vx = 2.2;
        this.attackTimer = 0;
        this.wave = wave;
    }

    update(game) {
        if (this.y < this.targetY) {
            this.y += 1.5;
        } else {
            this.x += this.vx;
            if (this.x < 60 || this.x > game.canvas.width - 60) {
                this.vx *= -1;
            }

            this.attackTimer++;
            if (this.attackTimer % 45 === 0) {
                // Triple bullet spread
                game.enemyBullets.push({ x: this.x, y: this.y + 35, vx: 0, vy: 4.8 });
                game.enemyBullets.push({ x: this.x - 20, y: this.y + 30, vx: -1.8, vy: 4.2 });
                game.enemyBullets.push({ x: this.x + 20, y: this.y + 30, vx: 1.8, vy: 4.2 });
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Boss Body
        ctx.fillStyle = '#ff0055';
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.moveTo(0, 40);
        ctx.lineTo(-45, -20);
        ctx.lineTo(-20, -40);
        ctx.lineTo(20, -40);
        ctx.lineTo(45, -20);
        ctx.closePath();
        ctx.fill();

        // Boss Core
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Health Bar
        const barWidth = 80;
        const healthPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = '#333';
        ctx.fillRect(-barWidth / 2, -55, barWidth, 6);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(-barWidth / 2, -55, barWidth * healthPercent, 6);

        ctx.restore();
    }
}
