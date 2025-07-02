document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen UI ---
    const selectionScreen = document.getElementById('selection-screen');
    const songListContainer = document.getElementById('song-list');
    const loadingText = document.getElementById('loading-text');
    const songStatus = document.getElementById('song-status');
    const startButton = document.getElementById('startButton');
    
    const gameUI = document.getElementById('game-ui');
    const songTitleDisplay = document.getElementById('song-title-display');
    const scoreDisplay = document.getElementById('score-display');
    const lanes = document.querySelectorAll('.lane');
    const comboDisplay = document.getElementById('combo-display');
    const drumParts = {
        1: document.getElementById('hihat-hit-img'),
        2: document.getElementById('kick-hit-img'),
        3: document.getElementById('snare-hit-img'),
        4: document.getElementById('tom-hit-img')
    };

    // --- State Game ---
    let songDatabase = null; // Akan menyimpan seluruh file JSON
    let songMap = null; // Akan menyimpan data lagu yang SEDANG DIPILIH
    let audio = null;
    let score = 0;
    let combo = 0;
    let nextEventIndex = 0;
    const timingWindows = { perfect: 0.08, good: 0.12, ok: 0.16 };
    let selectedSongInfo = null;

    // --- ALUR GAME BARU ---

    // 1. Inisialisasi: Muat SATU file database lagu
    async function initialize() {
        try {
            const response = await fetch('songs-database.json');
            if (!response.ok) throw new Error('Could not load song database.');
            songDatabase = await response.json();
            buildSongList(songDatabase.songs);
        } catch (error) {
            loadingText.textContent = `Error: ${error.message}`;
        }
    }

    // 2. Bangun UI pemilihan lagu
    function buildSongList(songs) {
        loadingText.classList.add('hidden');
        songs.forEach(song => {
            const songButton = document.createElement('button');
            songButton.classList.add('song-item');
            songButton.innerHTML = `${song.title} <br><span class="artist">${song.artist}</span>`;
            // Simpan ID unik lagu di tombol
            songButton.dataset.songId = song.id;

            songButton.addEventListener('click', () => {
                document.querySelectorAll('.song-item').forEach(btn => btn.classList.remove('selected'));
                songButton.classList.add('selected');
                
                // Panggil fungsi untuk memuat aset berdasarkan ID lagu
                loadSongAssets(song.id);
            });
            songListContainer.appendChild(songButton);
        });
    }

    // 3. Muat aset untuk lagu yang dipilih (HANYA audio, karena peta sudah ada)
    function loadSongAssets(songId) {
        songStatus.textContent = 'Loading song...';
        startButton.classList.add('hidden');

        // Cari data lagu lengkap dari database yang sudah dimuat
        const songData = songDatabase.songs.find(s => s.id === songId);
        
        if (!songData) {
            songStatus.textContent = "Error: Song not found!";
            return;
        }

        // Simpan data lagu yang dipilih ke state game
        songMap = songData;
        selectedSongInfo = { title: songData.title, artist: songData.artist };
        
        // Hentikan audio sebelumnya jika ada
        if (audio) {
            audio.pause();
            audio = null;
        }

        audio = new Audio(songData.audioFile);
        audio.addEventListener('canplaythrough', () => {
            songStatus.textContent = 'Ready to play!';
            startButton.classList.remove('hidden');
        }, { once: true });
        audio.load();
    }

    // 4. Mulai Game setelah tombol Start ditekan
    function startGame() {
        if (!songMap || !audio) return;
        score = 0; combo = 0; nextEventIndex = 0;
        scoreDisplay.textContent = 'Score: 0';
        songTitleDisplay.textContent = `${selectedSongInfo.artist} - ${selectedSongInfo.title}`;
        selectionScreen.classList.add('hidden');
        gameUI.classList.remove('hidden');
        setTimeout(() => {
            audio.play();
            requestAnimationFrame(gameLoop);
        }, 500);
    }
    
    startButton.addEventListener('click', startGame);

    // --- LOGIKA INTI GAME (Tidak ada perubahan di bawah ini) ---
    function gameLoop() {
        if (audio.paused || audio.ended) return;
        const elapsedTime = audio.currentTime;
        while (songMap.events[nextEventIndex] && songMap.events[nextEventIndex].time <= elapsedTime + songMap.noteSpeed) {
            spawnNote(songMap.events[nextEventIndex]);
            nextEventIndex++;
        }
        document.querySelectorAll('.note').forEach(note => {
            const noteTime = parseFloat(note.dataset.time);
            const timeDiff = noteTime - elapsedTime;
            if (timeDiff < -timingWindows.ok) {
                note.remove();
                handleMiss();
            } else {
                const strikeLinePos = gameContainer.clientHeight * 0.85;
                note.style.top = (1 - (timeDiff / songMap.noteSpeed)) * strikeLinePos + 'px';
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
        if (targetLane) targetLane.appendChild(noteElement);
    }
    
    lanes.forEach(lane => {
        lane.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (audio.paused) return;
            const targetLaneNum = parseInt(lane.dataset.lane, 10);
            if (targetLaneNum > 0) {
                checkHit(targetLaneNum);
                triggerDrumVisual(targetLaneNum);
                lane.classList.add('active');
                setTimeout(() => lane.classList.remove('active'), 100);
            }
        });
    });

    function triggerDrumVisual(laneNum) {
        const part = drumParts[laneNum];
        if (part) {
            part.classList.add('active');
            setTimeout(() => part.classList.remove('active'), 100);
        }
    }

    function checkHit(laneNum) {
        const elapsedTime = audio.currentTime;
        const notesInLane = document.querySelectorAll(`.note[data-lane="${laneNum}"]`);
        let bestCandidate = null;
        let smallestDiff = Infinity;
        notesInLane.forEach(note => {
            const diff = Math.abs(parseFloat(note.dataset.time) - elapsedTime);
            if (diff < smallestDiff) { smallestDiff = diff; bestCandidate = note; }
        });
        if (bestCandidate && smallestDiff <= timingWindows.ok) {
            let hitType = '';
            if (smallestDiff <= timingWindows.perfect) { score += 100; combo++; hitType = 'Perfect!'; } 
            else if (smallestDiff <= timingWindows.good) { score += 50; combo++; hitType = 'Good'; } 
            else { score += 20; combo++; hitType = 'OK'; }
            showCombo(hitType, combo);
            scoreDisplay.textContent = `Score: ${score}`;
            bestCandidate.remove();
        }
    }
    
    function handleMiss() { combo = 0; showCombo('Miss', combo); }

    function showCombo(text, count) {
        comboDisplay.textContent = count > 1 ? `${text}\n${count} Combo` : text;
        comboDisplay.classList.add('show');
        setTimeout(() => comboDisplay.classList.remove('show'), 300);
    }
    
    // Mulai semuanya
    initialize();
});
