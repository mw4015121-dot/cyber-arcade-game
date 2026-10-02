// Brick Breaker DX Arcade Engine
class BrickBreakerGame {
    constructor(canvas, onGameOver, onScoreUpdate) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onGameOver = onGameOver;
        this.onScoreUpdate = onScoreUpdate;
        this.reset();
    }

    reset() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.isGameOver = false;
        this.isPaused = false;
        this.screenShake = 0;

        // Paddle setup
        this.paddle = {
            width: 80,
            height: 12,
            x: (this.canvas.width - 80) / 2,
            y: this.canvas.height - 40,
            speed: 8,
            laserMode: false,
            laserTimer: 0
        };

        // Balls array (supports multi-ball powerup)
        this.balls = [
            {
                x: this.canvas.width / 2,
                y: this.paddle.y - 10,
                vx: 3.5 * (Math.random() > 0.5 ? 1 : -1),
                vy: -5,
                radius: 6,
                stuck: true
            }
        ];

        this.bricks = [];
        this.powerups = [];
        this.particles = [];
        this.floatingTexts = [];
        this.lasers = [];

        this.initBricks();
        this.onScoreUpdate(this.score, this.lives, 0, this.level);
    }

    initBricks() {
        this.bricks = [];
        const rows = 5 + Math.min(3, this.level);
        const cols = 7;
        const padding = 6;
        const offsetTop = 60;
        const offsetLeft = 14;
        const brickWidth = (this.canvas.width - offsetLeft * 2 - (cols - 1) * padding) / cols;
        const brickHeight = 16;

        const colors = ['#ff0055', '#ffaa00', '#00f0ff', '#00ff88', '#aa00ff', '#ffe600'];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = colors[r % colors.length];
                const isSpecial = Math.random() < 0.15;
                const isExplosive = !isSpecial && Math.random() < 0.08;
                this.bricks.push({
                    x: offsetLeft + c * (brickWidth + padding),
                    y: offsetTop + r * (brickHeight + padding),
                    w: brickWidth,
                    h: brickHeight,
                    color: color,
                    hp: r === 0 ? 2 : 1,
                    maxHp: r === 0 ? 2 : 1,
                    isSpecial: isSpecial,
                    isExplosive: isExplosive
                });
            }
        }
    }

    launchBall() {
        for (const ball of this.balls) {
            if (ball.stuck) {
                ball.stuck = false;
                ball.vy = -5.5;
                ball.vx = (Math.random() - 0.5) * 6;
            }
        }
    }

    createExplosion(x, y, color = '#ff0055', count = 14) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.035,
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

    spawnPowerup(x, y) {
        if (Math.random() > 0.3) return;
        const types = ['multiball', 'wide', 'laser', 'life', 'fireball'];
        const chosen = types[Math.floor(Math.random() * types.length)];
        this.powerups.push({
            x: x,
            y: y,
            type: chosen,
            speedY: 2.0,
            radius: 12,
            pulse: 0
        });
    }

    update(controller) {
        if (this.isGameOver || this.isPaused) return;

        // Screen shake
        if (this.screenShake > 0) this.screenShake *= 0.9;
        if (this.screenShake < 0.2) this.screenShake = 0;

        // Paddle Movement
        if (controller.isTouchActive && controller.touchPos) {
            this.paddle.x = controller.touchPos.x - this.paddle.width / 2;
            this.launchBall();
        } else {
            if (controller.left) this.paddle.x -= this.paddle.speed;
            if (controller.right) this.paddle.x += this.paddle.speed;
            if (controller.action) this.launchBall();
        }

        // Clamp paddle
        this.paddle.x = Math.max(5, Math.min(this.canvas.width - this.paddle.width - 5, this.paddle.x));

        // Update Balls
        for (let i = this.balls.length - 1; i >= 0; i--) {
            const ball = this.balls[i];

            if (ball.stuck) {
                ball.x = this.paddle.x + this.paddle.width / 2;
                ball.y = this.paddle.y - ball.radius;
                continue;
            }

            ball.x += ball.vx;
            ball.y += ball.vy;

            // Wall collisions
            if (ball.x - ball.radius <= 0) {
                ball.x = ball.radius;
                ball.vx = Math.abs(ball.vx);
                retroAudio.playBounce();
            } else if (ball.x + ball.radius >= this.canvas.width) {
                ball.x = this.canvas.width - ball.radius;
                ball.vx = -Math.abs(ball.vx);
                retroAudio.playBounce();
            }

            if (ball.y - ball.radius <= 0) {
                ball.y = ball.radius;
                ball.vy = Math.abs(ball.vy);
                retroAudio.playBounce();
            }

            // Paddle Collision
            if (
                ball.y + ball.radius >= this.paddle.y &&
                ball.y - ball.radius <= this.paddle.y + this.paddle.height &&
                ball.x >= this.paddle.x - 4 &&
                ball.x <= this.paddle.x + this.paddle.width + 4 &&
                ball.vy > 0
            ) {
                retroAudio.playBounce();
                const hitPos = (ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
                ball.vx = hitPos * 6;
                ball.vy = -Math.max(4, Math.sqrt(Math.max(16, 40 - ball.vx * ball.vx)));
                ball.y = this.paddle.y - ball.radius;
            }

            // Brick Collisions
            for (let j = this.bricks.length - 1; j >= 0; j--) {
                const b = this.bricks[j];
                if (
                    ball.x + ball.radius >= b.x &&
                    ball.x - ball.radius <= b.x + b.w &&
                    ball.y + ball.radius >= b.y &&
                    ball.y - ball.radius <= b.y + b.h
                ) {
                    retroAudio.playHit();
                    b.hp--;
                    ball.vy = -ball.vy;

                    if (b.hp <= 0) {
                        retroAudio.playExplosion();
                        this.createExplosion(b.x + b.w / 2, b.y + b.h / 2, b.color, 12);
                        this.spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
                        this.score += 60 * this.level;
                        this.addFloatingText('+60', b.x + b.w / 2, b.y);

                        // If explosive, damage adjacent bricks
                        if (b.isExplosive) {
                            this.explodeBricksAround(b.x + b.w / 2, b.y + b.h / 2);
                        }

                        this.bricks.splice(j, 1);
                        this.onScoreUpdate(this.score, this.lives, 0, this.level);
                    }
                    break;
                }
            }

            // Ball drops off bottom
            if (ball.y > this.canvas.height + 20) {
                this.balls.splice(i, 1);
            }
        }

        // Check Ball loss
        if (this.balls.length === 0) {
            this.lives--;
            retroAudio.playHit();
            this.screenShake = 12;
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            this.onScoreUpdate(this.score, this.lives, 0, this.level);

            if (this.lives <= 0) {
                this.isGameOver = true;
                retroAudio.playGameOver();
                this.onGameOver(this.score);
            } else {
                this.balls.push({
                    x: this.canvas.width / 2,
                    y: this.paddle.y - 10,
                    vx: 3,
                    vy: -5,
                    radius: 6,
                    stuck: true
                });
            }
        }

        // Level Clear Check
        if (this.bricks.length === 0) {
            this.level++;
            retroAudio.playPowerup();
            this.addFloatingText('LEVEL COMPLETE! LEVEL ' + this.level, this.canvas.width / 2, this.canvas.height / 2, '#00ff88');
            this.initBricks();
            this.balls = [
                {
                    x: this.canvas.width / 2,
                    y: this.paddle.y - 10,
                    vx: 3.5,
                    vy: -5.5,
                    radius: 6,
                    stuck: true
                }
            ];
            this.onScoreUpdate(this.score, this.lives, 0, this.level);
        }

        // Update Powerups
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const p = this.powerups[i];
            p.y += p.speedY;
            p.pulse += 0.08;

            if (
                p.y + p.radius >= this.paddle.y &&
                p.y - p.radius <= this.paddle.y + this.paddle.height &&
                p.x >= this.paddle.x &&
                p.x <= this.paddle.x + this.paddle.width
            ) {
                this.collectPowerup(p);
                this.powerups.splice(i, 1);
                continue;
            }

            if (p.y > this.canvas.height + 20) {
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

    explodeBricksAround(cx, cy) {
        this.screenShake = 15;
        this.createExplosion(cx, cy, '#ff3300', 30);
        for (let i = this.bricks.length - 1; i >= 0; i--) {
            const b = this.bricks[i];
            const dist = Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
            if (dist < 60) {
                this.createExplosion(b.x + b.w / 2, b.y + b.h / 2, b.color, 10);
                this.score += 60;
                this.bricks.splice(i, 1);
            }
        }
    }

    collectPowerup(p) {
        retroAudio.playPowerup();
        if (navigator.vibrate) navigator.vibrate(50);

        switch (p.type) {
            case 'multiball':
                const baseBall = this.balls[0] || { x: this.paddle.x, y: this.paddle.y - 10 };
                this.balls.push({ x: baseBall.x, y: baseBall.y, vx: -4, vy: -5, radius: 6, stuck: false });
                this.balls.push({ x: baseBall.x, y: baseBall.y, vx: 4, vy: -5, radius: 6, stuck: false });
                this.addFloatingText('MULTI-BALL!', this.paddle.x, this.paddle.y - 20, '#00ff88');
                break;
            case 'wide':
                this.paddle.width = 120;
                setTimeout(() => { this.paddle.width = 80; }, 10000);
                this.addFloatingText('WIDE PADDLE!', this.paddle.x, this.paddle.y - 20, '#00f0ff');
                break;
            case 'life':
                this.lives = Math.min(5, this.lives + 1);
                this.addFloatingText('+1 EXTRA LIFE!', this.paddle.x, this.paddle.y - 20, '#33ff33');
                break;
            case 'laser':
            case 'fireball':
                this.score += 200;
                this.addFloatingText('+200 BONUS!', this.paddle.x, this.paddle.y - 20, '#ffe600');
                break;
        }
        this.score += 50;
        this.onScoreUpdate(this.score, this.lives, 0, this.level);
    }

    draw() {
        this.ctx.save();

        if (this.screenShake > 0) {
            const shakeX = (Math.random() - 0.5) * this.screenShake;
            const shakeY = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(shakeX, shakeY);
        }

        // Background
        this.ctx.fillStyle = '#0a0d1e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Bricks
        for (const b of this.bricks) {
            this.ctx.fillStyle = b.color;
            this.ctx.shadowColor = b.color;
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(b.x, b.y, b.w, b.h);

            // Inner highlight
            this.ctx.fillStyle = 'rgba(255,255,255,0.25)';
            this.ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, 3);

            if (b.isExplosive) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 10px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('💣', b.x + b.w / 2, b.y + b.h / 2);
            }
        }
        this.ctx.shadowBlur = 0;

        // Paddle
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 12;
        this.ctx.beginPath();
        this.ctx.roundRect(this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, [6, 6, 2, 2]);
        this.ctx.fill();

        // Balls
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#00ffaa';
        this.ctx.shadowBlur = 10;
        for (const ball of this.balls) {
            this.ctx.beginPath();
            this.ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.shadowBlur = 0;

        // Powerups
        for (const p of this.powerups) {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            const scale = 1 + Math.sin(p.pulse) * 0.15;
            this.ctx.scale(scale, scale);
            this.ctx.fillStyle = '#ff00aa';
            this.ctx.shadowColor = '#ff00aa';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 9px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(p.type === 'multiball' ? '3X' : '★', 0, 0);
            this.ctx.restore();
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

        // Floating texts
        for (const ft of this.floatingTexts) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.globalAlpha = ft.alpha;
            this.ctx.font = 'bold 14px "Press Start 2P", monospace, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
        }
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }
}
