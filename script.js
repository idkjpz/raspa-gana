// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// ======================================================
// 1. CONFIGURACIÓN FIREBASE
// ======================================================
const firebaseConfig = {
    apiKey: "AIzaSyCVFjb7B9S4dyU7zOx14GgWhyGYcN1W4Ls",
    authDomain: "raspa-padrino.firebaseapp.com",
    projectId: "raspa-padrino",
    storageBucket: "raspa-padrino.firebasestorage.app",
    messagingSenderId: "170734245678",
    appId: "1:170734245678:web:6d7df33489ed1b3d000cbf"
};

// ======================================================
// 2. CONFIGURACIÓN DISCORD
// ======================================================
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1458397548321574967/zJZXUHfLS8z_61x_SmAUP9kueoOxuxmiLS8crjdvDti3zqC4uJ1zdwbVYqi72ljp7XXX"; 

// Iniciamos la conexión con la nube
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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
    const MAX_ATTEMPTS = 2; 
    
    // --- VARIABLES DE JUEGO ---
    let currentUser = null;
    let revealedIndices = new Set();
    let isGameOver = false;
    let boardItems = [];
    let attemptsCount = 0; 

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
        '🎲': { name: 'SUERTE', value: '5% extra' },
        '🃏': { name: 'JOKER', value: '333 Fichas' },
        '🍒': { name: 'FRUTA', value: '10% extra' }
    };
    const symbols = Object.keys(prizeMap);

    // ==========================================
    // SISTEMA DE LOGIN
    // ==========================================
    const savedName = localStorage.getItem('local_username_cache');
    if(savedName) {
        usernameInput.value = savedName;
        btnLogin.innerText = "Recuperando sesión...";
        btnLogin.disabled = true;
        attemptLogin(savedName); 
    }

    btnLogin.addEventListener('click', async () => {
        const user = usernameInput.value.trim().toLowerCase();
        if (user) {
            btnLogin.innerText = "Verificando...";
            btnLogin.disabled = true;
            await attemptLogin(user);
            btnLogin.innerText = "ENTRAR";
            btnLogin.disabled = false;
        }
    });

    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('local_username_cache');
        location.reload();
    });

    async function attemptLogin(user) {
        currentUser = user;
        localStorage.setItem('local_username_cache', user); 

        const docRef = doc(db, "jugadores", user);
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const now = Date.now();
                if (data.lastPlayed && (now - data.lastPlayed < COOLDOWN_MS)) {
                    showCooldownScreen(data.lastPlayed, data.lastPrize);
                } else {
                    attemptsCount = 0;
                    startGame();
                }
            } else {
                attemptsCount = 0;
                startGame();
            }
        } catch (error) {
            console.error("Error:", error);
            btnLogin.innerText = "ENTRAR";
            btnLogin.disabled = false;
        }
    }

    function showCooldownScreen(lastTimeTimestamp, lastPrizeText) {
        loginScreen.classList.remove('hidden');
        gameWrapper.classList.add('hidden');
        inputArea.classList.add('hidden');
        loginMessage.style.display = 'none'; 
        cooldownArea.classList.remove('hidden');

        const dateObj = new Date(lastTimeTimestamp);
        const timeString = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')} hs`;

        if (lastPrizeText === 'null' || !lastPrizeText) {
            lastResultText.innerHTML = `<span style="font-size:0.8em; opacity:0.8">Jugaste a las ${timeString}</span><br>Resultado: No ganaste nada 😢`;
        } else {
            lastResultText.innerHTML = `<span style="font-size:0.8em; opacity:0.8">Jugaste a las ${timeString}</span><br>Resultado: Ganaste ${lastPrizeText} 🎉`;
        }

        const targetTime = parseInt(lastTimeTimestamp) + COOLDOWN_MS;
        const interval = setInterval(() => {
            const remaining = targetTime - Date.now();
            if (remaining <= 0) {
                clearInterval(interval);
                location.reload(); 
            } else {
                const h = Math.floor((remaining / (1000 * 60 * 60)) % 24);
                const m = Math.floor((remaining / (1000 * 60)) % 60);
                const s = Math.floor((remaining / 1000) % 60);
                timerDisplay.innerText = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            }
        }, 1000);
    }

    // ==========================================
    // JUEGO
    // ==========================================
    function startGame() {
        loginScreen.classList.add('hidden');
        gameWrapper.classList.remove('hidden');
        loginMessage.style.display = 'block'; 
        welcomeUser.innerText = attemptsCount === 0 ? `HOLA, ${currentUser.toUpperCase()}` : `¡INTENTO EXTRA! 🍀`;
        if(attemptsCount > 0) welcomeUser.style.color = '#ffd700';
        initBoard();
    }

    function initBoard() {
        gridContainer.innerHTML = '';
        boardItems = [];
        revealedIndices.clear();
        isGameOver = false;

        for (let i = 0; i < 9; i++) {
            boardItems.push(symbols[Math.floor(Math.random() * symbols.length)]);
        }

        boardItems.forEach((symbol, index) => {
            const card = document.createElement('div');
            card.classList.add('card');
            
            const symbolSpan = document.createElement('span');
            symbolSpan.innerText = symbol;
            card.appendChild(symbolSpan);

            const canvas = document.createElement('canvas');
            canvas.width = 75; canvas.height = 75;
            const ctx = canvas.getContext('2d');

            let grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grd.addColorStop(0, '#6a009e'); grd.addColorStop(1, '#6a009e');
            ctx.fillStyle = grd; ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#ffd700'; ctx.font = 'bold 24px Arial';
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText('$', canvas.width/2, canvas.height/2); 

            let isDrawing = false;
            function scratch(x, y) {
                if (isGameOver) return;
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2, false); ctx.fill();
                if (Math.random() > 0.6) createSparkle(x, y, canvas);
                if (navigator.vibrate && Math.random() > 0.8) navigator.vibrate(5);
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
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] === 0) transparentPixels++;
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

    async function saveResult(prizeValue) {
        const docRef = doc(db, "jugadores", currentUser);
        const now = Date.now();
        const gameData = {
            lastPlayed: now,
            fechaLegible: new Date(now).toLocaleString(),
            lastPrize: prizeValue, 
            username: currentUser
        };
        try { await setDoc(docRef, gameData, { merge: true }); } catch (e) { console.error(e); }
    }

    // ======================================================
    // 3. FUNCIÓN DE DISCORD
    // ======================================================
    function sendToDiscord(username, prizeValue, isWin) {
        if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("PEGA_AQUI")) return;

        const now = new Date();
        const timeString = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        let contentText = "";
        let color = 0; 

        if (isWin) {
            contentText = `🎉 **¡NUEVO GANADOR!**\nEl jugador **${username}** ha jugado al rasca y gana y ganó el premio de **${prizeValue}** a las ${timeString} hs.`;
            color = 16766720; 
        } else {
            contentText = `📉 **Intento fallido**\nEl jugador **${username}** ha jugado al rasca y gana y no tuvo suerte a las ${timeString} hs.`;
            color = 15548997; 
        }

        const payload = {
            content: null, 
            embeds: [
                {
                    title: isWin ? "🎰 ¡TENEMOS PREMIO! 🎰" : "🍀 ¡Suerte para la próxima!",
                    description: contentText,
                    color: color,
                    footer: { text: "Raspa Padrino Casino" },
                    timestamp: new Date().toISOString()
                }
            ]
        };

        fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Error enviando a Discord:", err));
    }

    // ======================================================
    // MODIFICACIONES DE ASYNC/AWAIT AQUÍ ABAJO
    // ======================================================
    
    // Agregamos 'async' para poder esperar el guardado
    async function triggerWin(prize) {
        isGameOver = true;
        
        // ⚠️ CLAVE: 'await' obliga a esperar que Firebase confirme el guardado
        await saveResult(prize.value); 
        
        sendToDiscord(currentUser, prize.value, true);

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
                        Manda una captura por privado para reclamar.
                    </p>
                </div>
            `,
            icon: 'success',
            background: '#12001f', color: '#fff',
            confirmButtonText: '¡Listo!', confirmButtonColor: '#d4af37',
            allowOutsideClick: false
        }).then(() => location.reload());
    }

    // Agregamos 'async' aquí también
    async function triggerLose() {
        isGameOver = true;
        attemptsCount++; 

        if (attemptsCount < MAX_ATTEMPTS) {
            Swal.fire({
                title: '¡CASI LO TIENES!',
                html: `El Padrino te regala una segunda oportunidad... 🎩`,
                icon: 'info',
                background: '#12001f', color: '#fff',
                confirmButtonText: '¡Jugar de nuevo!', confirmButtonColor: '#00c853',
                allowOutsideClick: false
            }).then(() => startGame());
        } else {
            // ⚠️ CLAVE: Esperamos el guardado antes de mostrar el mensaje final
            await saveResult(null);
            
            sendToDiscord(currentUser, "NADA", false);

            Swal.fire({
                title: 'Fin del juego',
                text: 'Hoy no tuviste suerte. ¡Vuelve en 24 horas!',
                icon: 'error',
                background: '#12001f', color: '#fff',
                confirmButtonText: 'Entendido', confirmButtonColor: '#6a009e',
                allowOutsideClick: false
            }).then(() => location.reload());
        }
    }

    function createSparkle(x, y, c) {
        const s = document.createElement('div'); s.classList.add('sparkle');
        const r = c.getBoundingClientRect(); s.style.left=(r.left+x)+'px'; s.style.top=(r.top+y)+'px';
        document.body.appendChild(s); setTimeout(()=>s.remove(),600);
    }
    function launchConfetti() {
        const e = Date.now()+3000;
        (function f(){
            confetti({particleCount:5,angle:60,spread:55,origin:{x:0},colors:['#ffd700','#fff']});
            confetti({particleCount:5,angle:120,spread:55,origin:{x:1},colors:['#ffd700','#fff']});
            if(Date.now()<e)requestAnimationFrame(f);
        }());
    }
});