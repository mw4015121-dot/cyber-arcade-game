// Main Arcade Game Hub Controller
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const hudScore = document.getElementById('hud-score');
    const hudHigh = document.getElementById('hud-high');
    const hudLives = document.getElementById('hud-lives');
    const hudWave = document.getElementById('hud-wave');
    const hudWaveLabel = document.getElementById('hud-wave-label');
    const bombCountSpan = document.getElementById('bomb-count');
    const btnBomb = document.getElementById('btn-bomb');

    const gameoverModal = document.getElementById('gameover-modal');
    const pauseModal = document.getElementById('pause-modal');
    const finalScoreSpan = document.getElementById('final-score');
    const bestScoreSpan = document.getElementById('best-score');

    const btnSound = document.getElementById('btn-sound');
    const btnPause = document.getElementById('btn-pause');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const btnRestart = document.getElementById('btn-restart');
    const btnResume = document.getElementById('btn-resume');
    const btnPauseRestart = document.getElementById('btn-pause-restart');
    const btnSwitchGame = document.getElementById('btn-switch-game');

    const tabButtons = document.querySelectorAll('.tab-btn');

    // D-Pad buttons
    const btnDpadUp = document.getElementById('btn-dpad-up');
    const btnDpadDown = document.getElementById('btn-dpad-down');
    const btnDpadLeft = document.getElementById('btn-dpad-left');
    const btnDpadRight = document.getElementById('btn-dpad-right');

    let currentGameType = 'space'; // 'space', 'snake', 'brick'
    let activeGame = null;
    let animationFrameId = null;

    // Controller Input State
    const controller = {
        left: false,
        right: false,
        up: false,
        down: false,
        action: false,
        isTouchActive: false,
        touchPos: null
    };

    // Load High Scores from Storage
    function getHighScore(gameType) {
        return parseInt(localStorage.getItem('arcade_high_' + gameType) || '0', 10);
    }

    function saveHighScore(gameType, score) {
        const currentHigh = getHighScore(gameType);
        if (score > currentHigh) {
            localStorage.setItem('arcade_high_' + gameType, score.toString());
            return score;
        }
        return currentHigh;
    }

    // Score Update Callback
    function onScoreUpdate(score, lives, bombs = 0, wave = 1) {
        hudScore.textContent = score.toString().padStart(5, '0');
        const high = Math.max(score, getHighScore(currentGameType));
        hudHigh.textContent = high.toString().padStart(5, '0');

        // Update lives
        if (currentGameType === 'snake') {
            hudLives.textContent = '🐍';
            hudWaveLabel.textContent = 'LVL';
        } else {
            let hearts = '';
            for (let i = 0; i < lives; i++) hearts += '❤️';
            hudLives.textContent = hearts || '💀';
            hudWaveLabel.textContent = currentGameType === 'brick' ? 'LVL' : 'WAVE';
        }

        hudWave.textContent = wave;
        bombCountSpan.textContent = bombs;
    }

    // Game Over Callback
    function onGameOver(finalScore) {
        const best = saveHighScore(currentGameType, finalScore);
        finalScoreSpan.textContent = finalScore;
        bestScoreSpan.textContent = best;
        gameoverModal.classList.remove('hidden');
    }

    // Switch and Initialize Game
    function switchGame(type) {
        currentGameType = type;

        // Update UI Tabs
        tabButtons.forEach(btn => {
            if (btn.dataset.game === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Hide modals
        gameoverModal.classList.add('hidden');
        pauseModal.classList.add('hidden');

        // Reset Bomb button visibility
        if (type === 'space') {
            btnBomb.style.display = 'flex';
        } else {
            btnBomb.style.display = 'none';
        }

        // Initialize instance
        if (type === 'space') {
            activeGame = new SpaceShooterGame(canvas, onGameOver, onScoreUpdate);
        } else if (type === 'snake') {
            activeGame = new CyberSnakeGame(canvas, onGameOver, onScoreUpdate);
        } else if (type === 'brick') {
            activeGame = new BrickBreakerGame(canvas, onGameOver, onScoreUpdate);
        }

        hudHigh.textContent = getHighScore(type).toString().padStart(5, '0');
    }

    // Main Game Loop
    function gameLoop() {
        if (activeGame) {
            activeGame.update(controller);
            activeGame.draw();
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // Canvas Touch Coordinate Helper
    function getCanvasCoords(touch) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (touch.clientX - rect.left) * scaleX,
            y: (touch.clientY - rect.top) * scaleY
        };
    }

    // Touch Events on Canvas (Direct Touch / Drag / Swipe)
    let touchStartX = 0;
    let touchStartY = 0;

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        retroAudio.init();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            controller.isTouchActive = true;
            controller.touchPos = getCanvasCoords(touch);
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            controller.action = true;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            controller.touchPos = getCanvasCoords(touch);

            // Swipe detection for Snake
            if (currentGameType === 'snake') {
                const diffX = touch.clientX - touchStartX;
                const diffY = touch.clientY - touchStartY;
                if (Math.abs(diffX) > 25 || Math.abs(diffY) > 25) {
                    if (Math.abs(diffX) > Math.abs(diffY)) {
                        if (diffX > 0) activeGame.setDirection(1, 0);
                        else activeGame.setDirection(-1, 0);
                    } else {
                        if (diffY > 0) activeGame.setDirection(0, 1);
                        else activeGame.setDirection(0, -1);
                    }
                    touchStartX = touch.clientX;
                    touchStartY = touch.clientY;
                }
            }
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        controller.isTouchActive = false;
        controller.touchPos = null;
        controller.action = false;
    }, { passive: false });

    // Mouse Controls (for desktop testing)
    let isMouseDown = false;
    canvas.addEventListener('mousedown', (e) => {
        retroAudio.init();
        isMouseDown = true;
        controller.isTouchActive = true;
        const rect = canvas.getBoundingClientRect();
        controller.touchPos = {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
        controller.action = true;
    });

    window.addEventListener('mousemove', (e) => {
        if (isMouseDown) {
            const rect = canvas.getBoundingClientRect();
            controller.touchPos = {
                x: (e.clientX - rect.left) * (canvas.width / rect.width),
                y: (e.clientY - rect.top) * (canvas.height / rect.height)
            };
        }
    });

    window.addEventListener('mouseup', () => {
        isMouseDown = false;
        controller.isTouchActive = false;
        controller.touchPos = null;
        controller.action = false;
    });

    // D-Pad Button Handlers (Touch & Click)
    function setupButtonInput(element, onDown, onUp) {
        const handleStart = (e) => {
            e.preventDefault();
            retroAudio.init();
            onDown();
        };
        const handleEnd = (e) => {
            e.preventDefault();
            onUp();
        };

        element.addEventListener('touchstart', handleStart, { passive: false });
        element.addEventListener('touchend', handleEnd, { passive: false });
        element.addEventListener('mousedown', handleStart);
        element.addEventListener('mouseup', handleEnd);
        element.addEventListener('mouseleave', handleEnd);
    }

    setupButtonInput(btnDpadUp, () => {
        controller.up = true;
        if (currentGameType === 'snake' && activeGame) activeGame.setDirection(0, -1);
    }, () => { controller.up = false; });

    setupButtonInput(btnDpadDown, () => {
        controller.down = true;
        if (currentGameType === 'snake' && activeGame) activeGame.setDirection(0, 1);
    }, () => { controller.down = false; });

    setupButtonInput(btnDpadLeft, () => {
        controller.left = true;
        if (currentGameType === 'snake' && activeGame) activeGame.setDirection(-1, 0);
    }, () => { controller.left = false; });

    setupButtonInput(btnDpadRight, () => {
        controller.right = true;
        if (currentGameType === 'snake' && activeGame) activeGame.setDirection(1, 0);
    }, () => { controller.right = false; });

    // Bomb Button
    btnBomb.addEventListener('click', (e) => {
        e.preventDefault();
        if (currentGameType === 'space' && activeGame) {
            activeGame.triggerBomb();
        }
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
        retroAudio.init();
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            controller.up = true;
            if (currentGameType === 'snake' && activeGame) activeGame.setDirection(0, -1);
        }
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            controller.down = true;
            if (currentGameType === 'snake' && activeGame) activeGame.setDirection(0, 1);
        }
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            controller.left = true;
            if (currentGameType === 'snake' && activeGame) activeGame.setDirection(-1, 0);
        }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            controller.right = true;
            if (currentGameType === 'snake' && activeGame) activeGame.setDirection(1, 0);
        }
        if (e.key === ' ' || e.key === 'b' || e.key === 'B') {
            controller.action = true;
            if (currentGameType === 'space' && activeGame) activeGame.triggerBomb();
        }
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') controller.up = false;
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') controller.down = false;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') controller.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') controller.right = false;
        if (e.key === ' ' || e.key === 'b' || e.key === 'B') controller.action = false;
    });

    // Tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            switchGame(btn.dataset.game);
        });
    });

    // Sound Toggle
    btnSound.addEventListener('click', () => {
        const enabled = retroAudio.toggle();
        btnSound.textContent = enabled ? '🔊' : '🔇';
    });

    // Pause Toggle
    function togglePause() {
        if (!activeGame || activeGame.isGameOver) return;
        activeGame.isPaused = !activeGame.isPaused;
        if (activeGame.isPaused) {
            pauseModal.classList.remove('hidden');
        } else {
            pauseModal.classList.add('hidden');
        }
    }

    btnPause.addEventListener('click', togglePause);
    btnResume.addEventListener('click', () => {
        if (activeGame) activeGame.isPaused = false;
        pauseModal.classList.add('hidden');
    });

    // Fullscreen Toggle
    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // Restart Handlers
    btnRestart.addEventListener('click', () => {
        switchGame(currentGameType);
    });

    btnPauseRestart.addEventListener('click', () => {
        switchGame(currentGameType);
    });

    btnSwitchGame.addEventListener('click', () => {
        gameoverModal.classList.add('hidden');
    });

    // Start initial game
    switchGame('space');
    gameLoop();
});
