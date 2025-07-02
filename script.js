document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen UI ---
    const loadingScreen = document.getElementById('loading-screen');
    const loadingText = document.getElementById('loading-text');
    const startButton = document.getElementById('startButton');
    const gameUI = document.getElementById('game-ui');
    const songTitleDisplay = document.getElementById('song-title');
    const scoreDisplay = document.getElementById('score-display');
    const gameContainer = document.getElementById('game-container');
    const lanes = document.querySelectorAll('.lane');
    const comboDisplay = document.getElementById('combo-display');

    // --- Konfigurasi dan State Game ---
    const songMapPath = 'assets/maps/my-song-map.json'; // Path ke peta lagu
    let songMap = null;
    let audio = null;
    let score = 0;
    let combo = 0;
    let nextEventIndex = 0;
    
    // Waktu toleransi untuk pukulan (dalam detik)
    const timingWindows = {
        perfect: 0.08,
        good: 0.12,
        ok: 0.16
    };

    // --- Inisialisasi Game ---
    async function initialize() {
        try {
            // Muat peta lagu
            const response = await fetch(songMapPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            songMap = await response.json();

            // Muat file audio
            audio = new Audio(songMap.audioFile);
            
            // Tunggu hingga audio siap dimainkan
            audio.addEventListener('canplaythrough', () => {
                loadingText.textContent = 'Game Ready!';
                startButton.style.display = 'block';
            }, { once: true });

            audio.load(); // Mulai memuat audio

        } catch (error) {
            loadingText.textContent = `Error: Failed to load game assets. ${error.message}`;
            console.error("Initialization failed:", error);
        }
    }

    startButton.addEventListener('click', startGame);

    // --- Logika Inti Game ---
    function startGame() {
        // Reset state
        score = 0;
        combo = 0;
        nextEventIndex = 0;
        scoreDisplay.textContent = 'Score: 0';
        songTitleDisplay.textContent = `${songMap.artist} - ${songMap.songTitle}`;

        // Sembunyikan menu, tampilkan game
        loadingScreen.classList.add('hidden');
        gameUI.classList.remove('hidden');

        // Tunggu sedikit sebelum mulai untuk sinkronisasi
        setTimeout(() => {
            audio.play();
            requestAnimationFrame(gameLoop);
        }, 500); // 0.5 detik delay
    }

    function gameLoop() {
        if (audio.paused || audio.ended) {
            // Game selesai, bisa tambahkan layar hasil di sini
            console.log("Game Over! Final Score:", score);
            return;
        }

        const elapsedTime = audio.currentTime;

        // 1. Munculkan Notes
        while (songMap.events[nextEventIndex] && songMap.events[nextEventIndex].time <= elapsedTime + songMap.noteSpeed) {
            spawnNote(songMap.events[nextEventIndex]);
            nextEventIndex++;
        }

        // 2. Gerakkan dan Hapus Notes
        document.querySelectorAll('.note').forEach(note => {
            const noteTime = parseFloat(note.dataset.time);
            const timeDiff = noteTime - elapsedTime;

            // Hapus note jika terlewat (miss)
            if (timeDiff < -timingWindows.ok) {
                note.remove();
                handleMiss();
            } else {
                // Update posisi Y
                const progress = 1 - (timeDiff / songMap.noteSpeed);
                const strikeLinePos = gameContainer.clientHeight * 0.90; // 90% from top
                note.style.top = (progress * strikeLinePos) + 'px';
            }
        });

        requestAnimationFrame(gameLoop);
    }
    
    function spawnNote(event) {
        const noteElement = document.createElement('div');
        noteElement.classList.add('note');
        noteElement.dataset.time = event.time;
        noteElement.dataset.lane = event.lane;
        noteElement.style.backgroundImage = `url(assets/images/${event.instrument}.png)`;
        
        const targetLane = document.querySelector(`.lane[data-lane="${event.lane}"]`);
        if (targetLane) {
            targetLane.appendChild(noteElement);
        }
    }

    // --- Penanganan Input Pemain ---
    document.addEventListener('keydown', (e) => {
        if (audio.paused) return;
        const key = e.key.toUpperCase();
        let targetLaneNum = 0;

        if (key === 'D') targetLaneNum = 1;
        if (key === 'F') targetLaneNum = 2;
        if (key === 'J') targetLaneNum = 3;
        if (key === 'K') targetLaneNum = 4;

        if (targetLaneNum > 0) {
            checkHit(targetLaneNum);
            // Animasi feedback visual untuk lane
            const laneElement = document.querySelector(`.lane[data-lane="${targetLaneNum}"]`);
            laneElement.classList.add('active');
            setTimeout(() => laneElement.classList.remove('active'), 100);
        }
    });

    function checkHit(laneNum) {
        const elapsedTime = audio.currentTime;
        const notesInLane = document.querySelectorAll(`.note[data-lane="${laneNum}"]`);
        
        let bestCandidate = null;
        let smallestDiff = Infinity;

        // Cari note terdekat dengan garis pukul
        notesInLane.forEach(note => {
            const diff = Math.abs(parseFloat(note.dataset.time) - elapsedTime);
            if (diff < smallestDiff) {
                smallestDiff = diff;
                bestCandidate = note;
            }
        });

        if (bestCandidate && smallestDiff <= timingWindows.ok) {
            let hitType = '';
            if (smallestDiff <= timingWindows.perfect) {
                score += 100;
                combo++;
                hitType = 'Perfect!';
            } else if (smallestDiff <= timingWindows.good) {
                score += 50;
                combo++;
                hitType = 'Good';
            } else {
                score += 20;
                combo++;
                hitType = 'OK';
            }
            showCombo(hitType, combo);
            scoreDisplay.textContent = `Score: ${score}`;
            bestCandidate.remove();
        }
    }
    
    function handleMiss() {
        combo = 0;
        showCombo('Miss', combo);
    }

    function showCombo(text, count) {
        if(count > 1) {
             comboDisplay.textContent = `${text}\n${count} Combo`;
        } else {
             comboDisplay.textContent = text;
        }
       
        comboDisplay.classList.add('show');
        setTimeout(() => comboDisplay.classList.remove('show'), 300);
    }

    // --- Mulai proses pemuatan saat halaman dimuat ---
    initialize();
});
