/* ==========================================================================
   Game Logic for Flappy Canarinho
   HTML5 Canvas + Mobile Touch Support + Auth + Wallet & Betting Dashboard + Desktop Admin Portal
   ========================================================================== */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- Game Constants & Config ---
const GAME_WIDTH = 540;
const GAME_HEIGHT = 720;

const GRAVITY = 980 * 1.4; // 1372 px/s^2
const FLAP_FORCE = -425;
const SPAWN_INTERVAL = 1.8; // seconds
const PIPE_WIDTH = 98;

// --- State Machine ---
const GameState = {
    READY: 'READY',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER'
};
let currentState = GameState.READY;

// --- Game Variables ---
let scrollSpeed = 150;
let score = 0; // Pipes count
let highScore = 0; // Loaded per user (Highest payout)
let spawnTimer = 0;
let pipes = [];
let coinEffects = [];
let lastTime = 0;

// --- User Wallet & Dashboard Variables ---
let currentUser = null;
let userBalance = 0;
let transactions = [];
let matches = [];
let userWagered = 0;
let userRollover = 0;
let currentDepositAmount = 0;

// --- Betting System Variables ---
let currentBet = 0;
let matchEarnings = 0;

// --- Admin Control Settings ---
let globalRTP = 100;
let gapHeightSetting = 180;
let scrollSpeedSetting = 150;
let pipePayoutPercentSetting = 20;

let activeAdminTab = 'dashboard';
let activeAdminSubtab = 'txs';
let editingUserPhone = '';

// --- Audio Synthesizer (Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playCoinSound() {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const now = audioCtx.currentTime;
        
        // Tone 1: B5
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Tone 2: E6 (delayed by 80ms)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318.51, now + 0.08);
        gain2.gain.setValueAtTime(0.08, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.3);
    } catch (err) {
        console.warn("Audio playback context was not initialized:", err);
    }
}

// --- Dynamic conversion tracking Pixels (Facebook & TikTok) ---
function injectTrackingPixels() {
    const fbId = localStorage.getItem('flappy_pixel_facebook_id');
    const ttId = localStorage.getItem('flappy_pixel_tiktok_id');

    // 1. Meta (Facebook) Pixel Injection
    if (fbId && !window.fbq) {
        try {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', fbId.trim());
            fbq('track', 'PageView');
            console.log(`Facebook Pixel (${fbId}) injected successfully.`);
        } catch (e) {
            console.error("Error loading Meta Pixel script:", e);
        }
    }

    // 2. TikTok Pixel Injection
    if (ttId && !window.ttq) {
        try {
            !function (w, d, t) {
                w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndGet=function(t,e){return function(){var n=t[e];return n}};for(var i=0;i<ttq.methods.length;i++)ttq[i]=ttq.setAndGet(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq[t]||[],n=0;n<ttq.methods.length;n++)e[ttq[name]]=ttq.setAndGet(e,ttq.methods[n]);return e},ttq.load=function(e,n){var o="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=o,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var a=d.createElement("script");a.type="text/javascript",a.async=!0,a.src=o;var c=d.getElementsByTagName("script")[0];c.parentNode.insertBefore(a,c)};
                ttq.load(ttId.trim());
                ttq.page();
                console.log(`TikTok Pixel (${ttId}) injected successfully.`);
            }(window, document, 'ttq');
        } catch (e) {
            console.error("Error loading TikTok Pixel script:", e);
        }
    }
}

// Call on startup
injectTrackingPixels();

// --- Helper Functions ---
function formatCurrency(value) {
    return `R$ ${parseFloat(value).toFixed(2)}`.replace('.', ',');
}

function getCurrentDateString() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// --- User Database & Session Management ---
function getRegisteredUsers() {
    return JSON.parse(localStorage.getItem('flappy_registered_users') || '[]');
}

function saveRegisteredUsers(users) {
    localStorage.setItem('flappy_registered_users', JSON.stringify(users));
}

function checkActiveSession() {
    const session = localStorage.getItem('flappy_active_session');
    if (session) {
        currentUser = JSON.parse(session);
        if (currentUser.role === 'admin') {
            showAdminPanel();
            return true;
        }
        loadUserData();
        showGameUI();
        setGameState(GameState.READY);
        return true;
    }
    showAuthScreen('login');
    return false;
}

function loadUserData() {
    if (!currentUser) return;
    const phone = currentUser.phone;
    
    // Load high score
    highScore = parseFloat(localStorage.getItem(`flappy_high_score_val_${phone}`) || '0.00');
    
    // Load wallet balance
    userBalance = parseFloat(localStorage.getItem(`flappy_balance_${phone}`) || '0.00');
    
    // Load transaction history
    transactions = JSON.parse(localStorage.getItem(`flappy_transactions_${phone}`) || '[]');
    
    // Load match history
    matches = JSON.parse(localStorage.getItem(`flappy_matches_${phone}`) || '[]');

    // Load wager and rollover states
    userWagered = parseFloat(localStorage.getItem(`flappy_wagered_${phone}`) || '0.00');
    userRollover = parseFloat(localStorage.getItem(`flappy_rollover_${phone}`) || '0.00');

    // Refresh dynamic settings from Admin
    globalRTP = parseFloat(localStorage.getItem('flappy_rtp') || '100');
    gapHeightSetting = parseInt(localStorage.getItem('flappy_difficulty_gap') || '180');
    scrollSpeedSetting = parseInt(localStorage.getItem('flappy_difficulty_speed') || '150');
    pipePayoutPercentSetting = parseFloat(localStorage.getItem('flappy_pipe_payout_pct') || '20');

    injectTrackingPixels();
}

function saveUserData() {
    if (!currentUser) return;
    const phone = currentUser.phone;
    
    localStorage.setItem(`flappy_balance_${phone}`, userBalance.toFixed(2));
    localStorage.setItem(`flappy_transactions_${phone}`, JSON.stringify(transactions));
    localStorage.setItem(`flappy_matches_${phone}`, JSON.stringify(matches));
    localStorage.setItem(`flappy_wagered_${phone}`, userWagered.toFixed(2));
    localStorage.setItem(`flappy_rollover_${phone}`, userRollover.toFixed(2));
}

function showAuthScreen(screen) {
    document.getElementById('game-container').classList.remove('hidden');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('register-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('game-score').classList.add('hidden');
    document.getElementById('deposit-modal').classList.add('hidden');
    document.getElementById('withdraw-modal').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('admin-balance-modal').classList.add('hidden');
    
    if (screen === 'login') {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('login-error').classList.add('hidden');
        document.getElementById('login-form').reset();
    } else if (screen === 'register') {
        document.getElementById('register-screen').classList.remove('hidden');
        document.getElementById('reg-error').classList.add('hidden');
        document.getElementById('register-form').reset();
    }
}

function showGameUI() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('register-screen').classList.add('hidden');
    document.getElementById('admin-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    
    if (currentUser) {
        document.getElementById('lobby-user-greeting').textContent = `Olá, ${currentUser.name.split(' ')[0]}!`;
        updateHeaderBalance();
        renderDashboardTab('play');
    }
}

function updateHeaderBalance() {
    document.getElementById('lobby-balance-header').textContent = `Saldo: ${formatCurrency(userBalance)}`;
}

// --- Asset Loader ---
const images = {
    background: new Image(),
    birdFlap: new Image(),
    birdFall: new Image(),
    pipe: new Image()
};

images.background.src = './godot-flappy-canarinho-master/assets/Main/mountains-bg.jpg';
images.birdFlap.src = './godot-flappy-canarinho-master/assets/Bird/bird-1.png';
images.birdFall.src = './godot-flappy-canarinho-master/assets/Bird/bird-2.png';
images.pipe.src = './godot-flappy-canarinho-master/assets/Pipe/pipe.png';

let assetsLoaded = 0;
const totalAssets = 4;
function onAssetLoad() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
        requestAnimationFrame(gameLoop);
        checkActiveSession();
    }
}

// Register event listeners before triggering the download
for (const key in images) {
    images[key].onload = onAssetLoad;
    images[key].onerror = () => {
        console.error("Failed to load image asset:", key);
        onAssetLoad(); // Fallback to avoid hanging game load
    };
}

// --- Parallax Background Class ---
class ParallaxBackground {
    constructor() {
        this.x = 0;
    }

    update(dt) {
        if (currentState === GameState.PLAYING) {
            this.x -= scrollSpeed * dt;
            if (this.x <= -800) {
                this.x += 800;
            }
        }
    }

    draw() {
        const imgWidth = 800;
        const imgHeight = 720;
        
        ctx.drawImage(images.background, this.x, 0, imgWidth, imgHeight);
        ctx.drawImage(images.background, this.x + imgWidth, 0, imgWidth, imgHeight);
    }
}
const background = new ParallaxBackground();

// --- Bird Class ---
class Bird {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 120;
        this.y = 360;
        this.velocityY = 0;
        this.flapTimer = 0;
        this.bobTimer = 0;
        this.radius = 24;
    }

    flap() {
        if (currentState === GameState.PLAYING) {
            this.velocityY = FLAP_FORCE;
            this.flapTimer = 0.25; // Play flap animation for 0.25s
        }
    }

    update(dt) {
        // Dynamic collision size adjustment based on influencer settings
        if (currentUser && currentUser.influencer) {
            const infCollision = localStorage.getItem('flappy_inf_collision') || 'LENIENT';
            if (infCollision === 'GODMODE') {
                this.radius = 0;
            } else if (infCollision === 'LENIENT') {
                this.radius = 12;
            } else {
                this.radius = 24;
            }
        } else {
            this.radius = 24;
        }

        if (currentState === GameState.PLAYING) {
            // Apply gravity
            this.velocityY += GRAVITY * dt;
            this.y += this.velocityY * dt;

            // Update flap timer
            if (this.flapTimer > 0) {
                this.flapTimer -= dt;
            }

            // Check ground collision
            if (this.y > GAME_HEIGHT - this.radius) {
                this.y = GAME_HEIGHT - this.radius;
                triggerGameOver();
            }

            // Clamp top boundary
            if (this.y < this.radius) {
                this.y = this.radius;
                this.velocityY = 0;
            }
        } else if (currentState === GameState.READY) {
            // Hover bobbing animation in Lobby
            this.bobTimer += dt * 5;
            this.y = 360 + Math.sin(this.bobTimer) * 12;
        } else if (currentState === GameState.GAME_OVER) {
            // Fall to ground on game over
            if (this.y < GAME_HEIGHT - this.radius) {
                this.velocityY += GRAVITY * dt;
                this.y += this.velocityY * dt;
            } else {
                this.y = GAME_HEIGHT - this.radius;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Rotation based on velocity
        let rotation = 0;
        if (currentState === GameState.PLAYING || currentState === GameState.GAME_OVER) {
            rotation = Math.max(-0.4, Math.min(0.5, this.velocityY / 800));
        }
        ctx.rotate(rotation);

        // Choose sprite based on animation state
        const img = (this.flapTimer > 0) ? images.birdFlap : images.birdFall;
        
        ctx.scale(-1, 1);
        ctx.drawImage(img, -24, -24, 48, 48); // Render at default 24px visual size always
        ctx.restore();
    }
}
const bird = new Bird();

// --- Pipe Class ---
class Pipe {
    constructor() {
        this.x = GAME_WIDTH + 60;
        const godotYRand = Math.floor(Math.random() * (600 - 250 + 1)) + 250;
        this.gapCenterY = godotYRand - 36;
        
        this.width = PIPE_WIDTH;
        this.passed = false;
        
        // Dynamic pipe gap and speed depending on role
        if (currentUser && currentUser.influencer) {
            this.gap = parseInt(localStorage.getItem('flappy_inf_gap') || '220');
            scrollSpeed = parseInt(localStorage.getItem('flappy_inf_speed') || '140');
        } else {
            this.gap = gapHeightSetting;
            scrollSpeed = scrollSpeedSetting;
        }
    }

    update(dt) {
        this.x -= scrollSpeed * dt;
    }

    draw() {
        const topPipeHeight = this.gapCenterY - this.gap / 2;
        const bottomPipeY = this.gapCenterY + this.gap / 2;
        const bottomPipeHeight = GAME_HEIGHT - bottomPipeY;

        // Top Pipe
        ctx.save();
        ctx.translate(this.x + this.width / 2, topPipeHeight);
        ctx.scale(1, -1);
        ctx.drawImage(images.pipe, -this.width / 2, 0, this.width, topPipeHeight);
        ctx.restore();

        // Bottom Pipe
        ctx.drawImage(images.pipe, this.x, bottomPipeY, this.width, bottomPipeHeight);
    }

    checkCollision(birdObj) {
        // Godmode check
        if (currentUser && currentUser.influencer) {
            const infCollision = localStorage.getItem('flappy_inf_collision') || 'LENIENT';
            if (infCollision === 'GODMODE') return false; // Immortal!
        }

        const topCollided = checkCircleRectCollision(
            birdObj.x, birdObj.y, birdObj.radius,
            this.x, 0, this.width, this.gapCenterY - this.gap / 2
        );

        const bottomCollided = checkCircleRectCollision(
            birdObj.x, birdObj.y, birdObj.radius,
            this.x, this.gapCenterY + this.gap / 2, this.width, GAME_HEIGHT - (this.gapCenterY + this.gap / 2)
        );

        return topCollided || bottomCollided;
    }
}

// --- Floating Coin Score Effect ---
class CoinEffect {
    constructor(x, y, amount) {
        this.x = x;
        this.y = y;
        this.velocityY = -180;
        this.alpha = 1.0;
        this.scale = 1.0;
        this.amount = amount;
    }

    update(dt) {
        this.y += this.velocityY * dt;
        this.alpha -= dt * 1.6;
        this.scale += dt * 0.3;
    }

    draw() {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        
        // Draw golden circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, 14 * this.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd60a';
        ctx.shadowColor = 'rgba(255, 214, 10, 0.6)';
        ctx.shadowBlur = 8;
        ctx.fill();
        
        ctx.strokeStyle = '#ff9f1c';
        ctx.lineWidth = 2 * this.scale;
        ctx.stroke();

        ctx.font = `bold ${14 * this.scale}px "Outfit"`;
        ctx.fillStyle = '#ff9f1c';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', this.x, this.y);

        // Draw floating "+R$ X,00" value next to it
        ctx.font = `bold ${16 * this.scale}px "Outfit"`;
        ctx.fillStyle = '#4dff4d';
        ctx.textAlign = 'left';
        ctx.fillText(`+${formatCurrency(this.amount)}`, this.x + 20 * this.scale, this.y);
        
        ctx.restore();
    }
}

// --- Helper Functions for Collisions ---
function checkCircleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
    if (radius === 0) return false;
    let closestX = Math.max(rx, Math.min(cx, rx + rw));
    let closestY = Math.max(ry, Math.min(cy, ry + rh));

    let distanceX = cx - closestX;
    let distanceY = cy - closestY;

    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (radius * radius);
}

// --- Game State Flow Functions ---
function setGameState(newState) {
    if (!currentUser && newState !== GameState.READY) {
        showAuthScreen('login');
        return;
    }

    currentState = newState;
    
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const scoreHUD = document.getElementById('game-score');

    if (currentState === GameState.READY) {
        lobbyScreen.classList.remove('hidden');
        gameoverScreen.classList.add('hidden');
        scoreHUD.classList.add('hidden');
        
        document.getElementById('lobby-high-score').textContent = formatCurrency(highScore);
        
        bird.reset();
        pipes = [];
        coinEffects = [];
        
        // Start scroll speed depending on role
        if (currentUser && currentUser.influencer) {
            scrollSpeed = parseInt(localStorage.getItem('flappy_inf_speed') || '140');
        } else {
            scrollSpeed = scrollSpeedSetting;
        }
        
        // Show play intro by default, hide bet sub-view
        document.getElementById('play-intro-view').classList.remove('hidden-view');
        document.getElementById('play-bet-view').classList.add('hidden-view');
        
        // Update payout info label dynamically
        const pipePct = parseFloat(localStorage.getItem('flappy_pipe_payout_pct') || '20');
        document.getElementById('bet-payout-desc').textContent = `${pipePct}% da aposta`;

        updateHeaderBalance();
        renderDashboardTab('play');
    } else if (currentState === GameState.PLAYING) {
        lobbyScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');
        scoreHUD.classList.remove('hidden');
        scoreHUD.textContent = formatCurrency(0);
        
        score = 0;
        spawnTimer = 0;
    } else if (currentState === GameState.GAME_OVER) {
        lobbyScreen.classList.add('hidden');
        gameoverScreen.classList.remove('hidden');
        scoreHUD.classList.add('hidden');

        // 1. Process match earnings and add back to wallet balance
        const currentDate = getCurrentDateString();
        if (matchEarnings > 0) {
            userBalance += matchEarnings;
            // Log earning to transactions history
            transactions.unshift({
                type: 'earning',
                amount: matchEarnings,
                date: currentDate,
                description: `Retorno Aposta (Cano x${score})`
            });
        }

        // 2. Add match attempt log to match history
        matches.unshift({
            score: score,
            bet: currentBet,
            payout: matchEarnings,
            date: currentDate
        });

        // 3. Keep logs lists capped
        if (matches.length > 20) matches.pop();
        if (transactions.length > 30) transactions.pop();

        // 4. Scored high record validation (based on earnings payout)
        let newRecord = false;
        if (matchEarnings > highScore) {
            highScore = matchEarnings;
            localStorage.setItem(`flappy_high_score_val_${currentUser.phone}`, highScore.toFixed(2));
            newRecord = true;
        }

        // 5. Persist wallet state
        saveUserData();

        document.getElementById('final-score').textContent = formatCurrency(matchEarnings);
        document.getElementById('gameover-high-score').textContent = formatCurrency(highScore);

        const recordMsg = document.getElementById('new-record-message');
        if (newRecord) {
            recordMsg.classList.add('show');
        } else {
            recordMsg.classList.remove('show');
        }

        // Reset bet session variables
        currentBet = 0;
        matchEarnings = 0;
    }
}

function triggerGameOver() {
    if (currentState === GameState.PLAYING) {
        setGameState(GameState.GAME_OVER);
    }
}

function spawnPipe() {
    pipes.push(new Pipe());
}

// --- Main Game Loop ---
const FIXED_DT = 1 / 60;
let accumulator = 0;

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (dt > 0.1) dt = 0.1;

    accumulator += dt;

    while (accumulator >= FIXED_DT) {
        update(FIXED_DT);
        accumulator -= FIXED_DT;
    }

    draw();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    background.update(dt);
    bird.update(dt);

    if (currentState === GameState.PLAYING) {
        spawnTimer += dt;
        if (spawnTimer >= SPAWN_INTERVAL) {
            spawnPipe();
            spawnTimer = 0;
        }

        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.update(dt);

            if (pipe.checkCollision(bird)) {
                triggerGameOver();
            }

            if (!pipe.passed && bird.x > pipe.x + pipe.width) {
                pipe.passed = true;
                score++;
                
                // Calculate Payout: custom payout % of the bet amount per pipe * global RTP multiplier
                const rtpMult = globalRTP / 100;
                const basePct = pipePayoutPercentSetting / 100;
                const pipePayout = parseFloat(((currentBet * basePct) * rtpMult).toFixed(2));
                matchEarnings += pipePayout;
                
                document.getElementById('game-score').textContent = formatCurrency(matchEarnings);
                
                playCoinSound();
                coinEffects.push(new CoinEffect(bird.x + 35, bird.y, pipePayout));
                
                if (score % 5 === 0) {
                    scrollSpeed += 10.0;
                }
            }

            if (pipe.x < -pipe.width) {
                pipes.splice(i, 1);
            }
        }
    }

    for (let i = coinEffects.length - 1; i >= 0; i--) {
        const effect = coinEffects[i];
        effect.update(dt);
        if (effect.alpha <= 0) {
            coinEffects.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    background.draw();
    pipes.forEach(pipe => pipe.draw());
    coinEffects.forEach(effect => effect.draw());
    bird.draw();
}

// --- Input & Touch Listeners ---
function handleInteraction(e) {
    if (!currentUser) return; // Ignore controls if auth screen is shown

    // Prevent default touch behaviors unless interacting with form controls, buttons or inputs
    if (e.type === 'touchstart') {
        if (e.target.closest('button') || e.target.closest('form') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input')) return;
        e.preventDefault();
    }

    initAudio();

    if (currentState === GameState.PLAYING) {
        bird.flap();
    }
}

window.addEventListener('keydown', (e) => {
    if (!currentUser || currentUser.role === 'admin') return;

    if (e.code === 'Space') {
        e.preventDefault();
        initAudio();
        if (currentState === GameState.PLAYING) {
            bird.flap();
        } else if (currentState === GameState.READY) {
            // Only start if active tab is 'play' and we are NOT on the bet selection screen
            const activeTab = document.querySelector('.tab-nav-item.active').dataset.tab;
            const isBetSelectionVisible = !document.getElementById('play-bet-view').classList.contains('hidden-view');
            if (activeTab === 'play' && !isBetSelectionVisible) {
                // Show bet selection screen
                document.getElementById('play-intro-view').classList.add('hidden-view');
                document.getElementById('play-bet-view').classList.remove('hidden-view');
            }
        } else if (currentState === GameState.GAME_OVER) {
            setGameState(GameState.READY);
        }
    }
});

canvas.addEventListener('mousedown', handleInteraction);
canvas.addEventListener('touchstart', handleInteraction, { passive: false });

// --- Button Click Listeners (Gameplay) ---
document.getElementById('start-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    
    // Transition to Bet Selection sub-view
    document.getElementById('play-intro-view').classList.add('hidden-view');
    document.getElementById('play-bet-view').classList.remove('hidden-view');
    document.getElementById('bet-error-msg').classList.add('hidden');
    document.getElementById('custom-bet-amount').value = '';
    document.querySelectorAll('.btn-bet-select').forEach(b => b.classList.remove('active'));
    currentBet = 0;
});

document.getElementById('restart-button').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    setGameState(GameState.READY);
});

// --- Betting System Click Listeners ---

// Quick bet selection buttons
document.querySelectorAll('.btn-bet-select').forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        
        document.querySelectorAll('.btn-bet-select').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        
        const val = button.dataset.val;
        document.getElementById('custom-bet-amount').value = val;
        currentBet = parseFloat(val);
        document.getElementById('bet-error-msg').classList.add('hidden');
    });
});

// Custom bet input event
document.getElementById('custom-bet-amount').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    currentBet = isNaN(val) ? 0 : val;
    document.getElementById('bet-error-msg').classList.add('hidden');

    document.querySelectorAll('.btn-bet-select').forEach(b => {
        if (parseFloat(b.dataset.val) === val) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
});

// Cancel bet selection
document.getElementById('btn-cancel-bet').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    
    document.getElementById('play-bet-view').classList.add('hidden-view');
    document.getElementById('play-intro-view').classList.remove('hidden-view');
});

// Confirm Bet & Start Game Flight
document.getElementById('btn-confirm-bet').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    const errorBox = document.getElementById('bet-error-msg');
    errorBox.classList.add('hidden');

    if (isNaN(currentBet) || currentBet < 1) {
        showError(errorBox, "A aposta mínima é de R$ 1,00!");
        return;
    }

    if (currentBet > userBalance) {
        showError(errorBox, "Saldo insuficiente! Faça um depósito na aba Carteira.");
        return;
    }

    // Deduct bet from balance
    userBalance -= currentBet;
    
    // Increment total wagers
    userWagered += currentBet;

    // Log transaction
    transactions.unshift({
        type: 'withdraw',
        amount: currentBet,
        date: getCurrentDateString(),
        description: `Aposta Iniciada (R$ ${currentBet.toFixed(2)})`
    });

    saveUserData();
    updateHeaderBalance();
    
    // Start game
    setGameState(GameState.PLAYING);
});

// --- Dashboard Tabs Navigation Logic ---
const tabs = ['play', 'wallet', 'profile', 'history'];

tabs.forEach(tabName => {
    document.getElementById(`tab-btn-${tabName}`).addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        renderDashboardTab(tabName);
    });
});

function renderDashboardTab(activeTab) {
    tabs.forEach(tabName => {
        const btn = document.getElementById(`tab-btn-${tabName}`);
        const panel = document.getElementById(`tab-content-${tabName}`);
        
        if (tabName === activeTab) {
            btn.classList.add('active');
            panel.classList.remove('hidden');
            panel.classList.add('active');
        } else {
            btn.classList.remove('active');
            panel.classList.add('hidden');
            panel.classList.remove('active');
        }
    });

    if (activeTab === 'wallet') {
        renderWalletTab();
    } else if (activeTab === 'profile') {
        renderProfileTab();
    } else if (activeTab === 'history') {
        renderHistoryTab();
    }
}

function renderWalletTab() {
    document.getElementById('wallet-balance-amount').textContent = formatCurrency(userBalance);
    updateHeaderBalance();

    // Render rollover information
    const rolloverBox = document.getElementById('wallet-rollover-box');
    if (userRollover > 0) {
        rolloverBox.classList.remove('hidden');
        const progressPct = Math.min(100, Math.floor((userWagered / userRollover) * 100));
        document.getElementById('wallet-rollover-progress').textContent = `${formatCurrency(userWagered)} / ${formatCurrency(userRollover)} (${progressPct}%)`;
    } else {
        rolloverBox.classList.add('hidden');
    }

    const listElement = document.getElementById('transaction-history-list');
    listElement.innerHTML = '';

    if (transactions.length === 0) {
        listElement.innerHTML = '<li class="empty-log">Nenhuma transação registrada.</li>';
        return;
    }

    transactions.forEach(tx => {
        const li = document.createElement('li');
        
        let typeSymbol = '💸';
        let amountClass = 'positive';
        let typeLabel = '';

        if (tx.type === 'deposit') {
            typeSymbol = '📥';
            amountClass = 'positive';
            typeLabel = tx.description || 'Depósito PIX';
        } else if (tx.type === 'withdraw') {
            typeSymbol = '📤';
            amountClass = 'negative';
            typeLabel = tx.description || 'Saque Realizado';
        } else if (tx.type === 'earning') {
            typeSymbol = '🎮';
            amountClass = 'positive';
            typeLabel = tx.description || 'Ganhos da Partida';
        }

        const sign = (amountClass === 'positive' && tx.type !== 'deposit') ? '+' : '';
        const displaySign = tx.type === 'withdraw' ? '-' : sign;

        li.innerHTML = `
            <div class="log-info">
                <span class="log-title">${typeSymbol} ${typeLabel}</span>
                <span class="log-date">${tx.date}</span>
            </div>
            <span class="log-amount ${amountClass}">${displaySign}${formatCurrency(tx.amount)}</span>
        `;
        listElement.appendChild(li);
    });
}

function renderProfileTab() {
    if (!currentUser) return;

    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-phone').textContent = currentUser.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    document.getElementById('profile-ref-code').textContent = currentUser.refCode || 'Nenhum';
    
    document.getElementById('profile-stat-matches').textContent = matches.length;
    
    // Calculate total career earnings
    const totalEarnings = transactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('profile-stat-earnings').textContent = formatCurrency(totalEarnings);
}

function renderProfileTab() {
    if (!currentUser) return;

    document.getElementById('profile-name').textContent = currentUser.name;
    document.getElementById('profile-phone').textContent = currentUser.phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    document.getElementById('profile-ref-code').textContent = currentUser.refCode || 'Nenhum';
    
    document.getElementById('profile-stat-matches').textContent = matches.length;
    
    // Calculate total career earnings
    const totalEarnings = transactions
        .filter(t => t.type === 'earning')
        .reduce((sum, t) => sum + t.amount, 0);

    document.getElementById('profile-stat-earnings').textContent = formatCurrency(totalEarnings);
}

function renderHistoryTab() {
    const listElement = document.getElementById('match-history-list');
    listElement.innerHTML = '';

    if (matches.length === 0) {
        listElement.innerHTML = '<li class="empty-log">Nenhuma partida jogada ainda.</li>';
        return;
    }

    matches.forEach((game, index) => {
        const li = document.createElement('li');
        
        li.innerHTML = `
            <div class="log-info">
                <span class="log-title">Voo #${matches.length - index} (Aposta: ${formatCurrency(game.bet || 0)})</span>
                <span class="log-date">${game.date}</span>
            </div>
            <div class="log-info" style="align-items: flex-end;">
                <span class="log-amount positive">+${formatCurrency(game.payout || 0)}</span>
                <span style="font-size: 10px; color: var(--text-muted);">Canos: ${game.score || 0}</span>
            </div>
        `;
        listElement.appendChild(li);
    });
}

// --- Wallet Deposit & Withdrawal Modals Logic ---

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (show) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

// DEPOSIT MODAL EVENT LISTENERS
document.getElementById('btn-open-deposit').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    
    document.getElementById('deposit-form').reset();
    document.getElementById('pix-sim-area').classList.add('hidden');
    document.getElementById('deposit-pix-loader').classList.add('hidden');
    document.getElementById('deposit-form').classList.remove('hidden');
    document.getElementById('deposit-error').classList.add('hidden');
    document.querySelectorAll('.btn-amount-select').forEach(b => b.classList.remove('active'));
    currentDepositAmount = 0;

    // Load min deposit limit
    const minDep = parseFloat(localStorage.getItem('flappy_min_deposit') || '10.00');
    document.getElementById('deposit-limits-desc').textContent = `Mínimo de depósito: ${formatCurrency(minDep)}`;

    toggleModal('deposit-modal', true);
});

document.getElementById('btn-close-deposit').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleModal('deposit-modal', false);
});

document.querySelectorAll('.btn-amount-select').forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        
        document.querySelectorAll('.btn-amount-select').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        
        const value = button.dataset.val;
        document.getElementById('dep-custom-amount').value = value;
        currentDepositAmount = parseFloat(value);
        document.getElementById('deposit-error').classList.add('hidden');
    });
});

document.getElementById('dep-custom-amount').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    currentDepositAmount = isNaN(val) ? 0 : val;
    document.getElementById('deposit-error').classList.add('hidden');
    
    document.querySelectorAll('.btn-amount-select').forEach(b => {
        if (parseFloat(b.dataset.val) === val) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
});

document.getElementById('deposit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();

    const minDep = parseFloat(localStorage.getItem('flappy_min_deposit') || '10.00');
    const errorBox = document.getElementById('deposit-error');
    errorBox.classList.add('hidden');

    if (currentDepositAmount < minDep) {
        showError(errorBox, `O valor mínimo para depósito é de ${formatCurrency(minDep)}!`);
        return;
    }

    // Hide deposit form fields and show VizzionPay loader animation to simulate server latency
    document.getElementById('deposit-form').classList.add('hidden');
    const loader = document.getElementById('deposit-pix-loader');
    loader.classList.remove('hidden');

    // Simulate VizzionPay API POST call latency
    setTimeout(() => {
        loader.classList.add('hidden');
        document.getElementById('pix-sim-area').classList.remove('hidden');

        // Incorporate VizzionPay Keys in mock payload
        const pubKey = localStorage.getItem('flappy_gateway_pubkey') || 'MOCK_PUBKEY';
        const simulatedKey = `00020126580014BR.GOV.BCB.PIX0136vizzionpay-uuid-gateway-${pubKey.substring(0, 8)}-${currentDepositAmount.toFixed(2)}5802BR5920FlappyCanarinhoInc6009SaoPaulo62070503***6304ED2F`;
        document.getElementById('pix-key-text').value = simulatedKey;
    }, 1200);
});

document.getElementById('btn-copy-pix').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    const textarea = document.getElementById('pix-key-text');
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    try {
        navigator.clipboard.writeText(textarea.value);
        alert("Chave Copia e Cola PIX copiada!");
    } catch (err) {
        document.execCommand('copy');
        alert("Chave Copia e Cola PIX copiada!");
    }
});

document.getElementById('btn-confirm-deposit').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    if (currentDepositAmount <= 0) return;

    // Calculate Deposit Bonus based on Tier levels configured by Admin
    let bonusPct = 0;
    const t1_val = parseFloat(localStorage.getItem('flappy_tier_1_val') || '20.00');
    const t1_pct = parseFloat(localStorage.getItem('flappy_tier_1_pct') || '0');
    const t2_val = parseFloat(localStorage.getItem('flappy_tier_2_val') || '50.00');
    const t2_pct = parseFloat(localStorage.getItem('flappy_tier_2_pct') || '0');
    const t3_val = parseFloat(localStorage.getItem('flappy_tier_3_val') || '100.00');
    const t3_pct = parseFloat(localStorage.getItem('flappy_tier_3_pct') || '0');

    if (currentDepositAmount >= t3_val) {
        bonusPct = t3_pct;
    } else if (currentDepositAmount >= t2_val) {
        bonusPct = t2_pct;
    } else if (currentDepositAmount >= t1_val) {
        bonusPct = t1_pct;
    }

    const bonusAmount = parseFloat((currentDepositAmount * (bonusPct / 100)).toFixed(2));
    const totalCredited = currentDepositAmount + bonusAmount;

    // Add to wallet balance
    userBalance += totalCredited;
    
    // Add to rollover requirements: total credited * Rollover multiplier
    const rolloverMult = parseInt(localStorage.getItem('flappy_rollover_mult') || '0');
    const rolloverAdded = totalCredited * rolloverMult;
    userRollover += rolloverAdded;

    const currentDate = getCurrentDateString();
    
    // Log user transaction
    transactions.unshift({
        type: 'deposit',
        amount: totalCredited,
        date: currentDate,
        description: `Depósito PIX` + (bonusPct > 0 ? ` (+${bonusPct}% Faixa Bônus)` : '')
    });

    // Log globally for Admin audits
    const globalDeps = JSON.parse(localStorage.getItem('flappy_global_deposits') || '[]');
    globalDeps.unshift({
        phone: currentUser.phone,
        name: currentUser.name,
        amount: currentDepositAmount,
        bonus: bonusAmount,
        date: currentDate,
        status: 'completed'
    });
    localStorage.setItem('flappy_global_deposits', JSON.stringify(globalDeps));

    saveUserData();
    updateHeaderBalance();

    // Trigger Facebook & TikTok Purchase Conversion Pixels
    if (window.fbq) {
        fbq('track', 'Purchase', { value: currentDepositAmount, currency: 'BRL' });
    }
    if (window.ttq) {
        ttq.track('Purchase', { value: currentDepositAmount, currency: 'BRL' });
    }

    alert(`Depósito de ${formatCurrency(currentDepositAmount)} confirmado! ` + (bonusPct > 0 ? `Bônus de ${formatCurrency(bonusAmount)} adicionado!` : ''));
    
    toggleModal('deposit-modal', false);
    renderWalletTab();
});

// WITHDRAWAL MODAL EVENT LISTENERS
document.getElementById('btn-open-withdraw').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    
    document.getElementById('withdraw-form').reset();
    document.getElementById('withdraw-error').classList.add('hidden');
    
    // Load limits
    const minWith = parseFloat(localStorage.getItem('flappy_min_withdraw') || '20.00');
    document.getElementById('withdraw-limits-desc').textContent = `Mínimo de saque: ${formatCurrency(minWith)}`;

    toggleModal('withdraw-modal', true);
});

document.getElementById('btn-close-withdraw').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleModal('withdraw-modal', false);
});

document.getElementById('withdraw-form').addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();

    const amount = parseFloat(document.getElementById('with-amount').value);
    const keyType = document.getElementById('with-key-type').value;
    const keyValue = document.getElementById('with-key-value').value.trim();
    const errorBox = document.getElementById('withdraw-error');

    errorBox.classList.add('hidden');

    if (isNaN(amount) || amount <= 0) {
        showError(errorBox, "Insira um valor de saque válido!");
        return;
    }

    // 1. Check minimum limit
    const minWith = parseFloat(localStorage.getItem('flappy_min_withdraw') || '20.00');
    if (amount < minWith) {
        showError(errorBox, `O valor mínimo para saque é de ${formatCurrency(minWith)}!`);
        return;
    }

    // 2. Check user balance
    if (amount > userBalance) {
        showError(errorBox, "Saldo insuficiente para realizar este saque!");
        return;
    }

    // 3. Check Rollover Requirement
    if (userWagered < userRollover) {
        const remaining = userRollover - userWagered;
        showError(errorBox, `Rollover pendente! Você precisa apostar mais ${formatCurrency(remaining)} antes de poder sacar.`);
        return;
    }

    if (!keyType || !keyValue) {
        showError(errorBox, "Preencha todos os campos do PIX!");
        return;
    }

    // Deduct user balance
    userBalance -= amount;
    const currentDate = getCurrentDateString();

    // Log pending transaction to user history
    transactions.unshift({
        type: 'withdraw',
        amount: amount,
        date: currentDate,
        description: `Saque Solicitado (PIX ${keyType})`
    });

    // Log withdrawal globally for Admin Audit approvals
    const globalWithdraws = JSON.parse(localStorage.getItem('flappy_global_withdrawals') || '[]');
    globalWithdraws.unshift({
        id: Date.now().toString(),
        phone: currentUser.phone,
        name: currentUser.name,
        amount: amount,
        date: currentDate,
        keyType: keyType,
        keyValue: keyValue,
        status: 'pending'
    });
    localStorage.setItem('flappy_global_withdrawals', JSON.stringify(globalWithdraws));

    saveUserData();
    updateHeaderBalance();

    alert(`Saque de ${formatCurrency(amount)} solicitado com sucesso! Aguarde a aprovação do administrador do sistema.`);
    
    toggleModal('withdraw-modal', false);
    renderWalletTab();
});

// --- Authentication UI Listeners & Form Submissions ---

document.getElementById('go-to-register').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthScreen('register');
});

document.getElementById('go-to-login').addEventListener('click', (e) => {
    e.preventDefault();
    showAuthScreen('login');
});

document.getElementById('view-terms').addEventListener('click', (e) => {
    e.preventDefault();
    alert("Termos e Condições - Flappy Canarinho:\n\n1. Você concorda em ajudar o Canarinho a voar sem colidir com os obstáculos.\n2. Todos os recordes e moedas acumulados são fictícios e salvos localmente apenas neste navegador.\n3. O jogo é gratuito e exclusivo para entretenimento.");
});

document.getElementById('logout-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('flappy_active_session');
    currentUser = null;
    showAuthScreen('login');
});

document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();

    const phone = document.getElementById('login-phone').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const errorBox = document.getElementById('login-error');

    errorBox.classList.add('hidden');

    if (!phone || !password) {
        showError(errorBox, "Preencha todos os campos!");
        return;
    }

    // ADMIN BYPASS LOGINS
    if (phone === 'lgn@admin.com' && password === 'lgnadmin@@') {
        currentUser = { role: 'admin', phone: 'lgn@admin.com', name: 'Administrador' };
        localStorage.setItem('flappy_active_session', JSON.stringify(currentUser));
        showAdminPanel();
        return;
    }

    const users = getRegisteredUsers();
    const user = users.find(u => u.phone === phone);

    if (!user || user.password !== password) {
        showError(errorBox, "Telefone ou senha incorretos!");
        return;
    }

    localStorage.setItem('flappy_active_session', JSON.stringify(user));
    currentUser = user;
    loadUserData();
    
    showGameUI();
    setGameState(GameState.READY);
});

document.getElementById('register-form').addEventListener('submit', (e) => {
    e.preventDefault();
    initAudio();

    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirmPassword = document.getElementById('reg-confirm-password').value.trim();
    const refCode = document.getElementById('reg-ref-code').value.trim();
    const termsAccepted = document.getElementById('reg-terms').checked;
    const errorBox = document.getElementById('reg-error');

    errorBox.classList.add('hidden');

    if (!name || !phone || !password || !confirmPassword) {
        showError(errorBox, "Preencha todos os campos obrigatórios!");
        return;
    }

    if (!/^\d{10,11}$/.test(phone)) {
        showError(errorBox, "Telefone inválido! Digite apenas números com DDD (10 ou 11 dígitos).");
        return;
    }

    if (password.length < 4) {
        showError(errorBox, "A senha deve ter no mínimo 4 caracteres!");
        return;
    }

    if (password !== confirmPassword) {
        showError(errorBox, "As senhas não coincidem!");
        return;
    }

    if (!termsAccepted) {
        showError(errorBox, "Você deve aceitar os Termos e Condições para continuar.");
        return;
    }

    const users = getRegisteredUsers();
    if (users.some(u => u.phone === phone)) {
        showError(errorBox, "Este número de telefone já está cadastrado!");
        return;
    }

    // Create newUser object
    const newUser = {
        name: name,
        phone: phone,
        password: password,
        refCode: refCode,
        influencer: false,
        wageredTotal: 0.00,
        rolloverRequirement: 0.00
    };

    // Process Affiliate Invitation Code if provided
    let hasAffiliateReferral = false;
    let referrerName = '';
    const currentDate = getCurrentDateString();
    
    if (refCode) {
        const referrer = users.find(u => u.phone === refCode);
        if (referrer) {
            hasAffiliateReferral = true;
            referrerName = referrer.name;
            
            // Get referral bonus set by admin
            const refBonus = parseFloat(localStorage.getItem('flappy_ref_bonus_amount') || '5.00');
            
            // Credit referrer
            const referrerBalance = parseFloat(localStorage.getItem(`flappy_balance_${referrer.phone}`) || '0.00');
            localStorage.setItem(`flappy_balance_${referrer.phone}`, (referrerBalance + refBonus).toFixed(2));
            
            // Log transaction for referrer
            const refTxs = JSON.parse(localStorage.getItem(`flappy_transactions_${referrer.phone}`) || '[]');
            refTxs.unshift({
                type: 'earning',
                amount: refBonus,
                date: currentDate,
                description: `Bônus Indicação (${newUser.name.split(' ')[0]})`
            });
            localStorage.setItem(`flappy_transactions_${referrer.phone}`, JSON.stringify(refTxs));

            // Log global affiliate logs
            const affiliateLogs = JSON.parse(localStorage.getItem('flappy_affiliate_logs') || '[]');
            affiliateLogs.unshift({
                referrer: referrer.name,
                referred: newUser.name,
                date: currentDate
            });
            localStorage.setItem('flappy_affiliate_logs', JSON.stringify(affiliateLogs));
        }
    }

    users.push(newUser);
    saveRegisteredUsers(users);

    localStorage.setItem('flappy_active_session', JSON.stringify(newUser));
    currentUser = newUser;
    
    // Initialize user balances
    highScore = 0;
    userBalance = 0;
    transactions = [];
    matches = [];
    userWagered = 0;
    userRollover = 0;

    // Credit registration commission to the referred user if they used a code
    if (hasAffiliateReferral) {
        const refBonus = parseFloat(localStorage.getItem('flappy_ref_bonus_amount') || '5.00');
        userBalance += refBonus;
        transactions.unshift({
            type: 'earning',
            amount: refBonus,
            date: currentDate,
            description: `Bônus Registro Indicação`
        });
    }

    saveUserData();

    // Trigger Facebook & TikTok Complete Registration conversion Pixels
    if (window.fbq) {
        fbq('track', 'CompleteRegistration');
    }
    if (window.ttq) {
        ttq.track('CompleteRegistration');
    }

    showGameUI();
    setGameState(GameState.READY);
});

function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}


// ==========================================================================
// DESKTOP EXPANDED ADMIN DASHBOARD LOGIC
// ==========================================================================

function showAdminPanel() {
    // Hide game container completely for full width desktop dashboard layout
    document.getElementById('game-container').classList.add('hidden');
    
    // Show admin screen overlay
    document.getElementById('admin-screen').classList.remove('hidden');
    
    // Load config states to Admin Controls
    loadAdminConfigsToPanel();

    // Render active tab panel
    renderAdminTab(activeAdminTab);
}

function loadAdminConfigsToPanel() {
    globalRTP = parseFloat(localStorage.getItem('flappy_rtp') || '100');
    gapHeightSetting = parseInt(localStorage.getItem('flappy_difficulty_gap') || '180');
    scrollSpeedSetting = parseInt(localStorage.getItem('flappy_difficulty_speed') || '150');
    pipePayoutPercentSetting = parseFloat(localStorage.getItem('flappy_pipe_payout_pct') || '20');

    // Update Normal configuration labels & values
    document.getElementById('admin-setting-rtp').value = globalRTP;
    document.getElementById('val-rtp').textContent = `${globalRTP}%`;
    document.getElementById('admin-setting-gap').value = gapHeightSetting;
    document.getElementById('val-gap').textContent = `${gapHeightSetting}px`;
    document.getElementById('admin-setting-speed').value = scrollSpeedSetting;
    document.getElementById('val-speed').textContent = `${scrollSpeedSetting}`;
    document.getElementById('admin-setting-pipe-pct').value = pipePayoutPercentSetting;

    // Update Influencer physics inputs
    const infGap = parseInt(localStorage.getItem('flappy_inf_gap') || '220');
    const infSpeed = parseInt(localStorage.getItem('flappy_inf_speed') || '140');
    const infCollision = localStorage.getItem('flappy_inf_collision') || 'LENIENT';

    document.getElementById('admin-inf-setting-gap').value = infGap;
    document.getElementById('val-inf-gap').textContent = `${infGap}px`;
    document.getElementById('admin-inf-setting-speed').value = infSpeed;
    document.getElementById('val-inf-speed').textContent = `${infSpeed}`;
    document.getElementById('admin-inf-setting-collision').value = infCollision;

    // Update Limits, Rollover and Affiliate settings
    document.getElementById('admin-setting-min-dep').value = localStorage.getItem('flappy_min_deposit') || '10.00';
    document.getElementById('admin-setting-min-with').value = localStorage.getItem('flappy_min_withdraw') || '20.00';
    document.getElementById('admin-setting-rollover').value = localStorage.getItem('flappy_rollover_mult') || '0';
    document.getElementById('admin-setting-ref-bonus').value = localStorage.getItem('flappy_ref_bonus_amount') || '5.00';

    // Update Faixas Tiers
    document.getElementById('admin-tier-1-val').value = localStorage.getItem('flappy_tier_1_val') || '20.00';
    document.getElementById('admin-tier-1-pct').value = localStorage.getItem('flappy_tier_1_pct') || '10';
    document.getElementById('admin-tier-2-val').value = localStorage.getItem('flappy_tier_2_val') || '50.00';
    document.getElementById('admin-tier-2-pct').value = localStorage.getItem('flappy_tier_2_pct') || '25';
    document.getElementById('admin-tier-3-val').value = localStorage.getItem('flappy_tier_3_val') || '100.00';
    document.getElementById('admin-tier-3-pct').value = localStorage.getItem('flappy_tier_3_pct') || '50';

    // Load VizzionPay settings
    document.getElementById('admin-gateway-pubkey').value = localStorage.getItem('flappy_gateway_pubkey') || '';
    document.getElementById('admin-gateway-seckey').value = localStorage.getItem('flappy_gateway_seckey') || '';

    // Load Pixel IDs
    document.getElementById('admin-pixel-facebook').value = localStorage.getItem('flappy_pixel_facebook_id') || '';
    document.getElementById('admin-pixel-tiktok').value = localStorage.getItem('flappy_pixel_tiktok_id') || '';
}

// Sidebar log out bind
document.getElementById('admin-logout-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem('flappy_active_session');
    currentUser = null;
    showAuthScreen('login');
});

// Sidebar menu navigation binds
document.querySelectorAll('.admin-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.stopPropagation();
        initAudio();
        
        document.querySelectorAll('.admin-menu-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const tabName = item.dataset.tab;
        renderAdminTab(tabName);
    });
});

function renderAdminTab(tabName) {
    activeAdminTab = tabName;
    
    // Show corresponding panel view
    document.querySelectorAll('.admin-desktop-panel').forEach(panel => {
        if (panel.id === `admin-content-${tabName}`) {
            panel.classList.remove('hidden');
            panel.classList.add('active');
        } else {
            panel.classList.add('hidden');
            panel.classList.remove('active');
        }
    });

    // Populate dynamic data
    if (tabName === 'dashboard') {
        renderAdminOverviewDashboard();
    } else if (tabName === 'users') {
        renderAdminUsersTable();
    } else if (tabName === 'jogabilidade') {
        renderAdminInfluencersTable();
    } else if (tabName === 'finance') {
        renderAdminFinanceLogs();
    }
}

// 1. Render Dashboard Overview Metrics
function renderAdminOverviewDashboard() {
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    let totalWagered = 0;
    let influencersCount = 0;

    const users = getRegisteredUsers();
    users.forEach(u => {
        if (u.influencer) influencersCount++;

        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${u.phone}`) || '[]');
        txs.forEach(t => {
            if (t.type === 'deposit') totalDeposited += t.amount;
            if (t.type === 'withdraw' && t.description.includes('Saque')) totalWithdrawn += t.amount;
            if (t.type === 'withdraw' && t.description.includes('Aposta')) totalWagered += t.amount;
        });
    });

    document.getElementById('admin-metric-deposits').textContent = formatCurrency(totalDeposited);
    document.getElementById('admin-metric-withdraws').textContent = formatCurrency(totalWithdrawn);
    document.getElementById('admin-metric-wagered').textContent = formatCurrency(totalWagered);
    document.getElementById('admin-metric-rtp').textContent = `${globalRTP}%`;
    document.getElementById('admin-metric-users-count').textContent = users.length;
    document.getElementById('admin-metric-influencers-count').textContent = influencersCount;
}

// 2. Render Users Table
function renderAdminUsersTable() {
    const listElement = document.getElementById('admin-users-list');
    listElement.innerHTML = '';

    const users = getRegisteredUsers();
    if (users.length === 0) {
        listElement.innerHTML = '<tr><td colspan="7" class="empty-log" style="text-align:center;">Nenhum usuário cadastrado.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        const balance = parseFloat(localStorage.getItem(`flappy_balance_${user.phone}`) || '0.00');
        const wagered = parseFloat(localStorage.getItem(`flappy_wagered_${user.phone}`) || '0.00');
        const rollover = parseFloat(localStorage.getItem(`flappy_rollover_${user.phone}`) || '0.00');
        
        const roleText = user.influencer ? 'Influencer' : 'Normal';
        const roleClass = user.influencer ? 'influencer' : 'normal';

        tr.innerHTML = `
            <td>
                <div class="user-meta">
                    <span class="user-name">${user.name}</span>
                    <span class="user-phone">Cadastro em: ${user.phone}</span>
                </div>
            </td>
            <td>${user.phone}</td>
            <td style="font-weight: 700; color: var(--primary);">${formatCurrency(balance)}</td>
            <td>${formatCurrency(wagered)}</td>
            <td style="color: var(--secondary); font-weight: 600;">${formatCurrency(rollover)}</td>
            <td>
                <span class="admin-badge-role ${roleClass}" data-phone="${user.phone}">${roleText}</span>
            </td>
            <td>
                <button class="admin-btn-action admin-btn-edit" data-phone="${user.phone}">Ajustar Saldo</button>
                <button class="admin-btn-action admin-btn-delete" data-phone="${user.phone}">Excluir</button>
            </td>
        `;
        listElement.appendChild(tr);
    });

    // Bind row listeners
    listElement.querySelectorAll('.admin-badge-role').forEach(badge => {
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserInfluencerRole(badge.dataset.phone);
        });
    });

    listElement.querySelectorAll('.admin-btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openBalanceEditModal(btn.dataset.phone);
        });
    });

    listElement.querySelectorAll('.admin-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteUserAccount(btn.dataset.phone);
        });
    });
}

// 3. Render Influencers Tab List
function renderAdminInfluencersTable() {
    const listElement = document.getElementById('admin-influencers-list');
    listElement.innerHTML = '';

    const users = getRegisteredUsers().filter(u => u.influencer);
    if (users.length === 0) {
        listElement.innerHTML = '<tr><td colspan="4" class="empty-log" style="text-align:center;">Nenhuma conta influencer marcada.</td></tr>';
        return;
    }

    users.forEach(user => {
        const tr = document.createElement('tr');
        
        // Sum all game payout logs
        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${user.phone}`) || '[]');
        const totalEarning = txs
            .filter(t => t.type === 'earning')
            .reduce((sum, t) => sum + t.amount, 0);

        tr.innerHTML = `
            <td><span class="user-name">${user.name}</span></td>
            <td>${user.phone}</td>
            <td style="font-weight: 700; color: #4dff4d;">${formatCurrency(totalEarning)}</td>
            <td>
                <button class="admin-btn-action admin-btn-delete" data-phone="${user.phone}" style="margin: 0;">Remover Cargo</button>
            </td>
        `;
        listElement.appendChild(tr);
    });

    listElement.querySelectorAll('.admin-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleUserInfluencerRole(btn.dataset.phone);
        });
    });
}

function toggleUserInfluencerRole(phone) {
    const users = getRegisteredUsers();
    const idx = users.findIndex(u => u.phone === phone);
    if (idx !== -1) {
        users[idx].influencer = !users[idx].influencer;
        saveRegisteredUsers(users);
        
        // Refresh active views
        if (activeAdminTab === 'users') renderAdminUsersTable();
        if (activeAdminTab === 'jogabilidade') {
            renderAdminInfluencersTable();
        }
    }
}

function deleteUserAccount(phone) {
    if (confirm(`Excluir conta ${phone}? Todos os saldos e transações serão apagados.`)) {
        let users = getRegisteredUsers();
        users = users.filter(u => u.phone !== phone);
        saveRegisteredUsers(users);

        localStorage.removeItem(`flappy_balance_${phone}`);
        localStorage.removeItem(`flappy_high_score_val_${phone}`);
        localStorage.removeItem(`flappy_transactions_${phone}`);
        localStorage.removeItem(`flappy_matches_${phone}`);
        localStorage.removeItem(`flappy_wagered_${phone}`);
        localStorage.removeItem(`flappy_rollover_${phone}`);

        renderAdminUsersTable();
    }
}

// 4. Render Financial logs sub-panels
const adminSubtabs = ['txs', 'deps', 'withdraws'];
adminSubtabs.forEach(subtabName => {
    document.getElementById(`admin-sub-tab-btn-${subtabName}`).addEventListener('click', (e) => {
        e.stopPropagation();
        renderAdminSubtab(subtabName);
    });
});

function renderAdminSubtab(subtabName) {
    activeAdminSubtab = subtabName;
    adminSubtabs.forEach(name => {
        const btn = document.getElementById(`admin-sub-tab-btn-${name}`);
        const panel = document.getElementById(`admin-sub-content-${name}`);
        if (name === subtabName) {
            btn.classList.add('active');
            panel.classList.remove('hidden');
            panel.classList.add('active');
        } else {
            btn.classList.remove('active');
            panel.classList.add('hidden');
            panel.classList.remove('active');
        }
    });

    if (subtabName === 'txs') renderAdminAllTransactionsTable();
    if (subtabName === 'deps') renderAdminAllDepositsTable();
    if (subtabName === 'withdraws') renderAdminAllWithdrawalsTable();
}

function renderAdminFinanceLogs() {
    renderAdminSubtab(activeAdminSubtab);
}

// Subtab A: Render consolidated logs
function renderAdminAllTransactionsTable() {
    const listElement = document.getElementById('admin-all-txs-list');
    listElement.innerHTML = '';

    const users = getRegisteredUsers();
    let allTxs = [];

    users.forEach(u => {
        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${u.phone}`) || '[]');
        txs.forEach(t => {
            allTxs.push({
                name: u.name,
                phone: u.phone,
                type: t.type,
                amount: t.amount,
                date: t.date,
                description: t.description
            });
        });
    });

    // Sort by date (descending)
    allTxs.sort((a, b) => {
        const parseDate = (dStr) => {
            const parts = dStr.split(' ');
            const dParts = parts[0].split('/');
            const tParts = parts[1].split(':');
            return new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]).getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });

    if (allTxs.length === 0) {
        listElement.innerHTML = '<tr><td colspan="5" class="empty-log" style="text-align:center;">Nenhuma transação registrada.</td></tr>';
        return;
    }

    allTxs.forEach(tx => {
        const tr = document.createElement('tr');
        
        let typeSymbol = '💸';
        let typeLabel = '';
        let amountClass = 'positive';

        if (tx.type === 'deposit') {
            typeSymbol = '📥';
            amountClass = 'positive';
            typeLabel = 'Depósito';
        } else if (tx.type === 'withdraw') {
            typeSymbol = '📤';
            amountClass = 'negative';
            typeLabel = tx.description.includes('Aposta') ? 'Aposta' : 'Saque';
        } else if (tx.type === 'earning') {
            typeSymbol = '🎮';
            amountClass = 'positive';
            typeLabel = 'Ganhos';
        }

        const sign = (amountClass === 'positive' && tx.type !== 'deposit') ? '+' : '';
        const displaySign = tx.type === 'withdraw' ? '-' : sign;

        tr.innerHTML = `
            <td>${tx.date}</td>
            <td>
                <div class="user-meta">
                    <span class="user-name">${tx.name}</span>
                    <span class="user-phone">${tx.phone}</span>
                </div>
            </td>
            <td>${typeSymbol} ${typeLabel}</td>
            <td style="font-weight: 700;" class="status-${amountClass}">${displaySign}${formatCurrency(tx.amount)}</td>
            <td>${tx.description}</td>
        `;
        listElement.appendChild(tr);
    });
}

// Subtab B: Render deposits audit logs
function renderAdminAllDepositsTable() {
    const listElement = document.getElementById('admin-all-deps-list');
    listElement.innerHTML = '';

    const deposits = JSON.parse(localStorage.getItem('flappy_global_deposits') || '[]');
    if (deposits.length === 0) {
        listElement.innerHTML = '<tr><td colspan="4" class="empty-log" style="text-align:center;">Nenhum depósito auditado.</td></tr>';
        return;
    }

    deposits.forEach(dep => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${dep.date}</td>
            <td>
                <div class="user-meta">
                    <span class="user-name">${dep.name}</span>
                    <span class="user-phone">${dep.phone}</span>
                </div>
            </td>
            <td style="font-weight:700; color:#4dff4d;">+${formatCurrency(dep.amount)}` + (dep.bonus > 0 ? ` (+${formatCurrency(dep.bonus)} Bônus)` : '') + `</td>
            <td><span class="status-approved">Completado</span></td>
        `;
        listElement.appendChild(tr);
    });
}

// Subtab C: Render withdrawals audit logs (Approve/Reject actions)
function renderAdminAllWithdrawalsTable() {
    const listElement = document.getElementById('admin-all-withdraws-list');
    listElement.innerHTML = '';

    const withdraws = JSON.parse(localStorage.getItem('flappy_global_withdrawals') || '[]');
    if (withdraws.length === 0) {
        listElement.innerHTML = '<tr><td colspan="6" class="empty-log" style="text-align:center;">Nenhuma solicitação de saque.</td></tr>';
        return;
    }

    withdraws.forEach(w => {
        const tr = document.createElement('tr');
        
        let actionsHtml = '-';
        let statusClass = 'pending';
        let statusText = 'Pendente';

        if (w.status === 'approved') {
            statusClass = 'approved';
            statusText = 'Aprovado';
        } else if (w.status === 'rejected') {
            statusClass = 'rejected';
            statusText = 'Recusado';
        } else {
            actionsHtml = `
                <button class="btn-approve" data-id="${w.id}">Aprovar</button>
                <button class="btn-reject" data-id="${w.id}">Recusar</button>
            `;
        }

        tr.innerHTML = `
            <td>${w.date}</td>
            <td>
                <div class="user-meta">
                    <span class="user-name">${w.name}</span>
                    <span class="user-phone">${w.phone}</span>
                </div>
            </td>
            <td style="font-weight:700; color:#ff4d4d;">-${formatCurrency(w.amount)}</td>
            <td><span class="key">${w.keyType}: ${w.keyValue}</span></td>
            <td><span class="status-${statusClass}">${statusText}</span></td>
            <td>${actionsHtml}</td>
        `;
        listElement.appendChild(tr);
    });

    listElement.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            approveUserWithdrawal(btn.dataset.id);
        });
    });

    listElement.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            rejectUserWithdrawal(btn.dataset.id);
        });
    });
}

function approveUserWithdrawal(id) {
    const withdraws = JSON.parse(localStorage.getItem('flappy_global_withdrawals') || '[]');
    const idx = withdraws.findIndex(w => w.id === id);
    if (idx !== -1) {
        withdraws[idx].status = 'approved';
        localStorage.setItem('flappy_global_withdrawals', JSON.stringify(withdraws));

        // Update user transaction description to reflect approval
        const phone = withdraws[idx].phone;
        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${phone}`) || '[]');
        if (txs.length > 0) {
            const txIdx = txs.findIndex(t => t.type === 'withdraw' && t.amount === withdraws[idx].amount && t.description.includes('Solicitado'));
            if (txIdx !== -1) {
                txs[txIdx].description = `Saque PIX Aprovado (${withdraws[idx].keyType})`;
                localStorage.setItem(`flappy_transactions_${phone}`, JSON.stringify(txs));
            }
        }

        alert("Saque aprovado com sucesso!");
        renderAdminSubtab('withdraws');
    }
}

function rejectUserWithdrawal(id) {
    const withdraws = JSON.parse(localStorage.getItem('flappy_global_withdrawals') || '[]');
    const idx = withdraws.findIndex(w => w.id === id);
    if (idx !== -1) {
        withdraws[idx].status = 'rejected';
        localStorage.setItem('flappy_global_withdrawals', JSON.stringify(withdraws));

        const phone = withdraws[idx].phone;
        const refundAmt = withdraws[idx].amount;

        // Refund user balance
        const balance = parseFloat(localStorage.getItem(`flappy_balance_${phone}`) || '0.00');
        localStorage.setItem(`flappy_balance_${phone}`, (balance + refundAmt).toFixed(2));

        // Add refund transaction log to user history
        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${phone}`) || '[]');
        txs.unshift({
            type: 'deposit',
            amount: refundAmt,
            date: getCurrentDateString(),
            description: 'Reembolso Saque Recusado'
        });
        localStorage.setItem(`flappy_transactions_${phone}`, JSON.stringify(txs));

        alert("Saque recusado! O valor foi reembolsado ao saldo do usuário.");
        renderAdminSubtab('withdraws');
    }
}

// 5. Admin Settings sliders and inputs Binds
document.getElementById('admin-setting-rtp').addEventListener('input', (e) => {
    document.getElementById('val-rtp').textContent = `${e.target.value}%`;
});

document.getElementById('admin-setting-gap').addEventListener('input', (e) => {
    document.getElementById('val-gap').textContent = `${e.target.value}px`;
});

document.getElementById('admin-setting-speed').addEventListener('input', (e) => {
    document.getElementById('val-speed').textContent = `${e.target.value}`;
});

// Influencer sliders feedback
document.getElementById('admin-inf-setting-gap').addEventListener('input', (e) => {
    document.getElementById('val-inf-gap').textContent = `${e.target.value}px`;
});

document.getElementById('admin-inf-setting-speed').addEventListener('input', (e) => {
    document.getElementById('val-inf-speed').textContent = `${e.target.value}`;
});

// Save Gameplay physics for Normal and Influencer (tab 3)
document.getElementById('btn-save-jogabilidade-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    // Normal values
    const gap = parseInt(document.getElementById('admin-setting-gap').value);
    const speed = parseInt(document.getElementById('admin-setting-speed').value);

    // Influencer values
    const infGap = parseInt(document.getElementById('admin-inf-setting-gap').value);
    const infSpeed = parseInt(document.getElementById('admin-inf-setting-speed').value);
    const collision = document.getElementById('admin-inf-setting-collision').value;

    localStorage.setItem('flappy_difficulty_gap', gap);
    localStorage.setItem('flappy_difficulty_speed', speed);
    localStorage.setItem('flappy_inf_gap', infGap);
    localStorage.setItem('flappy_inf_speed', infSpeed);
    localStorage.setItem('flappy_inf_collision', collision);

    gapHeightSetting = gap;
    scrollSpeedSetting = speed;

    alert("Parâmetros de física (Comum e Influencer) salvos com sucesso!");
});

// Save Gateway Keys and Marketing Conversion Pixels (tab 4)
document.getElementById('btn-save-integrations').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    const pubKey = document.getElementById('admin-gateway-pubkey').value.trim();
    const secKey = document.getElementById('admin-gateway-seckey').value.trim();
    
    const fbId = document.getElementById('admin-pixel-facebook').value.trim();
    const ttId = document.getElementById('admin-pixel-tiktok').value.trim();

    localStorage.setItem('flappy_gateway_pubkey', pubKey);
    localStorage.setItem('flappy_gateway_seckey', secKey);
    localStorage.setItem('flappy_pixel_facebook_id', fbId);
    localStorage.setItem('flappy_pixel_tiktok_id', ttId);

    // Call dynamic tracking pixels script loader instantly
    injectTrackingPixels();

    alert("Integrações (VizzionPay e Pixels de Conversão) atualizadas!");
});

// Save All settings (tab 6)
document.getElementById('btn-save-all-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();

    const rtp = parseFloat(document.getElementById('admin-setting-rtp').value);
    const pipePct = parseFloat(document.getElementById('admin-setting-pipe-pct').value) || 20;

    const minDep = parseFloat(document.getElementById('admin-setting-min-dep').value) || 10.00;
    const minWith = parseFloat(document.getElementById('admin-setting-min-with').value) || 20.00;
    const rollover = parseInt(document.getElementById('admin-setting-rollover').value) || 0;
    const refBonus = parseFloat(document.getElementById('admin-setting-ref-bonus').value) || 5.00;

    const t1_val = parseFloat(document.getElementById('admin-tier-1-val').value) || 20.00;
    const t1_pct = parseFloat(document.getElementById('admin-tier-1-pct').value) || 0;
    const t2_val = parseFloat(document.getElementById('admin-tier-2-val').value) || 50.00;
    const t2_pct = parseFloat(document.getElementById('admin-tier-2-pct').value) || 0;
    const t3_val = parseFloat(document.getElementById('admin-tier-3-val').value) || 100.00;
    const t3_pct = parseFloat(document.getElementById('admin-tier-3-pct').value) || 0;

    // Persist configs
    localStorage.setItem('flappy_rtp', rtp);
    localStorage.setItem('flappy_pipe_payout_pct', pipePct);

    localStorage.setItem('flappy_min_deposit', minDep.toFixed(2));
    localStorage.setItem('flappy_min_withdraw', minWith.toFixed(2));
    localStorage.setItem('flappy_rollover_mult', rollover);
    localStorage.setItem('flappy_ref_bonus_amount', refBonus.toFixed(2));

    localStorage.setItem('flappy_tier_1_val', t1_val.toFixed(2));
    localStorage.setItem('flappy_tier_1_pct', t1_pct);
    localStorage.setItem('flappy_tier_2_val', t2_val.toFixed(2));
    localStorage.setItem('flappy_tier_2_pct', t2_pct);
    localStorage.setItem('flappy_tier_3_val', t3_val.toFixed(2));
    localStorage.setItem('flappy_tier_3_pct', t3_pct);

    globalRTP = rtp;
    pipePayoutPercentSetting = pipePct;

    alert("Configurações financeiras e bônus aplicadas com sucesso!");
});

// Balance Adjust popup modal
function openBalanceEditModal(phone) {
    editingUserPhone = phone;
    const users = getRegisteredUsers();
    const user = users.find(u => u.phone === phone);
    
    if (user) {
        const balance = parseFloat(localStorage.getItem(`flappy_balance_${phone}`) || '0.00');
        document.getElementById('admin-balance-user-name').textContent = `Alterar saldo de ${user.name}`;
        document.getElementById('admin-balance-amount').value = balance.toFixed(2);
        
        toggleModal('admin-balance-modal', true);
    }
}

document.getElementById('admin-balance-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('admin-balance-amount').value);
    
    if (editingUserPhone && !isNaN(amount) && amount >= 0) {
        localStorage.setItem(`flappy_balance_${editingUserPhone}`, amount.toFixed(2));
        
        // Log transaction for user
        const txs = JSON.parse(localStorage.getItem(`flappy_transactions_${editingUserPhone}`) || '[]');
        txs.unshift({
            type: 'deposit',
            amount: amount,
            date: getCurrentDateString(),
            description: 'Saldo Ajustado por Admin'
        });
        localStorage.setItem(`flappy_transactions_${editingUserPhone}`, JSON.stringify(txs));

        toggleModal('admin-balance-modal', false);
        
        if (activeAdminTab === 'users') renderAdminUsersTable();
    }
});

document.getElementById('btn-close-balance-modal').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleModal('admin-balance-modal', false);
});
