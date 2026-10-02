// Cyber Snake Arcade Engine
class CyberSnakeGame {
    constructor(canvas, onGameOver, onScoreUpdate) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.onGameOver = onGameOver;
        this.onScoreUpdate = onScoreUpdate;
        this.gridSize = 20;
        this.reset();
    }

    reset() {
        this.cols = Math.floor(this.canvas.width / this.gridSize);
        this.rows = Math.floor(this.canvas.height / this.gridSize);

        const startX = Math.floor(this.cols / 2);
        const startY = Math.floor(this.rows / 2);

        this.snake = [
            { x: startX, y: startY },
            { x: startX, y: startY + 1 },
            { x: startX, y: startY + 2 }
        ];

        this.dir = { x: 0, y: -1 };
        this.nextDir = { x: 0, y: -1 };

        this.score = 0;
        this.level = 1;
        this.speed = 110; // ms per step
        this.lastStep = 0;
        this.isGameOver = false;
        this.isPaused = false;

        this.food = this.spawnFood();
        this.specialFood = null;
        this.specialFoodTimer = 0;
        this.particles = [];

        this.onScoreUpdate(this.score, 1, 0, this.level);
    }

    spawnFood() {
        let newFood;
        let collision;
        do {
            collision = false;
            newFood = {
                x: Math.floor(Math.random() * (this.cols - 2)) + 1,
                y: Math.floor(Math.random() * (this.rows - 2)) + 1,
                color: '#00ff88',
                pulse: 0
            };
            for (const segment of this.snake) {
                if (segment.x === newFood.x && segment.y === newFood.y) {
                    collision = true;
                    break;
                }
            }
        } while (collision);
        return newFood;
    }

    spawnSpecialFood() {
        if (this.specialFood || Math.random() > 0.35) return;
        this.specialFood = {
            x: Math.floor(Math.random() * (this.cols - 2)) + 1,
            y: Math.floor(Math.random() * (this.rows - 2)) + 1,
            color: '#ff00aa',
            points: 250,
            life: 200,
            pulse: 0
        };
    }

    createEatParticles(x, y, color) {
        const px = (x + 0.5) * this.gridSize;
        const py = (y + 0.5) * this.gridSize;
        for (let i = 0; i < 16; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 1;
            this.particles.push({
                x: px,
                y: py,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: 0.04,
                color: color,
                size: Math.random() * 3 + 2
            });
        }
    }

    setDirection(dirX, dirY) {
        // Prevent 180 degree reversal
        if (dirX !== 0 && this.dir.x !== 0) return;
        if (dirY !== 0 && this.dir.y !== 0) return;
        this.nextDir = { x: dirX, y: dirY };
    }

    update(controller) {
        if (this.isGameOver || this.isPaused) return;

        // Controller input check
        if (controller.up && this.dir.y === 0) this.nextDir = { x: 0, y: -1 };
        if (controller.down && this.dir.y === 0) this.nextDir = { x: 0, y: 1 };
        if (controller.left && this.dir.x === 0) this.nextDir = { x: -1, y: 0 };
        if (controller.right && this.dir.x === 0) this.nextDir = { x: 1, y: 0 };

        const now = Date.now();
        if (now - this.lastStep >= this.speed) {
            this.step();
            this.lastStep = now;
        }

        // Update Special food timer
        if (this.specialFood) {
            this.specialFood.life--;
            this.specialFood.pulse += 0.1;
            if (this.specialFood.life <= 0) {
                this.specialFood = null;
            }
        } else {
            this.specialFoodTimer++;
            if (this.specialFoodTimer > 150) {
                this.specialFoodTimer = 0;
                this.spawnSpecialFood();
            }
        }

        if (this.food) this.food.pulse += 0.08;

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    step() {
        this.dir = { ...this.nextDir };
        const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };

        // Wall collision
        if (head.x < 0 || head.x >= this.cols || head.y < 0 || head.y >= this.rows) {
            this.triggerGameOver();
            return;
        }

        // Self collision
        for (let i = 0; i < this.snake.length; i++) {
            if (this.snake[i].x === head.x && this.snake[i].y === head.y) {
                this.triggerGameOver();
                return;
            }
        }

        this.snake.unshift(head);

        // Check normal food
        if (head.x === this.food.x && head.y === this.food.y) {
            retroAudio.playScore();
            if (navigator.vibrate) navigator.vibrate(40);
            this.createEatParticles(head.x, head.y, '#00ff88');
            this.score += 50;
            this.food = this.spawnFood();

            // Increase speed slightly every 200 points
            if (this.score % 200 === 0 && this.speed > 55) {
                this.speed -= 5;
                this.level++;
            }
            this.onScoreUpdate(this.score, 1, 0, this.level);
        } else if (this.specialFood && head.x === this.specialFood.x && head.y === this.specialFood.y) {
            // Check special food
            retroAudio.playPowerup();
            if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
            this.createEatParticles(head.x, head.y, '#ff00aa');
            this.score += this.specialFood.points;
            this.specialFood = null;
            this.onScoreUpdate(this.score, 1, 0, this.level);
        } else {
            this.snake.pop();
        }
    }

    triggerGameOver() {
        this.isGameOver = true;
        retroAudio.playGameOver();
        if (navigator.vibrate) navigator.vibrate([100, 80, 150]);
        this.onGameOver(this.score);
    }

    draw() {
        // Clear background with grid pattern
        this.ctx.fillStyle = '#0a0d1d';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle Grid
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Draw Border
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 3;
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 8;
        this.ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
        this.ctx.shadowBlur = 0;

        // Food
        if (this.food) {
            const fx = (this.food.x + 0.5) * this.gridSize;
            const fy = (this.food.y + 0.5) * this.gridSize;
            const scale = 1 + Math.sin(this.food.pulse) * 0.15;

            this.ctx.save();
            this.ctx.translate(fx, fy);
            this.ctx.scale(scale, scale);
            this.ctx.fillStyle = this.food.color;
            this.ctx.shadowColor = this.food.color;
            this.ctx.shadowBlur = 12;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.gridSize * 0.38, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }

        // Special Food
        if (this.specialFood) {
            const sfx = (this.specialFood.x + 0.5) * this.gridSize;
            const sfy = (this.specialFood.y + 0.5) * this.gridSize;
            const scale = 1.1 + Math.sin(this.specialFood.pulse) * 0.2;

            this.ctx.save();
            this.ctx.translate(sfx, sfy);
            this.ctx.scale(scale, scale);
            this.ctx.fillStyle = this.specialFood.color;
            this.ctx.shadowColor = this.specialFood.color;
            this.ctx.shadowBlur = 16;
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.gridSize * 0.44, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 9px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('★', 0, 0);
            this.ctx.restore();
        }

        // Snake Body
        for (let i = this.snake.length - 1; i >= 0; i--) {
            const segment = this.snake[i];
            const sx = segment.x * this.gridSize + 1;
            const sy = segment.y * this.gridSize + 1;
            const size = this.gridSize - 2;

            if (i === 0) {
                // Head
                this.ctx.fillStyle = '#ffffff';
                this.ctx.shadowColor = '#00f0ff';
                this.ctx.shadowBlur = 12;
                this.ctx.fillRect(sx, sy, size, size);
            } else {
                // Body segments with fading gradient
                const alpha = 1.0 - (i / this.snake.length) * 0.45;
                this.ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
                this.ctx.shadowColor = '#00f0ff';
                this.ctx.shadowBlur = 6;
                this.ctx.fillRect(sx, sy, size, size);
            }
        }
        this.ctx.shadowBlur = 0;

        // Particles
        for (const p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
    }
}
