import { AudioPlayer } from './modules/audio/player.js';
import { I18nManager } from './modules/i18n/manager.js';
import { UtilsManager } from './modules/utils/helpers.js';

const PODCAST_LIBRARY = {
    niewdziecznosc: {
        title: '„Rażąca Niewdzięczność”: Broń Narcyza',
        description: 'Analiza, jak termin prawny staje się narzędziem gaslightingu.',
        duration: '08:24'
    },
    sledztwo: {
        title: 'Śledztwo: Jak dokumentować manipulację?',
        description: 'Praktyczny poradnik zbierania dowodów i ochrony siebie.',
        duration: '06:45'
    },
    sprawaAdamskich: {
        title: 'Sprawa Adamskich: Studium rodzinnej wojny',
        description: 'Przegląd kluczowych wydarzeń, które doprowadziły do eskalacji konfliktu.',
        duration: '09:12'
    },
    kalendarzAnaliza: {
        title: 'Kalendarz: Kronika eskalacji',
        description: 'Jak drobne incydenty układają się w spójny schemat przemocy.',
        duration: '07:03'
    }
};

const CHAT_PATTERNS = [
    {
        id: 'gaslighting',
        label: 'Gaslighting',
        severity: 'medium',
        responses: [
            'Naprawdę sądzisz, że to się wydarzyło? Twoja pamięć znowu płata ci figle.',
            'Widzę, że znowu przesadzasz. Wymyślasz historię, żeby robić dramat.'
        ],
        tip: 'Manipulator podważa twoją percepcję rzeczywistości.'
    },
    {
        id: 'guilt',
        label: 'Szantaż emocjonalny',
        severity: 'high',
        responses: [
            'Po tym wszystkim co dla ciebie zrobiłem, tak się odwdzięczasz?',
            'Jeśli naprawdę ci zależy, zrobisz to, o co proszę. Inaczej po prostu mnie zniszczysz.'
        ],
        tip: 'Zwróć uwagę na obwinianie i wywoływanie poczucia winy.'
    },
    {
        id: 'projection',
        label: 'Projekcja',
        severity: 'medium',
        responses: [
            'To ty zawsze wywołujesz konflikty, nie ja.',
            'Mówisz, że nie mam czasu? To ty znikasz, gdy cię potrzebuję.'
        ],
        tip: 'Manipulator przypisuje ci własne zachowania.'
    },
    {
        id: 'minimising',
        label: 'Minimalizowanie',
        severity: 'low',
        responses: [
            'Robisz z igły widły. To nic wielkiego.',
            'Każdemu się zdarza. Nie dramatyzuj.'
        ],
        tip: 'Bagatelizowanie emocji i doświadczeń ma odebrać ci pewność siebie.'
    }
];

const CHAT_SUGGESTIONS = {
    healthy: 'Widzę sytuację inaczej i mam prawo do własnych odczuć.',
    assertive: 'Nie pozwolę, byś mówił do mnie w taki sposób. Porozmawiajmy spokojnie.',
    vulnerable: 'To mnie rani. Potrzebuję chwili, żeby to przemyśleć.'
};

let beepDataUriPromise = null;

async function ensureBeepDataUri() {
    if (!beepDataUriPromise) {
        beepDataUriPromise = fetch('docs/beep.txt')
            .then(response => response.ok ? response.text() : '')
            .then(base64 => base64 ? `data:audio/wav;base64,${base64.trim()}` : null)
            .catch(() => null);
    }
    return beepDataUriPromise;
}

function buildVisualizerBars(count = 24) {
    const visualizer = document.querySelector('#visualizer');
    if (!visualizer || visualizer.childElementCount > 0) {
        return;
    }
    for (let i = 0; i < count; i += 1) {
        const bar = document.createElement('span');
        bar.className = 'bar';
        bar.style.setProperty('--bar-index', String(i));
        visualizer.appendChild(bar);
    }
}

async function setupI18n(utils) {
    const i18n = new I18nManager({
        defaultLanguage: 'pl',
        supportedLanguages: ['pl', 'en', 'nl']
    });

    i18n.on('loaded', () => {
        applyMetaTranslations(i18n);
        updateLanguageSwitcher(i18n.getCurrentLanguage());
    });

    i18n.on('languageChanged', ({ newLang }) => {
        updateLanguageSwitcher(newLang);
        applyMetaTranslations(i18n);
        utils.showToast(`Język zmieniono na ${newLang.toUpperCase()}.`, 'success');
    });

    await i18n.init();
    attachLanguageSwitcher(i18n, utils);

    return i18n;
}

function applyMetaTranslations(i18n) {
    const title = i18n.t('meta.title');
    if (title && typeof title === 'string') {
        document.title = title;
    }
    const description = i18n.t('meta.description');
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta && typeof description === 'string') {
        descriptionMeta.setAttribute('content', description);
    }
}

function attachLanguageSwitcher(i18n, utils) {
    const buttons = document.querySelectorAll('.language-switcher__btn');
    if (!buttons.length) {
        return;
    }

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const lang = button.getAttribute('data-lang');
            if (!lang) {
                return;
            }
            const switched = await i18n.setLanguage(lang);
            if (!switched) {
                utils.showToast('Nie udało się zmienić języka.', 'warning');
            }
        });
    });
}

function updateLanguageSwitcher(currentLang) {
    document.querySelectorAll('.language-switcher__btn').forEach(button => {
        const lang = button.getAttribute('data-lang');
        button.classList.toggle('language-switcher__btn--active', lang === currentLang);
    });
}

function setupNavigation() {
    const toggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('mobile-menu');
    if (!toggle || !menu) {
        return;
    }

    const closeMenu = () => {
        menu.classList.remove('main-nav__links--open');
        toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('main-nav__links--open');
        toggle.setAttribute('aria-expanded', String(isOpen));
    });

    menu.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', event => {
            const targetId = link.getAttribute('href');
            const target = targetId ? document.querySelector(targetId) : null;
            if (target) {
                event.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                closeMenu();
            }
        });
    });
}

function setupScrollToTop() {
    const button = document.getElementById('to-top-button');
    if (!button) {
        return;
    }

    const toggleVisibility = () => {
        if (window.scrollY > 320) {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });

    button.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function setupCurrentYear() {
    const yearElement = document.getElementById('current-year');
    if (yearElement) {
        yearElement.textContent = String(new Date().getFullYear());
    }
}

function setupPwaInstall(utils) {
    const banner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('pwa-install-btn');
    const dismissBtn = document.getElementById('pwa-dismiss-btn');
    if (!banner || !installBtn || !dismissBtn) {
        return;
    }

    let deferredPrompt = null;

    const hideBanner = () => {
        banner.classList.add('hidden');
    };

    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredPrompt = event;
        banner.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) {
            utils.showToast('Instalacja jest już dostępna w menu przeglądarki.', 'info');
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            utils.showToast('Dziękujemy! Radio Adamowo zostało zainstalowane.', 'success');
        } else {
            utils.showToast('Instalacja została przerwana.', 'warning');
        }
        hideBanner();
        deferredPrompt = null;
    });

    dismissBtn.addEventListener('click', hideBanner);

    window.addEventListener('appinstalled', () => {
        utils.showToast('Radio Adamowo działa jako aplikacja offline.', 'success');
        hideBanner();
    });
}

function registerServiceWorker(utils) {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {
        utils.showToast('Nie udało się zarejestrować trybu offline.', 'warning');
    });
}

function animateListenersCounter() {
    const listenersElement = document.getElementById('listeners-count');
    const communityUsers = document.getElementById('community-users');
    const communitySaved = document.getElementById('community-saved');
    if (!listenersElement) {
        return;
    }

    let currentListeners = 248;

    const update = () => {
        const delta = Math.floor(Math.random() * 15) - 7;
        currentListeners = Math.max(120, Math.min(540, currentListeners + delta));
        listenersElement.textContent = currentListeners.toLocaleString('pl-PL');

        if (communityUsers) {
            const value = 18204 + Math.floor(currentListeners / 4);
            communityUsers.textContent = value.toLocaleString('pl-PL');
        }
        if (communitySaved) {
            const value = 4112 + Math.floor(currentListeners / 12);
            communitySaved.textContent = value.toLocaleString('pl-PL');
        }
    };

    update();
    setInterval(update, 10000);
}

function setupAutoplayOverlay() {
    const overlay = document.getElementById('autoplay-overlay');
    if (!overlay) {
        return;
    }

    overlay.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            overlay.classList.add('hidden');
        }
    });
}

async function setupAudioPlayer(utils) {
    const player = new AudioPlayer({
        playlistUrl: 'playlist.json'
    });

    player.on('error', event => {
        const message = event && event.message ? event.message : 'Błąd odtwarzacza.';
        utils.showToast(message, 'error');
    });

    player.on('initialized', () => {
        utils.showToast('Odtwarzacz gotowy do startu.', 'success');
        const overlay = document.getElementById('autoplay-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    });

    player.on('trackChanged', ({ track }) => {
        if (track && track.file) {
            const title = player.generateTitle(track.file);
            utils.showToast(`Teraz gramy: ${title}`, 'info', 3500);
        }
    });

    player.on('playlistChanged', ({ category, trackCount }) => {
        utils.showToast(`Załadowano playlistę ${category} (${trackCount} utworów).`, 'success', 3000);
    });

    player.on('shuffleToggled', ({ enabled }) => {
        utils.showToast(enabled ? 'Losowe odtwarzanie włączone.' : 'Losowe odtwarzanie wyłączone.', 'info', 2500);
    });

    try {
        await player.init();
        return player;
    } catch (error) {
        console.error('Audio player failed to initialise', error);
        utils.showToast('Nie udało się uruchomić odtwarzacza audio.', 'error');
        return null;
    }
}

function setupMoodShortcuts(audioPlayer, utils) {
    const buttons = document.querySelectorAll('.mood-btn[data-mood-target]');
    if (!buttons.length) {
        return;
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-mood-target');
            if (!category) {
                return;
            }
            audioPlayer.switchPlaylist(category);
            utils.showToast(`Zmieniono nastrój na: ${category}.`, 'success', 2500);
        });
    });
}

function wirePlaybackPersistence(audioPlayer, utils) {
    const persist = () => {
        const state = audioPlayer.getPlaybackState();
        utils.setStorage('radio-adamowo-state', {
            playlist: state.currentPlaylist,
            index: state.currentIndex,
            isShuffled: state.isShuffled,
            timestamp: Date.now()
        });
    };

    ['trackChanged', 'playlistChanged', 'shuffleToggled'].forEach(event => {
        audioPlayer.on(event, persist);
    });
}

async function restorePlaybackState(audioPlayer, utils) {
    const saved = utils.getStorage('radio-adamowo-state');
    if (!saved) {
        return;
    }

    const available = audioPlayer.getAvailablePlaylists();
    if (saved.playlist && available.includes(saved.playlist)) {
        audioPlayer.switchPlaylist(saved.playlist);
    }

    if (Number.isInteger(saved.index)) {
        audioPlayer.loadTrack(saved.index);
    }

    if (saved.isShuffled && !audioPlayer.getPlaybackState().isShuffled) {
        audioPlayer.toggleShuffle();
    }
}

async function setupPodcastPlayer(utils) {
    const audio = document.getElementById('podcast-player');
    const title = document.getElementById('podcast-title');
    const buttons = document.querySelectorAll('.podcast-play-button');
    if (!audio || !title || !buttons.length) {
        return;
    }

    const beepSrc = await ensureBeepDataUri();

    buttons.forEach(button => {
        button.addEventListener('click', async () => {
            const trackId = button.getAttribute('data-track-id');
            const track = trackId ? PODCAST_LIBRARY[trackId] : null;
            if (!track) {
                utils.showToast('Nagranie jest w przygotowaniu.', 'warning');
                return;
            }

            const source = track.src || beepSrc;
            if (!source) {
                utils.showToast('Nie można odtworzyć nagrania.', 'error');
                return;
            }

            audio.src = source;
            audio.setAttribute('aria-label', track.title);
            title.textContent = `${track.title}${track.duration ? ` • ${track.duration}` : ''}`;
            title.classList.add('podcast-title--active');

            try {
                await audio.play();
                utils.showToast(`Odtwarzanie podcastu: ${track.title}`, 'success', 3500);
            } catch (error) {
                console.warn('Podcast autoplay prevented by browser', error);
                utils.showToast('Kliknij przycisk odtwarzania w przeglądarce, aby rozpocząć nagranie.', 'info');
            }
        });
    });
}

function setupChatSimulator(utils, i18n) {
    const chatContainer = document.getElementById('chat-container');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const detectedCounter = document.getElementById('chat-detected-count');
    const deflectedCounter = document.getElementById('chat-deflected-count');
    const threatLevelElement = document.getElementById('chat-threat-level');
    const suggestionButtons = document.querySelectorAll('.chat-suggestion');

    if (!chatContainer || !chatForm || !chatInput || !detectedCounter || !deflectedCounter || !threatLevelElement) {
        return;
    }

    let patternIndex = 0;
    let detected = 0;
    let deflected = 0;

    appendChatMessage(chatContainer, 'ai', i18n.t('chat.intro'));

    chatForm.addEventListener('submit', event => {
        event.preventDefault();
        const rawMessage = chatInput.value.trim();
        if (!rawMessage) {
            utils.showToast('Wpisz wiadomość, aby kontynuować rozmowę.', 'warning');
            return;
        }

        const message = utils.sanitizeInput(rawMessage);
        appendChatMessage(chatContainer, 'user', message);
        chatInput.value = '';

        if (containsAssertiveKeywords(message)) {
            deflected += 1;
            deflectedCounter.textContent = String(deflected);
        }

        const pattern = CHAT_PATTERNS[patternIndex % CHAT_PATTERNS.length];
        patternIndex += 1;

        const response = pattern.responses[Math.floor(Math.random() * pattern.responses.length)];
        setTimeout(() => {
            appendChatMessage(chatContainer, 'ai', response);
            detected += 1;
            detectedCounter.textContent = String(detected);
            updateThreatLevel(threatLevelElement, pattern.severity, i18n);
            utils.showToast(`Wykryto technikę: ${pattern.label}. ${pattern.tip}`, 'warning', 4500);
        }, 600);
    });

    suggestionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const key = button.getAttribute('data-suggestion');
            if (!key || !CHAT_SUGGESTIONS[key]) {
                return;
            }
            chatInput.value = CHAT_SUGGESTIONS[key];
            chatInput.focus();
        });
    });
}

function appendChatMessage(container, role, text) {
    const message = document.createElement('div');
    message.className = `chat-message chat-message--${role}`;
    message.textContent = text;
    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
}

function containsAssertiveKeywords(message) {
    const keywords = ['granica', 'nie pozwolę', 'nie zgadzam', 'stop', 'koniec', 'potrzebuję czasu'];
    const lower = message.toLowerCase();
    return keywords.some(keyword => lower.includes(keyword));
}

function updateThreatLevel(element, severity, i18n) {
    const severityMap = {
        low: 'chat.threatLevels.low',
        medium: 'chat.threatLevels.medium',
        high: 'chat.threatLevels.high'
    };
    const key = severityMap[severity] || severityMap.low;
    element.textContent = i18n.t(key);
    element.setAttribute('data-level', severity);
}

async function main() {
    const utils = new UtilsManager();
    utils.init();

    buildVisualizerBars();
    setupNavigation();
    setupScrollToTop();
    setupCurrentYear();
    setupPwaInstall(utils);
    registerServiceWorker(utils);
    animateListenersCounter();
    setupAutoplayOverlay();

    const i18n = await setupI18n(utils);
    await setupPodcastPlayer(utils);

    const audioPlayer = await setupAudioPlayer(utils);
    if (audioPlayer) {
        await restorePlaybackState(audioPlayer, utils);
        setupMoodShortcuts(audioPlayer, utils);
        wirePlaybackPersistence(audioPlayer, utils);
    }

    setupChatSimulator(utils, i18n);
}

main();
