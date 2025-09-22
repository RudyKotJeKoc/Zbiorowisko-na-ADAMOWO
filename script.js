// Stream URL configuration - Replace with actual stream URL when available
const STREAM_URL = 'https://radio-adamowo.example.com/stream.m3u8';

document.addEventListener('DOMContentLoaded', () => {
    const doc = document;

    // --- PWA Install Banner ---
    let deferredPrompt = null;
    const pwaBanner = doc.getElementById('pwa-install-banner');
    const pwaBtn = doc.getElementById('pwa-install-btn');
    
    // Obsługa beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (pwaBanner) pwaBanner.classList.remove('hidden');
    });
    
    if (pwaBtn) {
        pwaBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    if (pwaBanner) pwaBanner.classList.add('hidden');
                }
                deferredPrompt = null;
            }
        });
    }

    // --- DOM Elements ---
    const radioPlayer = doc.getElementById('radio-player');
    const podcastPlayer = doc.getElementById('podcast-player');
    const startBtn = doc.getElementById('start-btn');
    const autoplayOverlay = doc.getElementById('autoplay-overlay');
    const visualizerCanvas = doc.getElementById('visualizer-canvas');
    const mobileMenu = doc.getElementById('mobile-menu');
    
    // --- Application State ---
    let audioContext, audioSource, analyser, gainNode;
    let isAudioInitialized = false;
    let isPlaying = false;
    let animationId;
    let csrfToken = '';
    let hls = null;

    // Playlist data structure with proper mapping from uploaded playlist
    const playlists = {
        ambient: [],
        disco: [],
        hiphop: [],
        barbara: [],
        kids: [],
        full: [],
        podcasts: []
    };
    
    let currentRadioPlaylist = [];
    let currentRadioIndex = 0;

    // --- Load Playlist from JSON ---
    async function loadPlaylistFromJSON() {
        try {
            const response = await fetch('playlist.json');
            if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
            
            const playlistData = await response.json();
            
            // Process the playlist data and categorize
            playlistData.forEach(item => {
                const track = {
                    title: generateTitleFromFilename(item.file),
                    artist: "Radio Adamowo",
                    url: item.file,
                    category: item.category
                };
                
                // Add to appropriate category
                if (playlists[item.category]) {
                    playlists[item.category].push(track);
                }
                
                // Add to full playlist
                playlists.full.push(track);
                
                // Create podcasts from audio category
                if (item.category === 'audio') {
                    const podcastTrack = {
                        id: generateIdFromFilename(item.file),
                        title: generatePodcastTitle(item.file),
                        url: item.file
                    };
                    playlists.podcasts.push(podcastTrack);
                }
            });
            
            console.log('Playlist loaded successfully:', {
                ambient: playlists.ambient.length,
                disco: playlists.disco.length,
                hiphop: playlists.hiphop.length,
                barbara: playlists.barbara.length,
                kids: playlists.kids.length,
                full: playlists.full.length,
                podcasts: playlists.podcasts.length
            });
            
        } catch (error) {
            console.error('Failed to load playlist:', error);
            // Fallback to demo data
            initializeFallbackPlaylists();
        }
    }

    function generateTitleFromFilename(filepath) {
        if (!filepath || typeof filepath !== 'string') return 'Utwór bez tytułu';
        
        const filename = filepath.split('/').pop();
        if (!filename) return 'Utwór bez tytułu';
        
        let title = filename.replace(/\.mp3$/i, '');
        title = title.replace(/Utwor\s*\((\d+)\)/i, 'Utwór $1');
        title = title.replace(/_/g, ' ');
        title = title.replace(/\b\w/g, l => l.toUpperCase());
        
        return title || 'Utwór bez tytułu';
    }

    function generateIdFromFilename(filepath) {
        if (!filepath || typeof filepath !== 'string') return 'track';
        
        const filename = filepath.split('/').pop();
        return filename.replace(/\.mp3$/i, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }

    function generatePodcastTitle(filepath) {
        if (!filepath || typeof filepath !== 'string') return 'Podcast';
        
        const filename = filepath.split('/').pop();
        let title = filename.replace(/\.mp3$/i, '');
        title = title.replace(/_/g, ' ');
        title = title.replace(/\b\w/g, l => l.toUpperCase());
        
        return title || 'Podcast';
    }

    function initializeFallbackPlaylists() {
        playlists.ambient = [
            { title: "Ambient Soundscape #1", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
            { title: "Dark Atmosphere #2", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" }
        ];
        
        playlists.disco = [
            { title: "Disco Fever #1", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
            { title: "Disco Fever #2", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3" }
        ];
        
        playlists.hiphop = [
            { title: "Hip-Hop Flow #1", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
            { title: "Hip-Hop Flow #2", artist: "Radio Adamowo", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3" }
        ];
        
        playlists.full = [...playlists.ambient, ...playlists.disco, ...playlists.hiphop];
        
        playlists.podcasts = [
            { id: 'sprawaAdamskich', title: "Sprawa Adamskich: Wprowadzenie", url: 'audio/Adamskich_Sprawa.mp3' },
            { id: 'niewdziecznosc', title: "'Rażąca Niewdzięczność': Broń Narcyza", url: 'audio/Rażąca_Niewdzięczność.mp3' },
            { id: 'kalendarzAnaliza', title: "Analiza Kalendarza: Kronika Eskalacji", url: 'audio/kalendarz_analiza.mp3' },
            { id: 'sledztwo', title: "Śledztwo: Jak Dokumentować Manipulację?", url: 'audio/sledztwo.mp3' }
        ];
    }

    // --- HLS.js Integration ---
    function initializeHLS() {
        if (window.Hls && window.Hls.isSupported()) {
            hls = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 90
            });
            
            hls.loadSource(STREAM_URL);
            hls.attachMedia(radioPlayer);
            
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest loaded, found ' + hls.levels.length + ' quality level(s)');
            });
            
            hls.on(window.Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                if (data.fatal) {
                    switch(data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Fatal network error encountered, try to recover');
                            hls.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Fatal media error encountered, try to recover');
                            hls.recoverMediaError();
                            break;
                        default:
                            console.log('Fatal error, cannot recover');
                            hls.destroy();
                            break;
                    }
                }
            });
        } else if (radioPlayer && radioPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS support
            radioPlayer.src = STREAM_URL;
            console.log('Using native HLS support (Safari)');
        } else {
            console.warn('HLS not supported, falling back to regular audio');
        }
    }

    // --- Media Session API ---
    function updateMediaSession(title, artist = 'Radio Adamowo') {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                album: 'Radio Adamowo',
                artwork: [
                    { src: 'public/images/studio/studio-1.png', sizes: '96x96', type: 'image/png' },
                    { src: 'public/images/studio/studio-1.png', sizes: '128x128', type: 'image/png' },
                    { src: 'public/images/studio/studio-1.png', sizes: '192x192', type: 'image/png' },
                    { src: 'public/images/studio/studio-1.png', sizes: '256x256', type: 'image/png' },
                    { src: 'public/images/studio/studio-1.png', sizes: '384x384', type: 'image/png' },
                    { src: 'public/images/studio/studio-1.png', sizes: '512x512', type: 'image/png' },
                ]
            });

            navigator.mediaSession.setActionHandler('play', () => {
                if (radioPlayer) radioPlayer.play();
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                if (radioPlayer) radioPlayer.pause();
            });
            
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                playRadioTrack(currentRadioIndex - 1);
            });
            
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                playRadioTrack(currentRadioIndex + 1);
            });
        }
    }

    // Fetch CSRF token on load
    async function fetchCsrfToken() {
        try {
            const response = await fetch('/get_csrf_token.php');
            if (!response.ok) throw new Error('Failed to fetch CSRF token');
            const data = await response.json();
            csrfToken = data.token;
        } catch (error) {
            console.error('CSRF token fetch error:', error);
            // Continue without CSRF token for static deployment
        }
    }

    // --- Audio Initialization ---
    async function initializeAudio() {
        if (isAudioInitialized) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            gainNode = audioContext.createGain();
            gainNode.gain.value = 1;

            if (radioPlayer) {
                audioSource = audioContext.createMediaElementSource(radioPlayer);
                audioSource.connect(gainNode).connect(analyser).connect(audioContext.destination);
            }
            
            isAudioInitialized = true;
            console.log("Web Audio API initialized successfully.");
            
            // Enable controls and start visualizer
            doc.querySelectorAll('#radio-prev-btn, #radio-play-pause-btn, #radio-next-btn').forEach(btn => {
                if (btn) btn.disabled = false;
            });
            setupVisualizer();
        } catch (e) {
            console.error("Could not initialize Web Audio API:", e);
        }
    }

    // --- Visualizer ---
    function setupVisualizer() {
        if (!visualizerCanvas) return;
        
        const ctx = visualizerCanvas.getContext('2d');
        visualizerCanvas.width = window.innerWidth;
        visualizerCanvas.height = window.innerHeight;
        
        function drawVisualizer() {
            if (!analyser || !isPlaying) {
                requestAnimationFrame(drawVisualizer);
                return;
            }
            
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            
            const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * visualizerCanvas.height / 2;
                
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;
                
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
            
            animationId = requestAnimationFrame(drawVisualizer);
        }
        
        drawVisualizer();
    }
    
    // --- Player Logic ---
    const radioPlayPauseBtn = doc.getElementById('radio-play-pause-btn');
    const radioPlayIcon = doc.getElementById('radio-play-icon');
    const radioPauseIcon = doc.getElementById('radio-pause-icon');
    const radioNextBtn = doc.getElementById('radio-next-btn');
    const radioPrevBtn = doc.getElementById('radio-prev-btn');
    const radioCurrentSongEl = doc.getElementById('radio-current-song');

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function setRadioPlaylist(playlistKey) {
        currentRadioPlaylist = [...(playlists[playlistKey] || [])];
        shuffleArray(currentRadioPlaylist);
        currentRadioIndex = 0;
        
        // Update active tab
        doc.querySelectorAll('.playlist-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = doc.querySelector(`[data-playlist="${playlistKey}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        if (radioCurrentSongEl) {
            radioCurrentSongEl.textContent = `Wybrano playlistę: ${playlistKey} (${currentRadioPlaylist.length} utworów).`;
        }
        
        if (isPlaying) {
            playRadioTrack(0);
        }
    }

    function playRadioTrack(index) {
        if (!isAudioInitialized || !currentRadioPlaylist || currentRadioPlaylist.length === 0) {
            if (radioCurrentSongEl) radioCurrentSongEl.textContent = "Wybierz najpierw playlistę.";
            return;
        }
        currentRadioIndex = (index + currentRadioPlaylist.length) % currentRadioPlaylist.length;
        const track = currentRadioPlaylist[currentRadioIndex];
        
        // Clean up existing HLS instance if switching to regular audio
        if (hls && !track.url.includes('.m3u8')) {
            hls.destroy();
            hls = null;
        }
        
        // Use HLS for streaming, regular audio for files
        if (track.url.includes('.m3u8')) {
            initializeHLS();
        } else {
            if (radioPlayer) radioPlayer.src = track.url;
        }
        
        if (radioPlayer) {
            radioPlayer.play().catch(e => console.error("Playback error:", e));
        }
        if (radioCurrentSongEl) {
            radioCurrentSongEl.textContent = `${track.title} - ${track.artist}`;
        }
        updateMediaSession(track.title, track.artist);
    }

    async function togglePlayPause() {
        if (!isAudioInitialized) return;
        if (audioContext && audioContext.state === 'suspended') await audioContext.resume();
        if (isPlaying) {
            if (radioPlayer) radioPlayer.pause();
        } else {
            if (radioPlayer) radioPlayer.play().catch(e => console.error("Play error:", e));
        }
    }

    // --- Note Modal ---
    const noteModal = doc.getElementById('note-modal');
    const noteDateInput = doc.getElementById('note-date');
    const noteNameInput = doc.getElementById('note-name');
    const noteTextInput = doc.getElementById('note-text');
    const noteFeedback = doc.getElementById('note-feedback');
    const noteForm = doc.getElementById('note-form');

    function openModal(date) {
        if (noteDateInput) noteDateInput.value = date;
        if (noteModal) noteModal.classList.remove('hidden');
        if (noteNameInput) noteNameInput.focus();
    }

    function closeModal() {
        if (noteModal) noteModal.classList.add('hidden');
        if (noteForm) noteForm.reset();
        if (noteFeedback) noteFeedback.textContent = '';
    }

    if (noteForm) {
        noteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const date = noteDateInput ? noteDateInput.value : '';
            const name = noteNameInput ? noteNameInput.value.trim() : '';
            const text = noteTextInput ? noteTextInput.value.trim() : '';

            if (!date || name.length < 2 || name.length > 50 || text.length < 5 || text.length > 1000) {
                if (noteFeedback) {
                    noteFeedback.textContent = 'Nieprawidłowe dane. Sprawdź pola.';
                    noteFeedback.className = 'text-red-500 text-sm mt-2';
                }
                return;
            }

            // For static deployment, use localStorage
            try {
                const notes = JSON.parse(localStorage.getItem('notes') || '[]');
                notes.push({ date, name, text, timestamp: new Date().toISOString() });
                localStorage.setItem('notes', JSON.stringify(notes));
                
                if (noteFeedback) {
                    noteFeedback.textContent = 'Notatka zapisana lokalnie!';
                    noteFeedback.className = 'text-green-500 text-sm mt-2';
                }
                setTimeout(closeModal, 2000);
            } catch (error) {
                console.error('Note save error:', error);
                if (noteFeedback) {
                    noteFeedback.textContent = `Błąd: ${error.message}`;
                    noteFeedback.className = 'text-red-500 text-sm mt-2';
                }
            }
        });
    }
    
    const modalCloseBtn = doc.getElementById('modal-close-btn');
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    // --- AI Simulator ---
    const chatForm = doc.getElementById('chat-form');
    const chatInput = doc.getElementById('chat-input');
    const chatContainer = doc.getElementById('chat-container');
    const aiResponses = [
        "Przesadzasz, jesteś zbyt wrażliwa/y.", 
        "Nigdy czegoś takiego nie powiedziałem/am.", 
        "Robię to dla twojego dobra.", 
        "Gdybyś tylko bardziej się starał/a...", 
        "Wszyscy myślą, że zwariowałeś/aś.", 
        "Po tym wszystkim, co dla ciebie zrobiłem/am...",
        "To ty masz problem, nie ja.",
        "Zawsze wszystko przekręcasz.",
        "Jesteś niewdzięczny/a po tym wszystkim.",
        "Nikt cię nie zrozumie tak jak ja."
    ];
    
    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = chatInput ? chatInput.value.trim() : '';
            if (!msg) return;
            appendChatMessage(msg, 'user');
            if (chatInput) chatInput.value = '';
            setTimeout(() => {
                const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];
                appendChatMessage(response, 'ai');
            }, 1000 + Math.random() * 500);
        });
    }

    function appendChatMessage(text, sender) {
        if (!chatContainer) return;
        const msgWrapper = document.createElement('div');
        msgWrapper.className = sender === 'user' ? 'text-right' : 'text-left';
        
        const msgBubble = document.createElement('span');
        msgBubble.textContent = sender === 'user' ? `Ty: ${text}` : `AI: ${text}`;
        msgBubble.className = sender === 'user' 
            ? 'inline-block bg-amber-500 text-black px-3 py-2 rounded-lg' 
            : 'inline-block bg-gray-700 text-gray-200 px-3 py-2 rounded-lg';

        msgWrapper.appendChild(msgBubble);
        chatContainer.appendChild(msgWrapper);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    // --- Event Listeners ---
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (autoplayOverlay) {
                autoplayOverlay.style.opacity = '0';
                setTimeout(() => autoplayOverlay.classList.add('hidden'), 500);
            }
            initializeAudio().then(() => {
                loadPlaylistFromJSON();
            });
        });
    }

    // Player controls
    if (radioPlayPauseBtn) radioPlayPauseBtn.addEventListener('click', togglePlayPause);
    if (radioNextBtn) radioNextBtn.addEventListener('click', () => playRadioTrack(currentRadioIndex + 1));
    if (radioPrevBtn) radioPrevBtn.addEventListener('click', () => playRadioTrack(currentRadioIndex - 1));
    
    if (radioPlayer) {
        radioPlayer.addEventListener('ended', () => playRadioTrack(currentRadioIndex + 1));

        radioPlayer.addEventListener('play', () => {
            isPlaying = true;
            if (radioPlayIcon) radioPlayIcon.classList.add('hidden');
            if (radioPauseIcon) radioPauseIcon.classList.remove('hidden');
        });

        radioPlayer.addEventListener('pause', () => {
            isPlaying = false;
            if (radioPlayIcon) radioPlayIcon.classList.remove('hidden');
            if (radioPauseIcon) radioPauseIcon.classList.add('hidden');
        });
    }

    doc.querySelectorAll('.playlist-btn').forEach(button => {
        button.addEventListener('click', () => {
            setRadioPlaylist(button.dataset.playlist);
        });
    });

    doc.querySelectorAll('.podcast-play-button').forEach(button => {
        button.addEventListener('click', () => {
            if (!isAudioInitialized) return;
            const track = playlists.podcasts.find(t => t.id === button.dataset.trackId);
            if (track && podcastPlayer) {
                if (radioPlayer) radioPlayer.pause();
                podcastPlayer.src = track.url;
                const podcastTitle = doc.getElementById('podcast-title');
                if (podcastTitle) podcastTitle.textContent = track.title;
                podcastPlayer.play().catch(e => console.error("Podcast playback error:", e));
            }
        });
    });
    
    // Mobile menu toggle
    const menuToggle = doc.getElementById('menu-toggle');
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }
    
    // Close mobile menu on link click
    doc.querySelectorAll('.nav-link-mobile').forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.classList.add('hidden');
        });
    });

    // To Top Button
    const toTopButton = doc.getElementById('to-top-button');
    if (toTopButton) {
        window.addEventListener('scroll', () => toTopButton.classList.toggle('hidden', window.scrollY <= 300));
        toTopButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
    
    // Update current year
    const currentYearEl = doc.getElementById('current-year');
    if (currentYearEl) currentYearEl.textContent = new Date().getFullYear();
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered:', reg))
                .catch(err => console.error('Service Worker registration failed:', err));
        });
    }

    // Window resize handler for visualizer
    window.addEventListener('resize', () => {
        if (visualizerCanvas) {
            visualizerCanvas.width = window.innerWidth;
            visualizerCanvas.height = window.innerHeight;
        }
    });

    // Initial fetches
    fetchCsrfToken();
});