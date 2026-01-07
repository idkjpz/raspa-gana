document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENTOS DOM ---
    const loginScreen = document.getElementById('login-screen');
    const loginMessage = document.getElementById('login-message'); 
    const gameWrapper = document.getElementById('game-wrapper');
    const gridContainer = document.getElementById('grid-container');
    
    const usernameInput = document.getElementById('username-input');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    
    const inputArea = document.getElementById('input-area');
    const cooldownArea = document.getElementById('cooldown-area');
    const timerDisplay = document.getElementById('timer');
    const lastResultText = document.getElementById('last-result-text');
    const welcomeUser = document.getElementById('welcome-user');

    // --- CONFIGURACIÓN ---
    const COOLDOWN_HOURS = 24; 
    const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;
    
    // --- VARIABLES DE JUEGO ---
    let currentUser = null;
    let revealedIndices = new Set();
    let isGameOver = false;
    let boardItems = [];
    
    // NUEVA VARIABLE: Contador de intentos
    let attemptsCount = 0; 
    const MAX_ATTEMPTS = 2; // 1 intento normal + 1 extra

    // --- AUDIO ---
    const audioScratch = new Audio('scratch.mp3'); 
    const audioWin = new Audio('win.mp3');
    audioScratch.volume = 0.4;
    audioWin.volume = 0.8;
    let lastSoundTime = 0;

    // --- PREMIOS ---
    const prizeMap = {
        '🎰': { name: 'JACKPOT', value: 'Bono del 100%' },
        '💎': { name: 'DIAMANTE', value: '20% extra' },
        '🪙': { name: 'ORO', value: 'Bono del 200%' },
        '🎲': { name: 'SUERTE', value: '15% extra' },
        '🃏': { name: 'JOKER', value: '300 Fichas' },
        '🍒': { name: 'FRUTA', value: '10% extra' }
    };
    const symbols = Object.keys(prizeMap);

    // ==========================================
    // 1. SISTEMA DE LOGIN Y CHECK DE TIEMPO
    // ==========================================

    const savedUser = localStorage.getItem('casino_user');
    if (savedUser) {
        usernameInput.value = savedUser;
        attemptLogin(savedUser);
    }

    btnLogin.addEventListener('click', () => {
        const user = usernameInput.value.trim();
        if (user) attemptLogin(user);
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('casino_user');
        location.reload();
    });

    function attemptLogin(user) {
        currentUser = user;
        localStorage.setItem('casino_user', user);

        const lastPlayedTime = localStorage.getItem(`last_played_${user}`);
        const lastPrize = localStorage.getItem(`last_prize_${user}`);
        const now = Date.now();

        // LOGICA DE BLOQUEO (24 HORAS)
        if (lastPlayedTime && (now - lastPlayedTime < COOLDOWN_MS)) {
            showCooldownScreen(lastPlayedTime, lastPrize);
        } else {
            // Si puede jugar, reseteamos los intentos a 0
            attemptsCount = 0;
            startGame();
        }
    }

    function showCooldownScreen(lastTimeTimestamp, lastPrizeText) {
        loginScreen.classList.remove('hidden');
        gameWrapper.classList.add('hidden');
        inputArea.classList.add('hidden');
        loginMessage.style.display = 'none'; 
        cooldownArea.classList.remove('hidden');

        if (lastPrizeText === 'null' || !lastPrizeText) {
            lastResultText.innerHTML = "Tu última jugada: <br>No ganaste nada 😢";
        } else {
            lastResultText.innerHTML = `Tu última jugada: <br>Ganaste ${lastPrizeText} 🎉`;
        }

        const targetTime = parseInt(lastTimeTimestamp) + COOLDOWN_MS;
        
        const interval = setInterval(() => {
            const remaining = targetTime - Date.now();
            
            if (remaining <= 0) {
                clearInterval(interval);
                location.reload(); 
            } else {
                const hours = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((remaining / (1000 * 60)) % 60);
                const seconds = Math.floor((remaining / 1000) % 60);
                timerDisplay.innerText = 
                    `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
            }
        }, 1000);
    }

    // ==========================================
    // 2. INICIO DEL JUEGO
    // ==========================================

    function startGame() {
        loginScreen.classList.add('hidden');
        gameWrapper.classList.remove('hidden');
        loginMessage.style.display = 'block'; 
        
        // Actualizamos el mensaje de bienvenida según el intento
        if (attemptsCount === 0) {
            welcomeUser.innerText = `HOLA, ${currentUser.toUpperCase()}`;
        } else {
            welcomeUser.innerText = `¡INTENTO EXTRA! 🍀`;
            welcomeUser.style.color = '#ffd700'; // Dorado para resaltar
        }
        
        initBoard();
    }

    function initBoard() {
        gridContainer.innerHTML = '';
        boardItems = [];
        revealedIndices.clear();
        isGameOver = false;

        for (let i = 0; i < 9; i++) {
            const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
            boardItems.push(randomSymbol);
        }

        boardItems.forEach((symbol, index) => {
            const card = document.createElement('div');
            card.classList.add('card');

            const symbolSpan = document.createElement('span');
            symbolSpan.innerText = symbol;
            card.appendChild(symbolSpan);

            const canvas = document.createElement('canvas');
            canvas.width = 80;
            canvas.height = 80;
            const ctx = canvas.getContext('2d');

            let grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grd.addColorStop(0, '#6a009e');
            grd.addColorStop(0.5, '#3e005c');
            grd.addColorStop(1, '#6a009e');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText('$', canvas.width / 2, canvas.height / 2); 

            let isDrawing = false;
            
            function scratch(x, y) {
                if (isGameOver) return;
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, 15, 0, Math.PI * 2, false);
                ctx.fill();

                if (Math.random() > 0.6) createSparkle(x, y, canvas);
                if (navigator.vibrate && Math.random() > 0.8) navigator.vibrate(5);
                
                const now = Date.now();
                if (now - lastSoundTime > 150) {
                    const soundClone = audioScratch.cloneNode(); 
                    soundClone.volume = 0.3;
                    soundClone.play().catch(()=>{}); 
                    lastSoundTime = now;
                }

                checkScratchPercent(index, ctx, canvas);
            }

            canvas.addEventListener('mousedown', () => isDrawing = true);
            canvas.addEventListener('mouseup', () => isDrawing = false);
            canvas.addEventListener('mousemove', (e) => {
                if (!isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                scratch(e.clientX - rect.left, e.clientY - rect.top);
            });
            canvas.addEventListener('touchstart', (e) => { isDrawing = true; e.preventDefault(); });
            canvas.addEventListener('touchend', () => isDrawing = false);
            canvas.addEventListener('touchmove', (e) => {
                if (!isDrawing) return;
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const touch = e.touches[0];
                scratch(touch.clientX - rect.left, touch.clientY - rect.top);
            });

            card.appendChild(canvas);
            gridContainer.appendChild(card);
        });
    }

    function checkScratchPercent(cardIndex, ctx, canvas) {
        if (revealedIndices.has(cardIndex)) return;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        let transparentPixels = 0;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] === 0) transparentPixels++;
        }

        if (transparentPixels > (pixels.length / 4) * 0.40) {
            canvas.style.opacity = '0';
            setTimeout(() => canvas.remove(), 300);
            revealedIndices.add(cardIndex);
            checkForWin();
        }
    }

    function checkForWin() {
        if (isGameOver) return;

        const visibleCounts = {};
        revealedIndices.forEach(index => {
            const symbol = boardItems[index];
            visibleCounts[symbol] = (visibleCounts[symbol] || 0) + 1;
        });

        let hasWon = false;
        for (const symbol in visibleCounts) {
            if (visibleCounts[symbol] >= 3) {
                triggerWin(prizeMap[symbol]);
                hasWon = true;
                break;
            }
        }

        if (!hasWon && revealedIndices.size === 9) {
            triggerLose();
        }
    }

    // ==========================================
    // 3. FINAL DEL JUEGO Y GUARDADO
    // ==========================================

    function saveResult(prizeValue) {
        localStorage.setItem(`last_played_${currentUser}`, Date.now());
        localStorage.setItem(`last_prize_${currentUser}`, prizeValue);
    }

    function triggerWin(prize) {
        isGameOver = true;
        // Si gana, guardamos inmediatamente (no importa si era el intento 1 o 2)
        saveResult(prize.value); 
        
        audioWin.play().catch(()=>{});
        launchConfetti();

        Swal.fire({
            title: '¡GANASTE!',
            html: `
                <div style="font-size:1.1rem; margin-bottom: 10px;">Premio: <b style="color:#ffd700">${prize.name}</b></div>
                <div style="font-size:2.5rem; font-weight:800; color:#fff; margin-bottom:20px;">${prize.value}</div>
                
                <div style="background:rgba(255,255,255,0.1); padding:15px; border-radius:10px; border:1px dashed #ffd700;">
                    <p style="margin:0; font-size:1.2rem;">📸 <b>¡FOTO CAPTURA!</b> 📸</p>
                    <p style="margin:5px 0 0 0; font-size:0.9rem; color:#e0cfff;">
                        Manda una captura de esta pantalla por privado para reclamar tu premio.
                    </p>
                </div>
            `,
            icon: 'success',
            background: '#12001f',
            color: '#fff',
            confirmButtonText: '¡Listo, ya la tengo!',
            confirmButtonColor: '#d4af37',
            allowOutsideClick: false
        }).then(() => {
            location.reload();
        });
    }

    // --- AQUÍ ESTÁ LA LÓGICA DE LA SEGUNDA OPORTUNIDAD ---
    function triggerLose() {
        isGameOver = true;
        attemptsCount++; // Sumamos un intento

        // Chequeamos si todavía tiene intentos disponibles (Attempts < 2)
        if (attemptsCount < MAX_ATTEMPTS) {
            
            // --- TIENE OTRA OPORTUNIDAD ---
            Swal.fire({
                title: '¡CASI LO TIENES!',
                html: `
                    El Padrino es generoso...<br>
                    <b>¡Te regala una segunda oportunidad!</b> 🎩
                `,
                icon: 'info', // Icono diferente
                background: '#12001f',
                color: '#fff',
                confirmButtonText: '¡Jugar de nuevo ahora!',
                confirmButtonColor: '#00c853',
                allowOutsideClick: false
            }).then(() => {
                // NO guardamos nada en localStorage todavía
                // Solo reiniciamos el tablero
                startGame();
            });

        } else {
            // --- YA GASTÓ SUS VIDAS (GAME OVER REAL) ---
            saveResult(null); // Guardamos que perdió y bloqueamos

            Swal.fire({
                title: 'Fin del juego',
                text: 'Se acabaron las oportunidades por hoy. ¡Vuelve en 24 horas!',
                icon: 'error',
                background: '#12001f',
                color: '#fff',
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#6a009e',
                allowOutsideClick: false
            }).then(() => {
                location.reload();
            });
        }
    }

    // FX: Chispas y Confeti
    function createSparkle(x, y, canvasElement) {
        const sparkle = document.createElement('div');
        sparkle.classList.add('sparkle');
        const rect = canvasElement.getBoundingClientRect();
        sparkle.style.left = (rect.left + x) + 'px';
        sparkle.style.top = (rect.top + y) + 'px';
        document.body.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 600);
    }

    function launchConfetti() {
        const duration = 3000;
        const end = Date.now() + duration;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors:['#ffd700','#fff'] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors:['#ffd700','#fff'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        }());
    }
});