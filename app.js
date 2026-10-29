const config = window.QORUM_CONFIG;
const backendClient = window.supabase && config && config.supabaseUrl && config.supabasePublishableKey
  ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
  : null;

const games = [
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe Arena",
    genre: "Multiplayer · Strategy",
    symbol: "⚔️",
    cover: "cover-ttt",
    badge: "ONLINE 1v1",
    multiplayer: true,
    shortDesc: "Infinite 3×3 mode with no draws (3 marks max), Classic 3×3, and Gomoku 6×6 (4 in a row) online.",
    instructions: "Complete a line first! In Infinite 3×3 mode, each player can have at most 3 marks on the board — your 4th move removes your oldest mark.",
    controls: "Click a cell · Play online by room code, 2 players on one device, or vs AI",
    kind: "ttt"
  },
  {
    id: "neon-duel",
    title: "Neon Air Hockey",
    genre: "Multiplayer · Action",
    symbol: "🏒",
    cover: "cover-hockey",
    badge: "REALTIME 1v1",
    multiplayer: true,
    shortDesc: "Fast-paced 1v1 duel on a neon rink with power dash, bumpers, and real-time synchronization.",
    instructions: "Score 7 goals against your opponent! Press Space during a strike to trigger a fiery power dash.",
    controls: "Mouse / touch or WASD (Player 1) and Arrow keys (Player 2) · Space — power dash",
    kind: "hockey"
  },
  {
    id: "connect-four",
    title: "Connect Four: Gravity",
    genre: "Multiplayer · Tactical",
    symbol: "🟡",
    cover: "cover-c4",
    badge: "ONLINE 1v1",
    multiplayer: true,
    shortDesc: "Tactical 7×6 gravity board with a special Bomb disc that destroys the disc underneath.",
    instructions: "Drop discs into columns and connect 4 in a row horizontally, vertically, or diagonally. Once per round you can use a Bomb disc!",
    controls: "Click a column · Bomb disc destroys the piece directly below it",
    kind: "c4"
  },
  {
    id: "tank-brawl",
    title: "Tank Arena",
    genre: "Multiplayer · Shooter",
    symbol: "🛡️",
    cover: "cover-tanks",
    badge: "ARENA 1v1",
    multiplayer: true,
    shortDesc: "1v1 tactical tank duel with ricochet shells, destructible crates, and arena power-ups.",
    instructions: "Outmaneuver your opponent's tank! Shells bounce off walls once. Collect shields, triple-shot, and repair kits.",
    controls: "WASD + Space (or Mouse) · 2P on 1 PC: Player 2 uses Arrows + Enter",
    kind: "tanks"
  },
  {
    id: "snake",
    title: "Snake",
    genre: "Arcade · Classic",
    symbol: "🐍",
    cover: "cover-snake",
    badge: "COMBO EDITION",
    multiplayer: false,
    shortDesc: "Enhanced classic Snake with a combo multiplier, golden apples, frost berries, and portal walls.",
    instructions: "Collect apples quickly for a x2–x4 combo! Golden apples grant +3 points, and frost berries briefly slow down time.",
    controls: "Arrow keys or WASD · P to pause · toggle wall mode in the top bar",
    kind: "snake"
  },
  {
    id: "sky-hop",
    title: "Sky Hopper",
    genre: "Arcade · One-button",
    symbol: "🐦",
    cover: "cover-sky",
    badge: "SHIELD & FEATHERS",
    multiplayer: false,
    shortDesc: "Glide between twilight gates, collect golden feathers, activate a wind shield, and earn near-miss bonuses.",
    instructions: "Collect golden feathers (+2 points). Every 3 feathers activate a Wind Shield that saves you from one collision!",
    controls: "Space, ↑ or tap the game to flap",
    kind: "sky"
  },
  {
    id: "pocket-pong",
    title: "Pocket Pong",
    genre: "Arcade · Solo",
    symbol: "🏓",
    cover: "cover-pong",
    badge: "SPIN & SMASH",
    multiplayer: false,
    shortDesc: "Arcade table tennis with ball spin, an energy Smash meter, and three AI difficulty levels.",
    instructions: "Curve the ball by moving your paddle as you strike! Fill the energy bar and press Space for a high-speed Smash shot.",
    controls: "W / S or ↑ / ↓ or mouse · Space or click to arm Smash shot",
    kind: "pong"
  },
  {
    id: "memory-garden",
    title: "Memory Garden",
    genre: "Puzzle · Relaxing",
    symbol: "🌼",
    cover: "cover-memory",
    badge: "ZEN & BLITZ",
    multiplayer: false,
    shortDesc: "Botanical memory puzzle with streak combos, selectable 4×4 or 4×5 grid sizes, and a card hint.",
    instructions: "Turn over two cards at a time and find all matching pairs. Consecutive matches build a streak bonus!",
    controls: "Tap or click two cards to reveal a pair · 1 hint available per round",
    kind: "memory"
  }
];

const legacyDbGameIds = new Set(["snake", "sky-hop", "pocket-pong", "memory-garden"]);
const defaultLibrary = games.map(game => game.id);
let library = [...defaultLibrary];
try {
  const savedLibrary = JSON.parse(localStorage.getItem("playroom-library") || "null");
  if (Array.isArray(savedLibrary)) {
    const merged = [...new Set([...savedLibrary.filter(id => games.some(game => game.id === id)), ...defaultLibrary])];
    if (merged.length) library = merged;
  }
} catch (error) {
  console.warn("Could not read the saved game library.", error);
}
localStorage.setItem("playroom-library", JSON.stringify(library));

let activeFilter = "all";
let authMode = "signin";
let toastTimer;
let activeGameCleanup = null;
let currentUser = null;
let currentUsername = "Guest player";
let currentAvatarPath = null;
let activeChatUserId = null;
let activeChatChannel = null;
let publicChatChannel = null;
let activeTrackingSessionId = null;
let trackingHeartbeat = null;
let localPlayStartMs = 0;
let pendingRoomJoinCode = null;
let authView = "credentials";
let pendingRecovery = null;
let recoverySaveInProgress = false;

const personalGameSeconds = Object.fromEntries(games.map(game => [
  game.id,
  Number(localStorage.getItem(`qorum-playtime-${game.id}`)) || 0
]));

const featuredGames = document.getElementById("featured-games");
const libraryGames = document.getElementById("library-games");
const searchInput = document.getElementById("game-search");
const toast = document.getElementById("toast");
const authModal = document.getElementById("auth-modal");
const languageSelect = document.getElementById("language-select");

const translations = {
  "Discover": ["Обзор", "Entdecken"],
  "Navigation": ["Навигация", "Navigation"],
  "Main navigation": ["Главная навигация", "Hauptnavigation"],
  "Site sections": ["Разделы сайта", "Website-Bereiche"],
  "Arcade": ["Аркада", "Arcade"],
  "My games": ["Мои игры", "Meine Spiele"],
  "Community": ["Сообщество", "Community"],
  "Profile": ["Профиль", "Profil"],
  "Statistics": ["Статистика", "Statistiken"],
  "Players": ["Игроки", "Spieler"],
  "Account options": ["Настройки аккаунта", "Kontoeinstellungen"],
  "Sign out": ["Выйти", "Abmelden"],
  "Guest player": ["Гость", "Gastspieler"],
  "Signed in": ["В сети", "Angemeldet"],
  "Level 1 · Offline": ["Уровень 1 · Не в сети", "Stufe 1 · Offline"],
  "Not signed in": ["Не выполнен вход", "Nicht angemeldet"],
  "Search games": ["Поиск игр", "Spiele suchen"],
  "Search games...": ["Поиск игр...", "Spiele suchen..."],
  "Notifications": ["Уведомления", "Benachrichtigungen"],
  "Sign in": ["Войти", "Anmelden"],
  "My account": ["Мой аккаунт", "Mein Konto"],
  "Language": ["Язык", "Sprache"],
  "QORUM — Your games, your people": ["QORUM — ваши игры, ваши люди", "QORUM — deine Spiele, deine Leute"],
  "QORUM — My games": ["QORUM — Мои игры", "QORUM — Meine Spiele"],
  "QORUM — Community": ["QORUM — Сообщество", "QORUM — Community"],
  "QORUM — Profile": ["QORUM — Профиль", "QORUM — Profil"],
  "QORUM — Statistics": ["QORUM — Статистика", "QORUM — Statistiken"],
  "A little arcade · Always free": ["Уютная аркада · Всегда бесплатно", "Eine kleine Spielhalle · Immer kostenlos"],
  "Small games.": ["Мини-игры.", "Kleine Spiele."],
  "Big breaks.": ["Большие перерывы.", "Große Pausen."],
  "Online matches.": ["Онлайн-матчи.", "Online-Matches."],
  "Four easy-to-pick-up classics for a quiet moment. No downloads, no fuss — just press play.": ["Четыре простые классические игры для спокойной паузы. Без загрузок и лишних сложностей — просто нажмите «Играть».", "Vier leicht zugängliche Klassiker für eine entspannte Pause. Keine Downloads, kein Aufwand — einfach auf Spielen drücken."],
  "Eight arcade and tactical games: four upgraded solo classics and four online multiplayer arenas to play with friends.": ["Восемь аркадных и тактических игр: четыре обновлённые одиночные игры и четыре онлайн-арены для игры с друзьями.", "Acht Arcade- und Taktikspiele: vier verbesserte Solo-Klassiker und vier Online-Mehrspieler-Arenen für Spiele mit Freunden."],
  "4 MINI GAMES": ["4 МИНИ-ИГРЫ", "4 MINISPIELE"],
  "8 MINI GAMES": ["8 МИНИ-ИГР", "8 MINISPIELE"],
  "4 ONLINE 1v1": ["4 ОНЛАЙН-ИГРЫ 1×1", "4 ONLINE 1v1"],
  "PLAY IN YOUR BROWSER": ["ИГРАЙТЕ В БРАУЗЕРЕ", "IM BROWSER SPIELEN"],
  "Play Online 1v1": ["Играть онлайн 1×1", "Online 1v1 spielen"],
  "Play Snake": ["Играть в Змейку", "Snake spielen"],
  "Free to play": ["Бесплатно", "Kostenlos spielbar"],
  "Browse games ↓": ["Смотреть игры ↓", "Spiele ansehen ↓"],
  "Play online with friends": ["Играйте онлайн с друзьями", "Online mit Freunden spielen"],
  "Enter a 5-character room code or create a room inside any online game": ["Введите 5-значный код комнаты или создайте комнату внутри любой онлайн-игры", "Gib einen 5-stelligen Raumcode ein oder erstelle einen Raum in einem Online-Spiel"],
  "Room code": ["Код комнаты", "Raumcode"],
  "Join room": ["Войти в комнату", "Raum beitreten"],
  "Join": ["Войти", "Beitreten"],
  "Pick a game": ["Выберите игру", "Spiel auswählen"],
  "Simple rules, instant play. Find your new little favorite.": ["Простые правила и мгновенный запуск. Найдите свою новую любимую игру.", "Einfache Regeln, sofort losspielen. Finde deinen neuen kleinen Favoriten."],
  "Online duels with friends and upgraded solo arcade classics.": ["Онлайн-дуэли с друзьями и улучшенная одиночная классика.", "Online-Duelle mit Freunden und verbesserte Solo-Klassiker."],
  "All games (8)": ["Все игры (8)", "Alle Spiele (8)"],
  "Multiplayer · Online (4)": ["Сетевые · Онлайн (4)", "Mehrspieler · Online (4)"],
  "Solo · Arcade (4)": ["Одиночные · Аркада (4)", "Solo · Arcade (4)"],
  "A CLASSIC": ["КЛАССИКА", "EIN KLASSIKER"],
  "ONE BUTTON": ["ОДНА КНОПКА", "EIN KNOPF"],
  "VS COMPUTER": ["ПРОТИВ КОМПЬЮТЕРА", "GEGEN DEN COMPUTER"],
  "TAKE IT SLOW": ["НЕ СПЕШИ", "GANZ ENTSPANNT"],
  "ONLINE 1v1": ["ОНЛАЙН 1×1", "ONLINE 1v1"],
  "REALTIME 1v1": ["В РЕАЛЬНОМ ВРЕМЕНИ", "ECHTZEIT 1v1"],
  "ARENA 1v1": ["АРЕНА 1×1", "ARENA 1v1"],
  "COMBO EDITION": ["КОМБО-РЕЖИМ", "COMBO-EDITION"],
  "SHIELD & FEATHERS": ["ЩИТ И ПЕРЬЯ", "SCHILD & FEDERN"],
  "SPIN & SMASH": ["ПОДКРУТКА И SMASH", "SPIN & SMASH"],
  "ZEN & BLITZ": ["ДЗЕН И СЕРИИ", "ZEN & SERIEN"],
  "ONLINE MULTIPLAYER": ["ОНЛАЙН-ИГРА", "ONLINE-MEHRSPIELER"],
  "SOLO ARCADE": ["ОДИНОЧНАЯ ИГРА", "SOLO-ARCADE"],
  "1v1 ONLINE": ["1×1 ОНЛАЙН", "1v1 ONLINE"],
  "FREE": ["БЕСПЛАТНО", "KOSTENLOS"],
  "Ready to play": ["Готова к игре", "Spielbereit"],
  "Online · 2P · AI": ["Онлайн · 2 игрока · ИИ", "Online · 2P · KI"],
  "Room / 2P / AI": ["Комната / 2 игрока / ИИ", "Raum / 2P / KI"],
  "Wins: ": ["Побед: ", "Siege: "],
  "Your play time · ": ["Ваше время в игре · ", "Deine Spielzeit · "],
  "✓ In your games": ["✓ В вашей коллекции", "✓ In deiner Sammlung"],
  "Play now": ["Играть", "Jetzt spielen"],
  "Play match": ["Играть матч", "Match spielen"],
  "No games match that search. Try another title or genre.": ["По запросу ничего не найдено. Попробуйте другое название или жанр.", "Keine passenden Spiele gefunden. Probiere einen anderen Titel oder ein anderes Genre."],
  "YOUR COLLECTION": ["ВАША КОЛЛЕКЦИЯ", "DEINE SAMMLUNG"],
  "A quiet place for your favorite quick breaks.": ["Уютное место для любимых коротких игровых пауз.", "Ein ruhiger Ort für deine liebsten kurzen Spielpausen."],
  "free games, ready to play": ["бесплатных игр готовы к запуску", "kostenlose Spiele, sofort spielbereit"],
  "Your high scores are saved on this device.": ["Ваши рекорды сохранены на этом устройстве.", "Deine Bestwerte werden auf diesem Gerät gespeichert."],
  "Browse arcade ↗": ["В аркаду ↗", "Zur Spielhalle ↗"],
  "YOUR PEOPLE": ["ВАШЕ СООБЩЕСТВО", "DEINE COMMUNITY"],
  "Talk with everyone, or find a player for a private conversation.": ["Общайтесь со всеми или найдите игрока для личной переписки.", "Chatte mit allen oder finde jemanden für eine private Unterhaltung."],
  "Community chat": ["Общий чат", "Community-Chat"],
  "Public messages can be seen by everyone. Sign in to join in.": ["Сообщения видны всем. Войдите, чтобы присоединиться.", "Nachrichten sind für alle sichtbar. Melde dich an, um mitzuschreiben."],
  "Everyone": ["Все", "Alle"],
  "Live community chat": ["Общий чат в реальном времени", "Community-Chat in Echtzeit"],
  "Loading community chat…": ["Загрузка общего чата…", "Community-Chat wird geladen…"],
  "Write a message...": ["Напишите сообщение...", "Nachricht schreiben..."],
  "Public chat message": ["Сообщение в общий чат", "Nachricht im öffentlichen Chat"],
  "Send public message": ["Отправить сообщение в общий чат", "Öffentliche Nachricht senden"],
  "Keep it friendly. Messages are public and cannot be edited.": ["Общайтесь уважительно. Сообщения видны всем и не редактируются.", "Bleib freundlich. Nachrichten sind öffentlich und können nicht bearbeitet werden."],
  "Search usernames...": ["Поиск по именам...", "Nutzernamen suchen..."],
  "Search users": ["Поиск пользователей", "Nutzer suchen"],
  "Find players": ["Найти игроков", "Spieler finden"],
  "Direct messages": ["Личные сообщения", "Direktnachrichten"],
  "Private messages between your account and the selected player.": ["Личная переписка между вами и выбранным игроком.", "Private Nachrichten zwischen dir und dem ausgewählten Spieler."],
  "Chat with friends": ["Чат с друзьями", "Chat mit Freunden"],
  "Choose a player": ["Выберите игрока", "Spieler auswählen"],
  "Sign in to start a conversation.": ["Войдите, чтобы начать переписку.", "Melde dich an, um ein Gespräch zu beginnen."],
  "Search for a username or select a player from the sidebar.": ["Найдите пользователя по имени или выберите игрока в боковом меню.", "Suche nach einem Nutzernamen oder wähle jemanden in der Seitenleiste aus."],
  "Chat message": ["Сообщение в чате", "Chatnachricht"],
  "Send message": ["Отправить сообщение", "Nachricht senden"],
  "Messages are stored in your QORUM account and delivered in real time.": ["Сообщения хранятся в аккаунте QORUM и доставляются в реальном времени.", "Nachrichten werden in deinem QORUM-Konto gespeichert und in Echtzeit zugestellt."],
  "ACCOUNT": ["АККАУНТ", "KONTO"],
  "Your profile": ["Ваш профиль", "Dein Profil"],
  "A simple overview of your QORUM account and arcade activity.": ["Обзор аккаунта QORUM и вашей игровой активности.", "Eine Übersicht über dein QORUM-Konto und deine Spielaktivität."],
  "Sign in to save your profile.": ["Войдите, чтобы сохранить профиль.", "Melde dich an, um dein Profil zu speichern."],
  "Username sign-in · Save your recovery code privately": ["Вход по имени пользователя · Храните код восстановления в надёжном месте", "Anmeldung per Nutzername · Bewahre deinen Wiederherstellungscode sicher auf"],
  "QORUM account · Signed in": ["Аккаунт QORUM · Вход выполнен", "QORUM-Konto · Angemeldet"],
  "Guest profile · Sign in to continue": ["Гостевой профиль · Войдите, чтобы продолжить", "Gastprofil · Melde dich an, um fortzufahren"],
  "Choose profile picture": ["Выбрать аватар", "Profilbild auswählen"],
  "games in your collection": ["игр в коллекции", "Spiele in deiner Sammlung"],
  "total play time": ["общее время игры", "gesamte Spielzeit"],
  "best arcade result": ["лучший результат", "bester Spielhallen-Rekord"],
  "Play time by game": ["Время игры по проектам", "Spielzeit pro Spiel"],
  "Your recorded time on this account.": ["Время, записанное в вашем аккаунте.", "Die in deinem Konto erfasste Spielzeit."],
  "Sign in or create account": ["Войти или создать аккаунт", "Anmelden oder Konto erstellen"],
  "View my games": ["Мои игры", "Meine Spiele ansehen"],
  "Play time is saved to your account when you are signed in. Your username and profile picture are visible to other players.": ["Время игры сохраняется в аккаунте после входа. Ваше имя и аватар видны другим игрокам.", "Deine Spielzeit wird gespeichert, wenn du angemeldet bist. Dein Nutzername und Profilbild sind für andere sichtbar."],
  "COMMUNITY PLAYTIME": ["ИГРОВОЕ ВРЕМЯ СООБЩЕСТВА", "SPIELZEIT DER COMMUNITY"],
  "Game statistics": ["Статистика игр", "Spielstatistiken"],
  "Total play time recorded across QORUM accounts.": ["Общее время игры, записанное в аккаунтах QORUM.", "Erfasste Gesamtspielzeit aller QORUM-Konten."],
  "Game": ["Игра", "Spiel"],
  "Total play time": ["Общее время игры", "Gesamte Spielzeit"],
  "Loading statistics…": ["Загрузка статистики…", "Statistiken werden geladen…"],
  "Play time is measured while a signed-in player has a game open. Totals update as sessions are recorded.": ["Время учитывается, пока вошедший игрок находится в игре. Итоги обновляются по мере записи игровых сессий.", "Die Spielzeit wird erfasst, solange ein angemeldeter Spieler ein Spiel geöffnet hat. Die Summen werden laufend aktualisiert."],
  "Welcome back": ["С возвращением", "Willkommen zurück"],
  "Sign in to pick up where you left off.": ["Войдите, чтобы продолжить с того места, где остановились.", "Melde dich an, um dort weiterzumachen, wo du aufgehört hast."],
  "Join QORUM": ["Присоединиться к QORUM", "QORUM beitreten"],
  "Sign in with your username and password.": ["Войдите с именем пользователя и паролем.", "Melde dich mit Nutzername und Passwort an."],
  "Create an account without an email address.": ["Создайте аккаунт без адреса электронной почты.", "Erstelle ein Konto ohne E-Mail-Adresse."],
  "Use a username and password. Save your one-time recovery code somewhere private.": ["Используйте имя и пароль. Сохраните одноразовый код восстановления в надёжном месте.", "Verwende einen Nutzernamen und ein Passwort. Bewahre deinen einmaligen Wiederherstellungscode sicher auf."],
  "No email address is used. Forgot your password? Use your recovery code.": ["Электронная почта не используется. Забыли пароль? Воспользуйтесь кодом восстановления.", "Es wird keine E-Mail-Adresse verwendet. Passwort vergessen? Nutze deinen Wiederherstellungscode."],
  "Save the one-time recovery code after creating your account. It cannot be shown again.": ["Сохраните одноразовый код восстановления после регистрации. Повторно показать его нельзя.", "Speichere den einmaligen Wiederherstellungscode nach der Registrierung. Er kann nicht erneut angezeigt werden."],
  "Username": ["Имя пользователя", "Nutzername"],
  "Choose a username": ["Придумайте имя пользователя", "Nutzernamen wählen"],
  "Password": ["Пароль", "Passwort"],
  "Your password": ["Ваш пароль", "Dein Passwort"],
  "At least 8 characters": ["Не менее 8 символов", "Mindestens 8 Zeichen"],
  "3-24 letters, numbers, or _": ["3–24 буквы, цифры или _", "3–24 Buchstaben, Zahlen oder _"],
  "Create account": ["Создать аккаунт", "Konto erstellen"],
  "New here? Create an account": ["Впервые здесь? Создать аккаунт", "Neu hier? Konto erstellen"],
  "Already have an account? Sign in": ["Уже есть аккаунт? Войти", "Schon ein Konto? Anmelden"],
  "Forgot password? Use a recovery code": ["Забыли пароль? Используйте код восстановления", "Passwort vergessen? Wiederherstellungscode nutzen"],
  "Account recovery": ["Восстановление аккаунта", "Kontowiederherstellung"],
  "Keep your account safe": ["Защитите свой аккаунт", "Schütze dein Konto"],
  "No email is needed; use the recovery code saved when you registered.": ["Почта не нужна — используйте код восстановления, сохранённый при регистрации.", "Keine E-Mail nötig. Nutze den bei der Registrierung gespeicherten Wiederherstellungscode."],
  "Recover your account": ["Восстановить аккаунт", "Konto wiederherstellen"],
  "Enter your username, saved recovery code, and a new password.": ["Введите имя пользователя, сохранённый код восстановления и новый пароль.", "Gib deinen Nutzernamen, Wiederherstellungscode und ein neues Passwort ein."],
  "Recovery code": ["Код восстановления", "Wiederherstellungscode"],
  "New password": ["Новый пароль", "Neues Passwort"],
  "Reset password": ["Сбросить пароль", "Passwort zurücksetzen"],
  "Back to sign in": ["Вернуться ко входу", "Zurück zur Anmeldung"],
  "Saving recovery code": ["Сохранение кода восстановления", "Wiederherstellungscode wird gespeichert"],
  "Your account is created. Keep this window open while the recovery code is saved.": ["Аккаунт создан. Не закрывайте окно, пока код восстановления сохраняется.", "Dein Konto wurde erstellt. Lass dieses Fenster geöffnet, bis der Code gespeichert wurde."],
  "Try saving again": ["Повторить сохранение", "Erneut speichern"],
  "Save your recovery code": ["Сохраните код восстановления", "Wiederherstellungscode speichern"],
  "This code is shown only once. Keep it private and store it somewhere safe. It is not your password.": ["Этот код показывается только один раз. Храните его в надёжном месте и не передавайте другим. Это не ваш пароль.", "Dieser Code wird nur einmal angezeigt. Bewahre ihn sicher und geheim auf. Er ist nicht dein Passwort."],
  "Copy code": ["Скопировать код", "Code kopieren"],
  "Download recovery card": ["Скачать карточку восстановления", "Wiederherstellungskarte herunterladen"],
  "I've saved it — continue": ["Я сохранил код — продолжить", "Gespeichert — weiter"],
  "Close": ["Закрыть", "Schließen"],
  "Close game": ["Закрыть игру", "Spiel schließen"],
  "Restart game": ["Перезапустить игру", "Spiel neu starten"],
  "Arcade · Classic": ["Аркада · Классика", "Arcade · Klassiker"],
  "Arcade · One-button": ["Аркада · Одна кнопка", "Arcade · Ein Knopf"],
  "Arcade · Solo": ["Аркада · Для одного", "Arcade · Einzelspieler"],
  "Puzzle · Relaxing": ["Головоломка · Спокойная", "Puzzle · Entspannt"],
  "Multiplayer · Strategy": ["Мультиплеер · Стратегия", "Mehrspieler · Strategie"],
  "Multiplayer · Action": ["Мультиплеер · Экшен", "Mehrspieler · Action"],
  "Multiplayer · Tactical": ["Мультиплеер · Тактика", "Mehrspieler · Taktik"],
  "Multiplayer · Shooter": ["Мультиплеер · Экшен-арена", "Mehrspieler · Arena"],
  "Tic-Tac-Toe Arena": ["Крестики-нолики: Арена", "Tic-Tac-Toe-Arena"],
  "Neon Air Hockey": ["Неоновый аэрохоккей", "Neon-Airhockey"],
  "Connect Four: Gravity": ["Четыре в ряд: Гравитация", "Vier gewinnt: Gravitation"],
  "Tank Arena": ["Танковая арена", "Panzer-Arena"],
  "Snake": ["Змейка", "Snake"],
  "Sky Hopper": ["Небесный полёт", "Himmelsflieger"],
  "Pocket Pong": ["Карманный пинг-понг", "Taschen-Pong"],
  "Memory Garden": ["Сад памяти", "Gartengedächtnis"],
  "Infinite 3×3 mode with no draws (3 marks max), Classic 3×3, and Gomoku 6×6 (4 in a row) online.": ["Бесконечный режим 3×3 без ничьих (до 3 фигур), Классика 3×3 и Гомоку 6×6 (4 в ряд) по сети.", "Endlos-3×3-Modus ohne Unentschieden (max. 3 Steine), Klassisch 3×3 und Gomoku 6×6 (4 in einer Reihe) online."],
  "Complete a line first! In Infinite 3×3 mode, each player can have at most 3 marks on the board — your 4th move removes your oldest mark.": ["Соберите линию первым! В режиме «Бесконечный 3×3» у каждого игрока на поле может быть не более 3 фигур — 4-й ход убирает самую старую.", "Bilde zuerst eine Reihe! Im Endlos-3×3-Modus hat jeder Spieler maximal 3 Steine auf dem Feld — der 4. Zug entfernt den ältesten."],
  "Click a cell · Play online by room code, 2 players on one device, or vs AI": ["Нажмите на клетку · Игра по сети по коду комнаты, вдвоём на одном устройстве или против ИИ", "Klicke auf ein Feld · Online per Raumcode, zu zweit an einem Gerät oder gegen die KI"],
  "Fast-paced 1v1 duel on a neon rink with power dash, bumpers, and real-time synchronization.": ["Динамичная дуэль 1 на 1 на неоновом корте с ускорением, отбойниками и синхронизацией в реальном времени.", "Schnelles 1v1-Duell auf einem Neon-Spielfeld mit Power-Sprint, Bumpern und Echtzeit-Synchronisation."],
  "Score 7 goals against your opponent! Press Space during a strike to trigger a fiery power dash.": ["Забейте 7 шайб в ворота соперника! Нажмите Пробел во время удара для мощного рывка.", "Erziele 7 Tore gegen deinen Gegner! Drücke die Leertaste beim Schlag für einen feurigen Power-Sprint."],
  "Mouse / touch or WASD (Player 1) and Arrow keys (Player 2) · Space — power dash": ["Мышь / сенсор или WASD (Игрок 1) и Стрелки (Игрок 2) · Пробел — рывок", "Maus / Touch oder WASD (Spieler 1) und Pfeiltasten (Spieler 2) · Leertaste — Sprint"],
  "Tactical 7×6 gravity board with a special Bomb disc that destroys the disc underneath.": ["Тактическое поле 7×6 с гравитацией и специальной фишкой-бомбой, разрушающей фишку под собой.", "Taktisches 7×6-Spielfeld mit Schwerkraft und einem speziellen Bomben-Stein, der den Stein darunter zerstört."],
  "Drop discs into columns and connect 4 in a row horizontally, vertically, or diagonally. Once per round you can use a Bomb disc!": ["Бросайте фишки в колонки и соберите 4 в ряд по горизонтали, вертикали или диагонали. Раз за раунд доступна фишка-бомба!", "Wirf Steine in die Spalten und verbinde 4 in einer Reihe. Einmal pro Runde kannst du einen Bomben-Stein einsetzen!"],
  "Click a column · Bomb disc destroys the piece directly below it": ["Нажмите на колонку · Фишка-бомба уничтожает фишку прямо под собой", "Klicke auf eine Spalte · Der Bomben-Stein zerstört den Stein direkt darunter"],
  "1v1 tactical tank duel with ricochet shells, destructible crates, and arena power-ups.": ["Тактическая танковая дуэль 1 на 1 с рикошетами снарядов, разрушаемыми ящиками и бонусами на арене.", "Taktisches 1v1-Panzerduell mit Abprall-Geschossen, zerstörbaren Kisten und Arena-Boni."],
  "Outmaneuver your opponent's tank! Shells bounce off walls once. Collect shields, triple-shot, and repair kits.": ["Победите танк соперника! Снаряды один раз рикошетят от стен. Подбирайте щиты, тройной залп и ремкомплекты.", "Besiege den gegnerischen Panzer! Geschosse prallen einmal von Wänden ab. Sammle Schilde, Dreifachschuss und Reparatursets."],
  "WASD + Space (or Mouse) · 2P on 1 PC: Player 2 uses Arrows + Enter": ["WASD + Пробел (или мышь) · Вдвоём на 1 ПК: Игрок 2 — Стрелки + Enter", "WASD + Leertaste (oder Maus) · 2 Spieler an 1 PC: Spieler 2 nutzt Pfeiltasten + Enter"],
  "Enhanced classic Snake with a combo multiplier, golden apples, frost berries, and portal walls.": ["Обновлённая классическая «Змейка» с комбо-множителем, золотыми яблоками, ледяными ягодами и режимом портала.", "Erweitertes Snake mit Combo-Multiplikator, goldenen Äpfeln, Frostbeeren und Portal-Wänden."],
  "Collect apples quickly for a x2–x4 combo! Golden apples grant +3 points, and frost berries briefly slow down time.": ["Собирайте яблоки подряд для комбо x2–x4! Золотые яблоки дают +3 очка, а ледяные ягоды замедляют движение.", "Sammle schnell Äpfel für eine x2–x4-Combo! Goldene Äpfel geben +3 Punkte und Frostbeeren verlangsamen die Zeit."],
  "Arrow keys or WASD · P to pause · toggle wall mode in the top bar": ["Стрелки или WASD · P — пауза · переключение режима стен на верхней панели", "Pfeiltasten oder WASD · P für Pause · Wandmodus oben umschalten"],
  "Glide between twilight gates, collect golden feathers, activate a wind shield, and earn near-miss bonuses.": ["Пролетайте сквозь сумеречные врата, собирайте золотые перья, активируйте щит ветра и получайте бонусы за точность.", "Gleite durch Dämmerungstore, sammle goldene Federn, aktiviere ein Windschild und erhalte Boni für knappe Manöver."],
  "Collect golden feathers (+2 points). Every 3 feathers activate a Wind Shield that saves you from one collision!": ["Собирайте золотые перья (+2 очка). Каждые 3 пера активируют щит ветра, защищающий от одного столкновения!", "Sammle goldene Federn (+2 Punkte). Alle 3 Federn aktivieren ein Windschild, das dich vor einer Kollision schützt!"],
  "Space, ↑ or tap the game to flap": ["Пробел, ↑ или нажмите на экран для взмаха", "Leertaste, ↑ oder tippe ins Spiel"],
  "Arcade table tennis with ball spin, an energy Smash meter, and three AI difficulty levels.": ["Аркадный настольный теннис с подкруткой мяча, шкалой мощного удара Smash и тремя уровнями сложности ИИ.", "Arcade-Tischtennis mit Ball-Spin, Smash-Energieanzeige und drei KI-Schwierigkeitsgraden."],
  "Curve the ball by moving your paddle as you strike! Fill the energy bar and press Space for a high-speed Smash shot.": ["Подкручивайте мяч движением ракетки в момент удара! Накопите шкалу энергии и нажмите Пробел для мощного удара Smash.", "Gib dem Ball Spin, indem du den Schläger beim Treffen bewegst! Fülle die Energieleiste und drücke die Leertaste für einen Smash-Schlag."],
  "W / S or ↑ / ↓ or mouse · Space or click to arm Smash shot": ["W / S, ↑ / ↓ или мышь · Пробел или клик — подготовить удар Smash", "W / S, ↑ / ↓ oder Maus · Leertaste oder Klick für Smash-Schlag"],
  "Botanical memory puzzle with streak combos, selectable 4×4 or 4×5 grid sizes, and a card hint.": ["Ботаническая головоломка на память с сериями совпадений, выбором поля 4×4 или 4×5 и подсказкой.", "Botanisches Gedächtnisspiel mit Serien-Boni, 4×4- oder 4×5-Spielfeld und Hinweis-Funktion."],
  "Turn over two cards at a time and find all matching pairs. Consecutive matches build a streak bonus!": ["Открывайте по две карточки и находите одинаковые пары. Угаданные подряд пары увеличивают бонус серии!", "Decke zwei Karten gleichzeitig auf und finde alle Paare. Treffer in Folge erhöhen deinen Serien-Bonus!"],
  "Tap or click two cards to reveal a pair · 1 hint available per round": ["Нажмите на две карточки, чтобы открыть пару · Доступна 1 подсказка за партию", "Tippe zwei Karten an, um ein Paar aufzudecken · 1 Hinweis pro Runde verfügbar"],
  "Mode:": ["Режим:", "Modus:"],
  "🌐 Online with friends": ["🌐 Онлайн с друзьями", "🌐 Online mit Freunden"],
  "👥 2 Players (1 screen)": ["👥 2 игрока (на 1 экране)", "👥 2 Spieler (1 Bildschirm)"],
  "🤖 Vs AI": ["🤖 Против ИИ", "🤖 Gegen KI"],
  "➕ Create room": ["➕ Создать комнату", "➕ Raum erstellen"],
  "📋 Copy code": ["📋 Код", "📋 Code"],
  "🔗 Copy invite link": ["🔗 Ссылка-приглашение", "🔗 Einladungslink"],
  "📨 Invite in chat": ["📨 Пригласить в чате", "📨 Im Chat einladen"],
  "Click 'Create room' or enter a room code": ["Нажмите «Создать комнату» или введите код", "Klicke auf „Raum erstellen“ oder gib einen Code ein"],
  "Player 1": ["Игрок 1", "Spieler 1"],
  "Player 2": ["Игрок 2", "Spieler 2"],
  "Opponent / AI": ["Соперник / ИИ", "Gegner / KI"],
  "AI Bot 🤖": ["ИИ-соперник 🤖", "KI-Bot 🤖"],
  "Waiting for opponent...": ["Ожидание соперника...", "Warte auf Gegner..."],
  "Connecting...": ["Подключение...", "Verbinde..."],
  "Room host": ["Создатель комнаты", "Raum-Host"],
  "You · Host": ["Вы · Хост", "Du · Host"],
  "You · Guest": ["Вы · Гость", "Du · Gast"],
  "↻ Rematch": ["↻ Реванш", "↻ Revanche"],
  "New round / Rematch": ["Новый раунд / Реванш", "Neue Runde / Revanche"],
  "Fire": ["Огонь", "Feuer"],
  "Cool": ["Отлично", "Cool"],
  "Laugh": ["Смех", "Lachen"],
  "Applause": ["Аплодисменты", "Applaus"],
  "gg": ["Хорошая игра", "Gutes Spiel"],
  "Open rooms right now:": ["Открытые комнаты сейчас:", "Aktuell offene Räume:"],
  "Open rooms:": ["Открытые комнаты:", "Offene Räume:"],
  "No open rooms yet — click 'Create room' and share the code with a friend!": ["Открытых комнат пока нет — нажмите «Создать комнату» и отправьте код другу!", "Noch keine offenen Räume — klicke auf „Raum erstellen“ und teile den Code mit einem Freund!"],
  "Enter a room code (for example, T8K2M)": ["Введите код комнаты (например, T8K2M)", "Gib einen Raumcode ein (z. B. T8K2M)"],
  "Invite link copied! Share it with a friend.": ["Ссылка-приглашение скопирована! Отправьте её другу.", "Einladungslink kopiert! Teile ihn mit einem Freund."],
  "Sign in or copy the invite link using the button!": ["Войдите в аккаунт или скопируйте ссылку-приглашение!", "Melde dich an oder kopiere den Einladungslink!"],
  "No other players in the list yet — share the direct invite link!": ["В списке пока нет других игроков — отправьте прямую ссылку-приглашение!", "Noch keine anderen Spieler in der Liste — teile den direkten Einladungslink!"],
  "Could not send chat invite — copy the invite link instead.": ["Не удалось отправить приглашение в чат — скопируйте ссылку.", "Einladung konnte nicht im Chat gesendet werden — kopiere stattdessen den Link."],
  "Opponent started a rematch!": ["Соперник запустил реванш!", "Der Gegner hat eine Revanche gestartet!"],
  "Only the room host can change the game rules.": ["Только создатель комнаты может менять правила игры.", "Nur der Raum-Host kann die Spielregeln ändern."],
  "Wait for your opponent to connect or switch to 'Vs AI'!": ["Дождитесь подключения соперника или переключитесь в режим «Против ИИ»!", "Warte auf deinen Gegner oder wechsle in den Modus „Gegen KI“!"],
  "It is your opponent's turn!": ["Сейчас ход соперника!", "Dein Gegner ist am Zug!"],
  "Borders:": ["Границы:", "Ränder:"],
  "🧱 Solid walls (Classic)": ["🧱 Стены (Классика)", "🧱 Feste Wände (Klassisch)"],
  "🌀 Portal (Wrap around)": ["🌀 Портал (Сквозь края)", "🌀 Portal (Durchlässig)"],
  "⏸ Pause (P)": ["⏸ Пауза (P)", "⏸ Pause (P)"],
  "Combo:": ["Комбо:", "Combo:"],
  "Score:": ["Счёт:", "Punkte:"],
  "Paused": ["Пауза", "Pausiert"],
  "Press P or the Pause button to continue": ["Нажмите P или кнопку «Пауза», чтобы продолжить", "Drücke P oder die Pause-Taste, um fortzufahren"],
  "Feathers:": ["Перья:", "Federn:"],
  "Shield:": ["Щит:", "Schild:"],
  "None": ["Нет", "Aus"],
  "🛡️ ACTIVE": ["🛡️ АКТИВЕН", "🛡️ AKTIV"],
  "🛡️ WIND SHIELD!": ["🛡️ ЩИТ ВЕТРА!", "🛡️ WINDSCHILD!"],
  "+2 FEATHER ✨": ["+2 ПЕРО ✨", "+2 FEDER ✨"],
  "+1 CLOSE CALL! 🔥": ["+1 НА ГРАНИ! 🔥", "+1 KNAPP! 🔥"],
  "🛡️ SHIELD SAVED YOU!": ["🛡️ ЩИТ СПАС!", "🛡️ SCHILD GERETTET!"],
  "Press Space or click to take off · Collect feathers for a shield!": ["Нажмите Пробел или кликните, чтобы взлететь · Собирайте перья для щита!", "Drücke Leertaste oder klicke zum Starten · Sammle Federn für ein Schild!"],
  "AI:": ["ИИ:", "KI:"],
  "Easy": ["Лёгкий", "Leicht"],
  "Normal": ["Нормальный", "Normal"],
  "Pro": ["Профи", "Profi"],
  "Smash Energy:": ["Энергия Smash:", "Smash-Energie:"],
  "🔥 ARMED!": ["🔥 ЗАРЯЖЕН!", "🔥 BEREIT!"],
  "⚡ READY (Space)": ["⚡ ГОТОВ (Пробел)", "⚡ BEREIT (Leertaste)"],
  "(to 7)": ["(до 7)", "(bis 7)"],
  "Board:": ["Поле:", "Feld:"],
  "4×4 (16 cards)": ["4×4 (16 карт)", "4×4 (16 Karten)"],
  "4×5 (20 cards)": ["4×5 (20 карт)", "4×5 (20 Karten)"],
  "🔍 Hint (1)": ["🔍 Подсказка (1)", "🔍 Hinweis (1)"],
  "🔍 Hint (0)": ["🔍 Подсказка (0)", "🔍 Hinweis (0)"],
  "Streak:": ["Серия:", "Serie:"],
  "Moves:": ["Ходы:", "Züge:"],
  "Memorize the cards...": ["Запомните расположение карточек...", "Merke dir die Karten..."],
  "Rules:": ["Правила:", "Regeln:"],
  "⚡ Infinite 3×3": ["⚡ Бесконечный 3×3", "⚡ Endlos 3×3"],
  "🎲 Classic 3×3": ["🎲 Классика 3×3", "🎲 Klassisch 3×3"],
  "💠 Gomoku 6×6 (4 in a row)": ["💠 Гомоку 6×6 (4 в ряд)", "💠 Gomoku 6×6 (4 in Reihe)"],
  "⚡ Infinite 3×3: 4th mark removes the oldest one (no draws!)": ["⚡ Бесконечный 3×3: 4-я фигура убирает самую старую (без ничьих!)", "⚡ Endlos 3×3: 4. Stein entfernt den ältesten (kein Unentschieden!)"],
  "🎲 Classic 3×3: get 3 in a row": ["🎲 Классика 3×3: соберите 3 в ряд", "🎲 Klassisch 3×3: 3 in einer Reihe"],
  "💠 Gomoku 6×6: get 4 in a row in any direction": ["💠 Гомоку 6×6: соберите 4 в ряд по любой линии", "💠 Gomoku 6×6: 4 in einer Reihe in beliebiger Richtung"],
  "⏳ Waiting for opponent to join (or switch to Vs AI / 2 Players)...": ["⏳ Ожидание подключения соперника (или выберите «Против ИИ» / «2 игрока»)...", "⏳ Warte auf Gegner (oder wechsle zu „Gegen KI“ / „2 Spieler“)..."],
  "🤖 AI Bot is thinking...": ["🤖 ИИ-соперник обдумывает ход...", "🤖 KI-Bot denkt nach..."],
  "Draw!": ["Ничья!", "Unentschieden!"],
  "It's a draw! Click '↻ Rematch' for another round.": ["Ничья! Нажмите «↻ Реванш» для новой партии.", "Unentschieden! Klicke auf „↻ Revanche“ für eine neue Runde."],
  "First to 7 goals · Space / Click — Power Dash 🔥": ["Матч до 7 голов · Пробел / Клик — мощный рывок 🔥", "Spiel bis 7 Tore · Leertaste / Klick — Power-Sprint 🔥"],
  "🔮 Bumpers: ON": ["🔮 Отбойники: ВКЛ", "🔮 Bumper: AN"],
  "🔮 Bumpers: OFF": ["🔮 Отбойники: ВЫКЛ", "🔮 Bumper: AUS"],
  "Player 1 Wins! 🏆": ["Победа Игрока 1! 🏆", "Spieler 1 gewinnt! 🏆"],
  "Player 2 Wins! 🏆": ["Победа Игрока 2! 🏆", "Spieler 2 gewinnt! 🏆"],
  "Connect 4 in a row · 💣 Bomb destroys the disc below!": ["Соберите 4 в ряд · 💣 Бомба уничтожает фишку под собой!", "Verbinde 4 in einer Reihe · 💣 Bombe zerstört den Stein darunter!"],
  "💣 Bomb disc (1)": ["💣 Фишка-бомба (1)", "💣 Bomben-Stein (1)"],
  "💣 Bomb disc (0)": ["💣 Фишка-бомба (0)", "💣 Bomben-Stein (0)"],
  "💣 BOMB ARMED!": ["💣 БОМБА АКТИВНА!", "💣 BOMBE AKTIV!"],
  "Bomb disc already used in this round!": ["Фишка-бомба уже использована в этом раунде!", "Bomben-Stein in dieser Runde bereits verwendet!"],
  "💥 Bomb disc destroyed the piece below!": ["💥 Фишка-бомба уничтожила фишку снизу!", "💥 Bomben-Stein hat den Stein darunter zerstört!"],
  "🤖 AI Bot is choosing a column...": ["🤖 ИИ-соперник выбирает колонку...", "🤖 KI-Bot wählt eine Spalte..."],
  "Board is full — it's a draw! Click '↻ Rematch'.": ["Поле заполнено — ничья! Нажмите «↻ Реванш».", "Spielfeld voll — Unentschieden! Klicke auf „↻ Revanche“."],
  "Shells ricochet once · Collect 🛡️ 🔱 ❤️ power-ups in the center!": ["Снаряды рикошетят 1 раз · Подбирайте бонусы 🛡️ 🔱 ❤️ в центре арены!", "Geschosse prallen 1× ab · Sammle 🛡️ 🔱 ❤️ Boni in der Mitte!"],
  "Tank 1 Wins! 🏆": ["Танк 1 победил! 🏆", "Panzer 1 gewinnt! 🏆"],
  "Tank 2 Wins! 🏆": ["Танк 2 победил! 🏆", "Panzer 2 gewinnt! 🏆"],
  "Click '↻ Rematch' above for a new battle": ["Нажмите «↻ Реванш» вверху для нового боя", "Klicke oben auf „↻ Revanche“ für ein neues Gefecht"],
  "That username is already taken. Please choose another.": ["Это имя уже занято. Выберите другое.", "Dieser Nutzername ist bereits vergeben. Bitte wähle einen anderen."],
  "Username or password is incorrect.": ["Неверное имя пользователя или пароль.", "Nutzername oder Passwort ist falsch."],
  "Account service is unavailable. Check your connection and try again.": ["Сервис аккаунтов недоступен. Проверьте подключение и попробуйте снова.", "Der Kontodienst ist nicht verfügbar. Prüfe deine Verbindung und versuche es erneut."],
  "The account service is unavailable. Check your connection and try again.": ["Сервис аккаунтов недоступен. Проверьте подключение и попробуйте снова.", "Der Kontodienst ist nicht verfügbar. Prüfe deine Verbindung und versuche es erneut."],
  "You are signed in.": ["Вы вошли в аккаунт.", "Du bist angemeldet."],
  "You have signed out.": ["Вы вышли из аккаунта.", "Du hast dich abgemeldet."],
  "You're all caught up.": ["Новых уведомлений нет.", "Du bist auf dem neuesten Stand."],
  "Your profile details could not be loaded.": ["Не удалось загрузить данные профиля.", "Deine Profildaten konnten nicht geladen werden."],
  "Player list could not be loaded.": ["Не удалось загрузить список игроков.", "Die Spielerliste konnte nicht geladen werden."],
  "No other players yet.": ["Пока других игроков нет.", "Noch keine anderen Spieler."],
  "QORUM player": ["Игрок QORUM", "QORUM-Spieler"],
  "Enter at least 3 characters to search.": ["Для поиска введите не менее 3 символов.", "Gib mindestens 3 Zeichen für die Suche ein."],
  "No players found. Check the username and try again.": ["Игроки не найдены. Проверьте имя и попробуйте снова.", "Keine Spieler gefunden. Überprüfe den Namen und versuche es erneut."],
  "You can also save this code in a password manager.": ["Можно также сохранить код в менеджере паролей.", "Du kannst den Code auch in einem Passwortmanager speichern."],
  "Profile picture updated.": ["Аватар обновлён.", "Profilbild aktualisiert."],
  "Choose a JPG, PNG, or WebP image up to 3 MB.": ["Выберите изображение JPG, PNG или WebP размером до 3 МБ.", "Wähle ein JPG-, PNG- oder WebP-Bild bis 3 MB aus."],
  "The picture could not be uploaded. Please try again.": ["Не удалось загрузить изображение. Попробуйте ещё раз.", "Das Bild konnte nicht hochgeladen werden. Bitte versuche es erneut."],
  "Your picture updated, but the previous image could not be removed.": ["Аватар обновлён, но предыдущее изображение удалить не удалось.", "Dein Bild wurde aktualisiert, aber das vorherige konnte nicht gelöscht werden."],
  "No messages yet. Start the conversation.": ["Сообщений пока нет. Начните разговор.", "Noch keine Nachrichten. Beginne das Gespräch."],
  "Community chat is temporarily unavailable.": ["Общий чат временно недоступен.", "Der Community-Chat ist vorübergehend nicht verfügbar."],
  "Please wait a moment before sending another message.": ["Подождите немного, прежде чем отправить следующее сообщение.", "Bitte warte einen Moment, bevor du die nächste Nachricht sendest."],
  "Your message could not be sent.": ["Не удалось отправить сообщение.", "Deine Nachricht konnte nicht gesendet werden."],
  "Sign in to send a message in community chat.": ["Войдите, чтобы писать в общий чат.", "Melde dich an, um im Community-Chat zu schreiben."],
  "Sign in to find and message players.": ["Войдите, чтобы искать игроков и писать им.", "Melde dich an, um Spieler zu suchen und ihnen zu schreiben."],
  "Sign in to message other QORUM players.": ["Войдите, чтобы писать другим игрокам QORUM.", "Melde dich an, um anderen QORUM-Spielern zu schreiben."],
  "Message could not be sent.": ["Не удалось отправить сообщение.", "Nachricht konnte nicht gesendet werden."],
  "Messages could not be loaded.": ["Не удалось загрузить сообщения.", "Nachrichten konnten nicht geladen werden."],
  "That player could not be found.": ["Игрок не найден.", "Dieser Spieler wurde nicht gefunden."],
  "Play-time tracking was interrupted.": ["Учёт игрового времени прерван.", "Die Spielzeiterfassung wurde unterbrochen."],
  "Your play-time totals could not be loaded.": ["Не удалось загрузить игровое время.", "Deine Spielzeit konnte nicht geladen werden."],
  "Account service unavailable.": ["Сервис аккаунтов недоступен.", "Kontodienst nicht verfügbar."],
  "minutes": ["минут", "Minuten"],
  "hour": ["час", "Stunde"],
  "hours": ["часов", "Stunden"],
  "No email address is used.": ["Электронная почта не используется.", "Es wird keine E-Mail-Adresse verwendet."],
  "Restart": ["Перезапустить", "Neustart"],
  "Score": ["Счёт", "Punktestand"],
  "moves": ["ходов", "Züge"],
  "Best ": ["Рекорд ", "Bestwert "],
  "Your play time": ["Ваше время в игре", "Deine Spielzeit"],
  "Best": ["Рекорд", "Bestwert"],
  "Total": ["Всего", "Gesamt"],
  "No email is used; sign in with your username and password.": ["Почта не используется; войдите с именем пользователя и паролем.", "Keine E-Mail nötig; melde dich mit Nutzername und Passwort an."],
  "Copy failed. Select the code and copy it manually.": ["Не удалось скопировать. Выделите код и скопируйте его вручную.", "Kopieren fehlgeschlagen. Markiere den Code und kopiere ihn manuell."],
  "Recovery code copied. Store it privately.": ["Код скопирован. Храните его в надёжном месте.", "Code kopiert. Bewahre ihn sicher auf."],
  "Could not create the recovery card.": ["Не удалось создать карточку восстановления.", "Die Wiederherstellungskarte konnte nicht erstellt werden."],
  "Recovery card downloaded. Keep the image somewhere private.": ["Карточка скачана. Храните изображение в надёжном месте.", "Karte heruntergeladen. Bewahre das Bild sicher auf."],
  "Start the conversation with a message.": ["Начните разговор, отправив сообщение.", "Beginne das Gespräch mit einer Nachricht."],
  "Almost done": ["Почти готово", "Fast geschafft"],
  "Your account is ready. Save your recovery code before continuing.": ["Аккаунт готов. Сохраните код восстановления, прежде чем продолжить.", "Dein Konto ist bereit. Speichere den Wiederherstellungscode, bevor du fortfährst."],
  "Save your recovery code before leaving this page.": ["Сохраните код восстановления, прежде чем покинуть страницу.", "Speichere den Wiederherstellungscode, bevor du diese Seite verlässt."],
  "Password reset. Sign in with your new password.": ["Пароль изменён. Войдите с новым паролем.", "Passwort zurückgesetzt. Melde dich mit deinem neuen Passwort an."],
  "Your account is ready. Sign in with your username and password.": ["Аккаунт готов. Войдите с именем пользователя и паролем.", "Dein Konto ist bereit. Melde dich mit Nutzername und Passwort an."],
  "Enter a valid username and recovery code, and a password between 8 and 72 characters.": ["Введите корректные имя пользователя и код восстановления, а также пароль длиной от 8 до 72 символов.", "Gib einen gültigen Nutzernamen und Wiederherstellungscode sowie ein Passwort mit 8 bis 72 Zeichen ein."],
  "Enter a valid username and a password between 8 and 72 characters.": ["Введите корректное имя пользователя и пароль длиной от 8 до 72 символов.", "Gib einen gültigen Nutzernamen und ein Passwort mit 8 bis 72 Zeichen ein."],
  "The password was changed, but a new recovery code could not be confirmed. Contact the site owner before continuing.": ["Пароль изменён, но новый код восстановления подтвердить не удалось. Свяжитесь с владельцем сайта, прежде чем продолжить.", "Das Passwort wurde geändert, aber der neue Wiederherstellungscode konnte nicht bestätigt werden. Wende dich an den Website-Betreiber."],
  "Your previous recovery code was used. Save this replacement code before signing in.": ["Старый код восстановления использован. Сохраните новый код перед входом.", "Dein vorheriger Wiederherstellungscode wurde verwendet. Speichere den neuen Code, bevor du dich anmeldest."],
  "You filled the whole garden! A perfect game.": ["Вы заполнили всё поле! Идеальная игра.", "Du hast das ganze Feld gefüllt! Perfekt gespielt."],
  "Move up": ["Двигаться вверх", "Nach oben bewegen"],
  "Move left": ["Двигаться влево", "Nach links bewegen"],
  "Move down": ["Двигаться вниз", "Nach unten bewegen"],
  "Move right": ["Двигаться вправо", "Nach rechts bewegen"],
  "Statistics are unavailable until the account service is configured.": ["Статистика будет доступна после настройки сервиса аккаунтов.", "Statistiken sind verfügbar, sobald der Kontodienst eingerichtet ist."],
  "Statistics could not be loaded. Please try again later.": ["Не удалось загрузить статистику. Попробуйте позже.", "Statistiken konnten nicht geladen werden. Bitte versuche es später erneut."],
  "Uploading your profile picture…": ["Загрузка аватара…", "Profilbild wird hochgeladen…"],
  "The picture uploaded, but your profile could not be updated.": ["Изображение загружено, но профиль не удалось обновить.", "Das Bild wurde hochgeladen, aber dein Profil konnte nicht aktualisiert werden."],
  "Picture updated. The previous image could not be removed.": ["Аватар обновлён. Предыдущее изображение удалить не удалось.", "Bild aktualisiert. Das vorherige Bild konnte nicht gelöscht werden."],
  "Sign in to find players.": ["Войдите, чтобы искать игроков.", "Melde dich an, um Spieler zu finden."],
  "Sign in to record play time": ["Войдите для учёта времени игры", "Anmelden, um Spielzeit zu erfassen"],
  "QORUM home": ["На главную QORUM", "QORUM-Startseite"],
  "Open menu": ["Открыть меню", "Menü öffnen"],
  "Could not load the public community chat.": ["Не удалось загрузить общий чат.", "Der Community-Chat konnte nicht geladen werden."],
  "Live chat updates are temporarily unavailable.": ["Обновления чата временно недоступны.", "Live-Chat-Aktualisierungen sind vorübergehend nicht verfügbar."],
  "Sign in to upload a profile picture.": ["Войдите, чтобы загрузить аватар.", "Melde dich an, um ein Profilbild hochzuladen."],
  "Your sign-in status could not be restored.": ["Не удалось восстановить состояние входа.", "Dein Anmeldestatus konnte nicht wiederhergestellt werden."],
  "Account recovery is temporarily unavailable.": ["Восстановление аккаунта временно недоступно.", "Die Kontowiederherstellung ist vorübergehend nicht verfügbar."],
  "Check the username, recovery code, and new password.": ["Проверьте имя пользователя, код восстановления и новый пароль.", "Überprüfe Nutzername, Wiederherstellungscode und neues Passwort."],
  "Could not open the selected player's profile.": ["Не удалось открыть профиль выбранного игрока.", "Das Profil des ausgewählten Spielers konnte nicht geöffnet werden."],
  "Your password was changed. Save the new recovery code.": ["Пароль изменён. Сохраните новый код восстановления.", "Dein Passwort wurde geändert. Speichere den neuen Wiederherstellungscode."],
  "Password could not be changed. Please try again.": ["Не удалось изменить пароль. Попробуйте ещё раз.", "Das Passwort konnte nicht geändert werden. Bitte versuche es erneut."],
  "Contact the site owner before continuing.": ["Свяжитесь с владельцем сайта, прежде чем продолжить.", "Wende dich an den Website-Betreiber, bevor du fortfährst."],
  "Distance": ["Дистанция", "Distanz"],
  "Moves": ["Ходы", "Züge"],
  "You": ["Вы", "Du"],
  "Computer": ["Компьютер", "Computer"],
  "AI": ["ИИ", "KI"],
  "You win!": ["Вы победили!", "Du gewinnst!"],
  "You win! 🏆": ["Вы победили! 🏆", "Du gewinnst! 🏆"],
  "Good game!": ["Хорошая игра!", "Gutes Spiel!"],
  "Nice try!": ["Хорошая попытка!", "Guter Versuch!"],
  "Lovely flight!": ["Отличный полёт!", "Toller Flug!"],
  "Your score: ": ["Ваш счёт: ", "Dein Punktestand: "],
  "Press ↻ to play again": ["Нажмите ↻, чтобы сыграть ещё раз", "Drücke ↻ für eine neue Runde"],
  "Press space or tap to take off": ["Нажмите пробел или коснитесь экрана, чтобы взлететь", "Leertaste drücken oder tippen zum Start"],
  "Run over": ["Игра окончена", "Spiel vorbei"],
  "You passed": ["Вы прошли", "Du hast"],
  "gate": ["преграду", "Tor"],
  "gates": ["преград", "Tore"],
  "Press ↻ to fly again.": ["Нажмите ↻, чтобы лететь снова.", "Drücke ↻, um erneut zu fliegen."],
  " · You passed ": [" · Вы прошли ", " · Du hast "],
  " · Press ↻ to fly again.": [" · Нажмите ↻, чтобы лететь снова.", " · Drücke ↻, um erneut zu fliegen."],
  "Final score ": ["Итоговый счёт ", "Endstand "],
  "Press ↻ to try again": ["Нажмите ↻, чтобы попробовать ещё раз", "Drücke ↻, um es erneut zu versuchen"],
  "You win! Press ↻ for a rematch.": ["Вы победили! Нажмите ↻ для реванша.", "Du gewinnst! Drücke ↻ für eine Revanche."],
  "Good game! Press ↻ for another round.": ["Хорошая игра! Нажмите ↻ для нового раунда.", "Gutes Spiel! Drücke ↻ für eine neue Runde."],
  "Hidden garden card": ["Закрытая карточка сада", "Verdeckte Gartenkarte"],
  "Garden card": ["Карточка сада", "Gartenkarte"],
  "Game over · Final score ": ["Игра окончена · Итоговый счёт ", "Spiel vorbei · Endstand "],
  ". Press ↻ to try again.": [". Нажмите ↻, чтобы попробовать ещё раз.", ". Drücke ↻, um es erneut zu versuchen."],
  "A lovely match · All pairs found in ": ["Отличная партия · Все пары найдены за ", "Schön kombiniert · Alle Paare in "],
  " moves!": [" ходов!", " Zügen!"],
  " · Press ↻ to play again": [" · Нажмите ↻, чтобы сыграть ещё раз", " · Drücke ↻ für eine neue Runde"]
};

const languageIndex = { ru: 0, de: 1 };
const translationSources = new Map();
Object.entries(translations).forEach(([source, translatedValues]) => {
  translatedValues.forEach(value => {
    if (value !== source) translationSources.set(value, source);
  });
});
const originalTextNodes = new WeakMap();
const textNodeLanguages = new WeakMap();
const originalAttributes = new WeakMap();
const attributeLanguages = new WeakMap();
let currentLanguage = "en";
try {
  const savedLanguage = localStorage.getItem("qorum-language");
  if (savedLanguage === "ru" || savedLanguage === "de") currentLanguage = savedLanguage;
} catch (error) {
  console.warn("Could not read the saved language preference.", error);
}

function translatedValue(value) {
  if (currentLanguage === "en") return value;
  const entry = translations[value];
  return entry ? entry[languageIndex[currentLanguage]] : value;
}

function originalValue(value) {
  const leading = value.match(/^\s*/)[0];
  const trailing = value.match(/\s*$/)[0];
  const phrase = value.trim();
  return `${leading}${translationSources.get(phrase) || phrase}${trailing}`;
}

function localizeTextNode(node, dynamic = false) {
  const value = node.nodeValue;
  if (!value || !value.trim()) return;
  if (dynamic) {
    originalTextNodes.set(node, originalValue(value));
    textNodeLanguages.delete(node);
  } else if (!originalTextNodes.has(node)) {
    originalTextNodes.set(node, value);
  }
  if (textNodeLanguages.get(node) === currentLanguage) return;
  const original = originalTextNodes.get(node);
  const leading = original.match(/^\s*/)[0];
  const trailing = original.match(/\s*$/)[0];
  const phrase = original.trim();
  const localized = `${leading}${translatedValue(phrase)}${trailing}`;
  if (node.nodeValue !== localized) node.nodeValue = localized;
  textNodeLanguages.set(node, currentLanguage);
}

function localizeAttribute(element, attribute, dynamic = false) {
  const value = element.getAttribute(attribute);
  if (value === null || !value.trim()) return;
  let originals = originalAttributes.get(element);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(element, originals);
  }
  let languages = attributeLanguages.get(element);
  if (!languages) {
    languages = new Map();
    attributeLanguages.set(element, languages);
  }
  if (dynamic || !originals.has(attribute)) {
    originals.set(attribute, dynamic ? originalValue(value) : value);
    languages.delete(attribute);
  }
  if (languages.get(attribute) === currentLanguage) return;
  const localized = translatedValue(originals.get(attribute).trim());
  if (element.getAttribute(attribute) !== localized) element.setAttribute(attribute, localized);
  languages.set(attribute, currentLanguage);
}

function localizeTree(root = document, dynamic = false) {
  document.documentElement.lang = currentLanguage;
  if (languageSelect) languageSelect.value = currentLanguage;
  // ⚡ Bolt Optimization: Combine text node and element traversal into a single TreeWalker pass.
  // This eliminates the need for a separate querySelectorAll pass, significantly reducing DOM
  // traversal overhead and avoiding double-processing of the DOM tree.

  // Explicitly check the root node first since TreeWalker skips it
  if (root.nodeType === Node.ELEMENT_NODE) {
    if (root.hasAttribute("placeholder")) localizeAttribute(root, "placeholder", dynamic);
    if (root.hasAttribute("aria-label")) localizeAttribute(root, "aria-label", dynamic);
    if (root.hasAttribute("title")) localizeAttribute(root, "title", dynamic);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) {
      localizeTextNode(node, dynamic);
    } else {
      if (node.hasAttribute("placeholder")) localizeAttribute(node, "placeholder", dynamic);
      if (node.hasAttribute("aria-label")) localizeAttribute(node, "aria-label", dynamic);
      if (node.hasAttribute("title")) localizeAttribute(node, "title", dynamic);
    }
  }
}

function setLanguage(language) {
  if (!(language in { en: true, ru: true, de: true })) return;
  currentLanguage = language;
  try {
    localStorage.setItem("qorum-language", language);
  } catch (error) {
    console.warn("Could not save the language preference.", error);
  }
  localizeTree();
  renderGames();
  refreshOpenRoomsUI();
  if (document.getElementById("public-stats")) void loadPublicPlaytime();
  if (document.getElementById("profile-game-times")) void updateProfileUI(currentUser);
}

const languageObserver = new MutationObserver(records => {
  for (const record of records) {
    if (record.type === "characterData") {
      localizeTextNode(record.target, true);
    } else {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node, true);
        else if (node.nodeType === Node.ELEMENT_NODE) localizeTree(node, true);
      });
      if (record.type === "attributes") localizeAttribute(record.target, record.attributeName, true);
    }
  }
});
languageObserver.observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["placeholder", "aria-label", "title"],
});
localizeTree();
if (languageSelect) languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));

function formatDuration(seconds) {
  const totalSec = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(totalSec / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (currentLanguage === "ru") return hours
    ? `${hours} ч ${remainingMinutes} мин`
    : `${remainingMinutes} мин`;
  if (currentLanguage === "de") return hours
    ? `${hours} Std. ${remainingMinutes} Min.`
    : `${remainingMinutes} Min.`;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function renderGameCard(game) {
  const bestScore = Number(localStorage.getItem(`playroom-score-${game.id}`)) || 0;
  let scoreLabel = translatedValue("Ready to play");
  if (bestScore) {
    if (game.id === "memory-garden") {
      scoreLabel = `${translatedValue("Best ")}${bestScore} ${translatedValue("moves")}`;
    } else if (game.multiplayer) {
      scoreLabel = `${translatedValue("Wins: ")}${bestScore}`;
    } else {
      scoreLabel = `${translatedValue("Best ")}${bestScore}`;
    }
  } else if (game.multiplayer) {
    scoreLabel = translatedValue("Online · 2P · AI");
  }
  const modePill = game.multiplayer
    ? `<span class="cover-mode-pill mp">⚔️ ${translatedValue("ONLINE MULTIPLAYER")}</span>`
    : `<span class="cover-mode-pill">🕹️ ${translatedValue("SOLO ARCADE")}</span>`;
  return `<article class="game-card${game.multiplayer ? " is-multiplayer" : ""}">
    <div class="game-cover ${game.cover}">
      ${modePill}
      <span class="cover-symbol" aria-hidden="true">${game.symbol}</span>
      <span class="cover-label">${translatedValue(game.badge)}</span>
    </div>
    <div class="game-info">
      <div class="game-title-line">
        <h3 class="game-title">${translatedValue(game.title)}</h3>
        <span class="game-rating${game.multiplayer ? " mp-tag" : ""}">${translatedValue(game.multiplayer ? "1v1 ONLINE" : "FREE")}</span>
      </div>
      <p class="game-desc-short">${translatedValue(game.shortDesc || game.instructions)}</p>
      <div class="game-meta"><span>${translatedValue(game.genre)}</span><span class="price">${scoreLabel}</span></div>
      <div class="game-playtime">${translatedValue("Your play time · ")}${formatDuration(personalGameSeconds[game.id])}</div>
      <div class="game-actions">
        <span class="library-status">${game.multiplayer ? `🌐 ${translatedValue("Room / 2P / AI")}` : translatedValue("✓ In your games")}</span>
        <button class="primary-button" type="button" data-play="${game.id}">${translatedValue(game.multiplayer ? "Play match" : "Play now")}</button>
      </div>
    </div>
  </article>`;
}

function renderGames() {
  const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filterPass = game => {
    if (activeFilter === "multiplayer" && !game.multiplayer) return false;
    if (activeFilter === "solo" && game.multiplayer) return false;
    const searchable = `${game.title} ${translatedValue(game.title)} ${game.genre} ${translatedValue(game.genre)} ${game.shortDesc || ""}`.toLowerCase();
    return searchable.includes(query);
  };
  const matched = games.filter(filterPass);
  const ownedGames = games.filter(game => library.includes(game.id) && filterPass(game));
  if (featuredGames) {
    featuredGames.innerHTML = matched.map(game => renderGameCard(game)).join("")
      || `<div class="empty-state">${translatedValue("No games match that search. Try another title or genre.")}</div>`;
  }
  if (libraryGames) {
    libraryGames.innerHTML = ownedGames.map(game => renderGameCard(game)).join("")
      || `<div class="empty-state">${translatedValue("No games match that search. Try another title or genre.")}</div>`;
  }
  const libraryCount = document.getElementById("library-count");
  const libraryTotal = document.getElementById("library-total");
  if (libraryCount) libraryCount.textContent = library.length;
  if (libraryTotal) libraryTotal.textContent = library.length;
}

document.querySelectorAll("#game-filters [data-filter]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll("#game-filters [data-filter]").forEach(b => b.classList.toggle("active", b === btn));
    renderGames();
  });
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = translatedValue(message);
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function setAvatar(element, username, avatarPath) {
  if (!element) return;
  if (avatarPath && backendClient) {
    const { data } = backendClient.storage.from("avatars").getPublicUrl(avatarPath);
    const image = document.createElement("img");
    image.src = data.publicUrl;
    image.alt = `${username} avatar`;
    element.replaceChildren(image);
  } else {
    element.textContent = username ? username.slice(0, 1).toUpperCase() : "?";
  }
}

function openAuth(mode) {
  if (!authModal) return;
  authMode = mode;
  ensureRecoveryUI();
  authView = "credentials";
  const usernameInput = document.getElementById("auth-username");
  document.getElementById("modal-title").textContent = mode === "signin" ? "Welcome back" : "Join QORUM";
  document.getElementById("modal-description").textContent = mode === "signin" ? "Sign in with your username and password." : "Create an account without an email address.";
  document.getElementById("auth-submit").textContent = mode === "signin" ? "Sign in" : "Create account";
  document.getElementById("modal-switch").textContent = mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in";
  document.getElementById("auth-username-label").firstChild.textContent = mode === "signin" ? "Username" : "Choose a username";
  document.getElementById("auth-username").autocomplete = "username";
  const passwordInput = document.getElementById("auth-password");
  passwordInput.minLength = 8;
  passwordInput.maxLength = 72;
  passwordInput.placeholder = mode === "signin" ? "Your password" : "At least 8 characters";
  passwordInput.autocomplete = mode === "signin" ? "current-password" : "new-password";
  const demoNote = authModal.querySelector(".demo-note");
  if (demoNote) demoNote.textContent = mode === "signin"
    ? "No email address is used. Forgot your password? Use your recovery code."
    : "Save the one-time recovery code after creating your account. It cannot be shown again.";
  document.getElementById("form-error").textContent = "";
  setAuthView("credentials");
  authModal.classList.add("open");
  usernameInput.focus();
}

function ensureRecoveryUI() {
  const form = document.getElementById("auth-form");
  if (!form || document.getElementById("forgot-password-button")) return;

  const forgotButton = document.createElement("button");
  forgotButton.type = "button";
  forgotButton.id = "forgot-password-button";
  forgotButton.className = "modal-switch";
  forgotButton.textContent = "Forgot password? Use a recovery code";
  forgotButton.addEventListener("click", () => {
    authView = "recovery";
    setAuthView("recovery");
    document.getElementById("recovery-username").focus();
  });
  form.append(forgotButton);

  const recoveryForm = document.createElement("section");
  recoveryForm.id = "recovery-form-view";
  recoveryForm.className = "account-recovery-view";
  recoveryForm.hidden = true;
  recoveryForm.innerHTML = `
    <h3>Recover your account</h3>
    <p>Enter your username, saved recovery code, and a new password.</p>
    <label class="form-field">Username<input id="recovery-username" type="text" minlength="3" maxlength="24" autocomplete="username"></label>
    <label class="form-field">Recovery code<input id="recovery-code" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    <label class="form-field">New password<input id="recovery-new-password" type="password" minlength="8" maxlength="72" autocomplete="new-password"></label>
    <p class="form-error" id="recovery-error" aria-live="polite"></p>
    <button class="primary-button modal-submit" type="button" id="recovery-submit">Reset password</button>
    <button class="modal-switch" type="button" id="recovery-back">Back to sign in</button>`;
  form.append(recoveryForm);

  const savingView = document.createElement("section");
  savingView.id = "recovery-saving-view";
  savingView.className = "account-recovery-view";
  savingView.hidden = true;
  savingView.innerHTML = `
    <h3>Saving recovery code</h3>
    <p id="recovery-saving-message">Your account is created. Keep this window open while the recovery code is saved.</p>
    <button class="primary-button modal-submit" type="button" id="recovery-save-retry">Try saving again</button>`;
  form.append(savingView);

  const codeView = document.createElement("section");
  codeView.id = "recovery-code-view";
  codeView.className = "account-recovery-view";
  codeView.hidden = true;
  codeView.innerHTML = `
    <h3>Save your recovery code</h3>
    <p>This code is shown only once. Keep it private and store it somewhere safe. It is not your password.</p>
    <p class="recovery-username-line">Username: <strong id="recovery-card-username"></strong></p>
    <code class="recovery-code-value" id="recovery-card-code"></code>
    <div class="profile-actions">
      <button class="secondary-button" type="button" id="recovery-copy">Copy code</button>
      <button class="secondary-button" type="button" id="recovery-download">Download recovery card</button>
    </div>
    <p class="profile-note" id="recovery-card-status" aria-live="polite"></p>
    <button class="primary-button modal-submit" type="button" id="recovery-continue">I've saved it — continue</button>`;
  form.append(codeView);

  document.getElementById("recovery-back").addEventListener("click", () => {
    authMode = "signin";
    authView = "credentials";
    setAuthView("credentials");
  });
  document.getElementById("recovery-submit").addEventListener("click", submitAccountRecovery);
  document.getElementById("recovery-save-retry").addEventListener("click", savePendingRecoveryCode);
  document.getElementById("recovery-copy").addEventListener("click", async () => {
    if (!pendingRecovery) return;
    try {
      await navigator.clipboard.writeText(pendingRecovery.code);
      document.getElementById("recovery-card-status").textContent = "Recovery code copied. Store it privately.";
    } catch (error) {
      console.error("Could not copy the recovery code.", error);
      document.getElementById("recovery-card-status").textContent = "Copy failed. Select the code and copy it manually.";
    }
  });
  document.getElementById("recovery-download").addEventListener("click", downloadRecoveryCard);
  document.getElementById("recovery-continue").addEventListener("click", acknowledgeRecoveryCode);
}

function setAuthView(view) {
  const credentials = view === "credentials";
  const recovery = view === "recovery";
  const saving = view === "saving";
  const code = view === "code";
  const title = document.getElementById("modal-title");
  const description = document.getElementById("modal-description");
  const usernameLabel = document.getElementById("auth-username-label");
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const passwordLabel = passwordInput.closest(".form-field");
  const demoNote = authModal.querySelector(".demo-note");
  usernameLabel.hidden = !credentials;
  passwordLabel.hidden = !credentials;
  usernameInput.required = credentials;
  passwordInput.required = credentials;
  document.getElementById("auth-submit").hidden = !credentials;
  document.getElementById("modal-switch").hidden = !credentials;
  document.getElementById("forgot-password-button").hidden = !credentials || authMode !== "signin";
  document.getElementById("form-error").hidden = !credentials;
  document.getElementById("recovery-form-view").hidden = !recovery;
  document.getElementById("recovery-saving-view").hidden = !saving;
  document.getElementById("recovery-code-view").hidden = !code;
  if (demoNote) demoNote.hidden = !credentials;
  if (recovery) {
    title.textContent = "Account recovery";
    description.textContent = "No email is needed; use the recovery code saved when you registered.";
    document.getElementById("recovery-error").textContent = "";
  } else if (saving) {
    title.textContent = "Almost done";
    description.textContent = "Your account is ready. Save your recovery code before continuing.";
  } else if (code) {
    title.textContent = "Keep your account safe";
    description.textContent = "Save your recovery code before leaving this page.";
  } else {
    title.textContent = authMode === "signin" ? "Welcome back" : "Join QORUM";
    description.textContent = authMode === "signin"
      ? "Sign in with your username and password."
      : "Create an account without an email address.";
  }
}

function usernameAuthEmail(username) {
  return `${username.toLowerCase()}@tairusein.github.io`;
}

async function functionErrorMessage(error, fallback) {
  if (typeof error?.context?.json === "function") {
    try {
      const response = await error.context.json();
      if (typeof response?.error === "string") return response.error;
    } catch (parseError) {
      console.error("Could not read the account service error.", parseError);
    }
  }
  return error?.message || fallback;
}

async function hashRecoveryCode(code) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function savePendingRecoveryCode() {
  if (!pendingRecovery || !backendClient) return;
  const currentRecovery = pendingRecovery;
  const retryButton = document.getElementById("recovery-save-retry");
  recoverySaveInProgress = true;
  retryButton.disabled = true;
  const hash = await hashRecoveryCode(currentRecovery.code);
  const { error } = await backendClient.rpc("store_account_recovery_key", {
    p_recovery_code_hash: hash,
  });
  recoverySaveInProgress = false;
  retryButton.disabled = false;
  if (pendingRecovery !== currentRecovery) return;
  if (error) {
    console.error("Could not securely save the account recovery code.", error);
    document.getElementById("recovery-saving-message").textContent =
      "The account was created, but the recovery code has not been saved yet. Keep this window open and try again.";
    return;
  }
  document.getElementById("recovery-card-username").textContent = pendingRecovery.username;
  document.getElementById("recovery-card-code").textContent = pendingRecovery.code;
  document.getElementById("recovery-card-status").textContent = "You can also save this code in a password manager.";
  authView = "code";
  setAuthView("code");
}

function downloadRecoveryCard() {
  if (!pendingRecovery) return;
  const username = pendingRecovery.username;
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 620;
  const context = canvas.getContext("2d");
  if (!context) {
    showToast("Could not create the recovery card.");
    return;
  }
  context.fillStyle = "#17181a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#e9e7e1";
  context.font = "700 48px system-ui, sans-serif";
  context.fillText("QORUM account recovery", 72, 112);
  context.fillStyle = "#a3a29d";
  context.font = "28px system-ui, sans-serif";
  context.fillText("Keep this code private. It can reset your password once.", 72, 170);
  context.fillStyle = "#a3a29d";
  context.font = "24px system-ui, sans-serif";
  context.fillText("USERNAME", 72, 260);
  context.fillStyle = "#e9e7e1";
  context.font = "600 34px system-ui, sans-serif";
  context.fillText(pendingRecovery.username, 72, 310);
  context.fillStyle = "#a3a29d";
  context.font = "24px system-ui, sans-serif";
  context.fillText("ONE-TIME RECOVERY CODE", 72, 400);
  context.fillStyle = "#e9e7e1";
  context.font = "28px ui-monospace, Consolas, monospace";
  context.fillText(pendingRecovery.code, 72, 452);
  context.fillStyle = "#a3a29d";
  context.font = "20px system-ui, sans-serif";
  context.fillText("This card does not contain your password.", 72, 540);
  canvas.toBlob(blob => {
    if (!blob) {
      showToast("Could not create the recovery card.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qorum-recovery-${username}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.getElementById("recovery-card-status").textContent =
      "Recovery card downloaded. Keep the image somewhere private.";
  }, "image/png");
}

function acknowledgeRecoveryCode() {
  const recoveredUsername = pendingRecovery?.afterRecovery ? pendingRecovery.username : null;
  const loginAfterSignup = pendingRecovery?.loginAfterSignup ? pendingRecovery.username : null;
  pendingRecovery = null;
  document.getElementById("recovery-card-code").textContent = "";
  document.getElementById("recovery-card-username").textContent = "";
  if (recoveredUsername) {
    authMode = "signin";
    document.getElementById("auth-username").value = recoveredUsername;
    document.getElementById("auth-password").value = "";
    document.getElementById("form-error").textContent = "Password reset. Sign in with your new password.";
    authView = "credentials";
    setAuthView("credentials");
    document.getElementById("auth-password").focus();
  } else if (loginAfterSignup) {
    authMode = "signin";
    document.getElementById("auth-username").value = loginAfterSignup;
    document.getElementById("auth-password").value = "";
    document.getElementById("form-error").textContent = "Your account is ready. Sign in with your username and password.";
    authView = "credentials";
    setAuthView("credentials");
    document.getElementById("auth-password").focus();
  } else {
    authModal.classList.remove("open");
    authView = "credentials";
    setAuthView("credentials");
  }
}

function closeAuthModal() {
  if (recoverySaveInProgress) {
    showToast("Wait until the recovery code is saved before closing this window.");
    return;
  }
  if (pendingRecovery && !window.confirm("The recovery code is shown only once. If you close now, you may not be able to recover this account. Close anyway?")) {
    return;
  }
  pendingRecovery = null;
  const code = document.getElementById("recovery-card-code");
  const username = document.getElementById("recovery-card-username");
  if (code) code.textContent = "";
  if (username) username.textContent = "";
  authModal.classList.remove("open");
  authView = "credentials";
  setAuthView("credentials");
}

window.addEventListener("beforeunload", event => {
  if (!pendingRecovery) return;
  event.preventDefault();
  event.returnValue = "";
});

async function submitAccountRecovery() {
  if (!backendClient) return;
  const username = document.getElementById("recovery-username").value.trim();
  const recoveryCode = document.getElementById("recovery-code").value.trim();
  const newPassword = document.getElementById("recovery-new-password").value;
  const errorMessage = document.getElementById("recovery-error");
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || !/^[A-Za-z0-9_-]{43}$/.test(recoveryCode)
    || newPassword.length < 8 || newPassword.length > 72) {
    errorMessage.textContent = "Enter a valid username and recovery code, and a password between 8 and 72 characters.";
    return;
  }

  const submit = document.getElementById("recovery-submit");
  submit.disabled = true;
  errorMessage.textContent = "";
  const { data, error } = await backendClient.functions.invoke("recover-account", {
    body: { username, recoveryCode, newPassword },
  });
  submit.disabled = false;
  if (error || !data?.success) {
    if (error) console.error("Account recovery failed.", error);
    errorMessage.textContent = data?.error || "The username or recovery code is incorrect, or recovery is temporarily unavailable.";
    return;
  }
  if (typeof data.recoveryCode !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.recoveryCode)) {
    errorMessage.textContent = "The password was changed, but a new recovery code could not be confirmed. Contact the site owner before continuing.";
    return;
  }
  document.getElementById("recovery-code").value = "";
  document.getElementById("recovery-new-password").value = "";
  pendingRecovery = { username, code: data.recoveryCode, afterRecovery: true };
  document.getElementById("recovery-card-username").textContent = username;
  document.getElementById("recovery-card-code").textContent = data.recoveryCode;
  document.getElementById("recovery-card-status").textContent = "Your previous recovery code was used. Save this replacement code before signing in.";
  authView = "code";
  setAuthView("code");
}

const gameModal = document.getElementById("game-modal");
const gameStage = document.getElementById("game-stage");
let activeGameId = null;

function rememberScore(gameId, score) {
  const key = `playroom-score-${gameId}`;
  const best = Number(localStorage.getItem(key)) || 0;
  if (score > best) localStorage.setItem(key, String(score));
  renderGames();
}

function recordMultiplayerWin(gameId) {
  const key = `playroom-score-${gameId}`;
  const wins = (Number(localStorage.getItem(key)) || 0) + 1;
  localStorage.setItem(key, String(wins));
  renderGames();
}

function drawCanvasMessage(context, canvas, title, subtitle) {
  context.save();
  context.fillStyle = "rgba(14, 17, 20, .78)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(197, 209, 180, .28)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.roundRect(canvas.width / 2 - 220, canvas.height / 2 - 58, 440, 116, 16);
  context.fillStyle = "rgba(26, 30, 36, .95)";
  context.fill();
  context.stroke();
  context.textAlign = "center";
  context.fillStyle = "#f0eee8";
  context.font = "800 24px Inter, system-ui, sans-serif";
  context.fillText(translatedValue(title), canvas.width / 2, canvas.height / 2 - 8);
  context.fillStyle = "#b8bcb6";
  context.font = "600 13px Inter, system-ui, sans-serif";
  context.fillText(translatedValue(subtitle), canvas.width / 2, canvas.height / 2 + 22);
  context.restore();
}

function spawnFloatingReaction(emoji, side = "right") {
  if (!gameStage) return;
  const el = document.createElement("div");
  el.className = "floating-reaction";
  el.textContent = emoji;
  el.style.left = side === "left" ? `${20 + Math.random() * 15}%` : `${65 + Math.random() * 15}%`;
  gameStage.appendChild(el);
  window.setTimeout(() => el.remove(), 1850);
}

/* ============================================================================
 * GLOBAL LOBBY & MULTIPLAYER ENGINE (Supabase Realtime + BroadcastChannel)
 * ============================================================================ */
const GAME_PREFIX_MAP = {
  "tic-tac-toe": "T",
  "neon-duel": "H",
  "connect-four": "C",
  "tank-brawl": "B"
};
const PREFIX_GAME_MAP = {
  T: "tic-tac-toe",
  H: "neon-duel",
  C: "connect-four",
  B: "tank-brawl"
};

const openLobbyRooms = new Map();
let globalLobbyChannel = null;
let globalLobbyLocalBC = null;

function initGlobalLobby() {
  const handleAnnouncement = payload => {
    if (!payload || !payload.roomCode) return;
    if (payload.closed) {
      openLobbyRooms.delete(payload.roomCode);
    } else {
      openLobbyRooms.set(payload.roomCode, {
        roomCode: payload.roomCode,
        gameId: payload.gameId,
        hostName: payload.hostName || "Player",
        updatedAt: Date.now()
      });
    }
    refreshOpenRoomsUI();
  };

  if ("BroadcastChannel" in window) {
    globalLobbyLocalBC = new BroadcastChannel("qorum-global-lobby");
    globalLobbyLocalBC.onmessage = ev => handleAnnouncement(ev.data);
  }
  if (backendClient) {
    globalLobbyChannel = backendClient.channel("qorum-global-lobby", {
      config: { broadcast: { self: false } }
    });
    globalLobbyChannel.on("broadcast", { event: "room-announce" }, ({ payload }) => {
      handleAnnouncement(payload);
    }).subscribe();
  }
  window.setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [code, info] of openLobbyRooms.entries()) {
      if (now - info.updatedAt > 10000) {
        openLobbyRooms.delete(code);
        changed = true;
      }
    }
    if (changed) refreshOpenRoomsUI();
  }, 4000);
}

function broadcastLobbyRoom(payload) {
  if (globalLobbyLocalBC) {
    try { globalLobbyLocalBC.postMessage(payload); } catch (_e) {}
  }
  if (globalLobbyChannel) {
    try {
      globalLobbyChannel.send({
        type: "broadcast",
        event: "room-announce",
        payload
      });
    } catch (_e) {}
  }
}

function refreshOpenRoomsUI() {
  const hint = document.getElementById("lobby-live-hint");
  const activeRooms = [...openLobbyRooms.values()];
  if (hint) {
    if (activeRooms.length > 0) {
      hint.innerHTML = `${translatedValue("Open rooms right now:")} <strong>${activeRooms.length}</strong> — ` +
        activeRooms.slice(0, 3).map(r => {
          const g = games.find(item => item.id === r.gameId);
          return `<button type="button" class="mp-small-btn primary" data-join-room="${r.roomCode}" data-join-game="${r.gameId}">${g ? g.symbol : "🎮"} ${r.roomCode} (${r.hostName})</button>`;
        }).join(" ");
    } else {
      hint.textContent = translatedValue("Enter a 5-character room code or create a room inside any online game");
    }
  }
  const modalRooms = document.getElementById("mp-open-rooms-list");
  if (modalRooms && activeGameId) {
    const gameRooms = activeRooms.filter(r => r.gameId === activeGameId);
    if (gameRooms.length) {
      modalRooms.innerHTML = `${translatedValue("Open rooms:")} ` + gameRooms.map(r =>
        `<button type="button" class="mp-small-btn primary" data-join-room="${r.roomCode}" data-join-game="${r.gameId}">${r.hostName} (${r.roomCode})</button>`
      ).join(" ");
    } else {
      modalRooms.textContent = translatedValue("No open rooms yet — click 'Create room' and share the code with a friend!");
    }
  }
}

function generateRoomCode(gameId) {
  const prefix = GAME_PREFIX_MAP[gameId] || "Q";
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createMultiplayerController({ game, container, extraToolbarHtml = "", onModeChange, onMessage, onPeerReady, onRematch }) {
  const clientId = "p_" + Math.random().toString(36).slice(2, 10);
  let mode = "online";
  let roomCode = "";
  let role = "host";
  let peerConnected = false;
  let myName = currentUser ? currentUsername : translatedValue("Player 1");
  let peerName = translatedValue("Waiting for opponent...");
  let supaChannel = null;
  let localBC = null;
  let announceTimer = null;
  let pingTimer = null;

  const lobbyWrap = document.createElement("div");
  lobbyWrap.className = "mp-lobby-bar";
  lobbyWrap.innerHTML = `
    <div class="mp-lobby-top">
      <div class="game-toolbar-group">
        <span class="toolbar-label">Mode:</span>
        <button type="button" class="mode-pill-btn mp-active" data-mp-mode="online">🌐 Online with friends</button>
        <button type="button" class="mode-pill-btn" data-mp-mode="local">👥 2 Players (1 screen)</button>
        <button type="button" class="mode-pill-btn" data-mp-mode="bot">🤖 Vs AI</button>
      </div>
      <div class="game-toolbar-group" id="mp-extra-options">${extraToolbarHtml}</div>
    </div>
    <div class="mp-room-controls" id="mp-online-controls">
      <button type="button" class="mp-small-btn primary" id="mp-create-btn">➕ Create room</button>
      <form id="mp-join-form" style="display:inline-flex;gap:5px;align-items:center;">
        <input type="text" id="mp-code-field" class="mp-code-input" style="width:115px;padding:5px 8px;font-size:11px;" maxlength="8" placeholder="Room code">
        <button type="submit" class="mp-small-btn">Join</button>
      </form>
      <span class="mp-room-badge" id="mp-room-display" hidden><span>Room code</span>: <strong id="mp-room-code-text">-----</strong></span>
      <button type="button" class="mp-small-btn" id="mp-copy-code" hidden>📋 Copy code</button>
      <button type="button" class="mp-small-btn" id="mp-copy-link" hidden>🔗 Copy invite link</button>
      <button type="button" class="mp-small-btn" id="mp-send-chat" hidden>📨 Invite in chat</button>
      <span class="mp-status-pill waiting" id="mp-status-pill">Click 'Create room' or enter a room code</span>
    </div>
    <div class="mp-open-rooms" id="mp-open-rooms-list"></div>
    <div class="mp-vs-banner">
      <div class="mp-player-tag active-turn" id="mp-p1-tag">🟢 <span id="mp-p1-name">${myName}</span></div>
      <div class="mp-score-pill"><span id="mp-score-p1">0</span> : <span id="mp-score-p2">0</span></div>
      <div class="mp-player-tag" id="mp-p2-tag">🔵 <span id="mp-p2-name">Opponent / AI</span></div>
      <div class="mp-emoji-bar">
        <button type="button" class="mp-emoji-btn" data-react="🔥" title="Fire">🔥</button>
        <button type="button" class="mp-emoji-btn" data-react="😎" title="Cool">😎</button>
        <button type="button" class="mp-emoji-btn" data-react="😂" title="Laugh">😂</button>
        <button type="button" class="mp-emoji-btn" data-react="👏" title="Applause">👏</button>
        <button type="button" class="mp-emoji-btn" data-react="🤝" title="gg">🤝</button>
        <button type="button" class="mp-small-btn" id="mp-rematch-btn" title="New round / Rematch">↻ Rematch</button>
      </div>
    </div>
  `;
  container.prepend(lobbyWrap);
  localizeTree(lobbyWrap, true);
  refreshOpenRoomsUI();

  const statusPill = lobbyWrap.querySelector("#mp-status-pill");
  const roomDisplay = lobbyWrap.querySelector("#mp-room-display");
  const roomCodeText = lobbyWrap.querySelector("#mp-room-code-text");
  const copyCodeBtn = lobbyWrap.querySelector("#mp-copy-code");
  const copyLinkBtn = lobbyWrap.querySelector("#mp-copy-link");
  const sendChatBtn = lobbyWrap.querySelector("#mp-send-chat");
  const onlineControls = lobbyWrap.querySelector("#mp-online-controls");
  const openRoomsList = lobbyWrap.querySelector("#mp-open-rooms-list");
  const p1NameEl = lobbyWrap.querySelector("#mp-p1-name");
  const p2NameEl = lobbyWrap.querySelector("#mp-p2-name");
  const p1TagEl = lobbyWrap.querySelector("#mp-p1-tag");
  const p2TagEl = lobbyWrap.querySelector("#mp-p2-tag");
  const s1El = lobbyWrap.querySelector("#mp-score-p1");
  const s2El = lobbyWrap.querySelector("#mp-score-p2");

  function cleanupChannels() {
    window.clearInterval(announceTimer);
    window.clearInterval(pingTimer);
    if (roomCode && role === "host") {
      broadcastLobbyRoom({ roomCode, gameId: game.id, closed: true });
    }
    if (localBC) {
      try { localBC.close(); } catch (_e) {}
      localBC = null;
    }
    if (supaChannel && backendClient) {
      try { backendClient.removeChannel(supaChannel); } catch (_e) {}
      supaChannel = null;
    }
  }

  function sendPacket(type, data = {}) {
    if (mode !== "online" || !roomCode) return;
    const packet = { type, sender: clientId, role, senderName: myName, data, ts: Date.now() };
    if (localBC) {
      try { localBC.postMessage(packet); } catch (_e) {}
    }
    if (supaChannel) {
      try {
        supaChannel.send({
          type: "broadcast",
          event: "mp-packet",
          payload: packet
        });
      } catch (_e) {}
    }
  }

  function handleIncomingPacket(packet) {
    if (!packet || packet.sender === clientId) return;
    if (packet.type === "hello") {
      peerConnected = true;
      peerName = packet.senderName || (role === "host" ? translatedValue("Player 2") : translatedValue("Room host"));
      updateNamesUI();
      sendPacket("welcome", { hostName: myName });
      window.clearInterval(announceTimer);
      broadcastLobbyRoom({ roomCode, gameId: game.id, closed: true });
      if (onPeerReady) onPeerReady({ role, peerName });
      showToast(currentLanguage === "ru"
        ? `🎮 ${peerName} подключился к комнате!`
        : currentLanguage === "de"
          ? `🎮 ${peerName} ist dem Raum beigetreten!`
          : `🎮 ${peerName} joined the room!`);
      return;
    }
    if (packet.type === "welcome") {
      const wasConnected = peerConnected;
      peerConnected = true;
      peerName = packet.senderName || translatedValue("Room host");
      updateNamesUI();
      if (!wasConnected) {
        if (onPeerReady) onPeerReady({ role, peerName });
        showToast(currentLanguage === "ru"
          ? `⚡ Подключено к комнате ${roomCode} (${peerName})`
          : currentLanguage === "de"
            ? `⚡ Verbunden mit Raum ${roomCode} (${peerName})`
            : `⚡ Connected to room ${roomCode} (${peerName})`);
      }
      return;
    }
    if (packet.type === "reaction") {
      spawnFloatingReaction(packet.data.emoji, "left");
      return;
    }
    if (packet.type === "rematch") {
      showToast("Opponent started a rematch!");
      if (onRematch) onRematch(true);
      return;
    }
    if (onMessage) onMessage(packet.type, packet.data, packet);
  }

  function updateNamesUI() {
    myName = currentUser ? currentUsername : translatedValue("Player 1");
    if (mode === "local") {
      p1NameEl.textContent = translatedValue("Player 1");
      p2NameEl.textContent = translatedValue("Player 2");
    } else if (mode === "bot") {
      p1NameEl.textContent = myName;
      p2NameEl.textContent = translatedValue("AI Bot 🤖");
    } else {
      if (role === "host") {
        p1NameEl.textContent = `${myName} (${translatedValue("You · Host")})`;
        p2NameEl.textContent = peerConnected ? peerName : translatedValue("Waiting for opponent...");
      } else {
        p1NameEl.textContent = peerConnected ? peerName : translatedValue("Room host");
        p2NameEl.textContent = `${myName} (${translatedValue("You · Guest")})`;
      }
      if (peerConnected) {
        statusPill.className = "mp-status-pill connected";
        statusPill.textContent = currentLanguage === "ru"
          ? `🟢 В сети: ${peerName}`
          : currentLanguage === "de"
            ? `🟢 Verbunden mit ${peerName}`
            : `🟢 Connected with ${peerName}`;
      } else if (roomCode) {
        statusPill.className = "mp-status-pill waiting";
        statusPill.textContent = currentLanguage === "ru"
          ? `⏳ Ожидание игрока по коду ${roomCode}...`
          : currentLanguage === "de"
            ? `⏳ Warte auf Mitspieler (Code ${roomCode})...`
            : `⏳ Waiting for player with code ${roomCode}...`;
      }
    }
  }

  function connectToRoom(code, asRole) {
    cleanupChannels();
    mode = "online";
    roomCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    role = asRole;
    peerConnected = false;
    peerName = asRole === "host" ? translatedValue("Waiting for opponent...") : translatedValue("Connecting...");

    roomDisplay.hidden = false;
    roomCodeText.textContent = roomCode;
    copyCodeBtn.hidden = false;
    copyLinkBtn.hidden = false;
    sendChatBtn.hidden = false;
    updateNamesUI();

    const channelName = `qorum-room-${roomCode}`;
    if ("BroadcastChannel" in window) {
      localBC = new BroadcastChannel(channelName);
      localBC.onmessage = ev => handleIncomingPacket(ev.data);
    }
    if (backendClient) {
      supaChannel = backendClient.channel(channelName, {
        config: { broadcast: { self: false } }
      });
      supaChannel
        .on("broadcast", { event: "mp-packet" }, ({ payload }) => handleIncomingPacket(payload))
        .subscribe(status => {
          if (status === "SUBSCRIBED") {
            sendPacket("hello", {});
          }
        });
    }
    window.setTimeout(() => sendPacket("hello", {}), 80);
    pingTimer = window.setInterval(() => {
      if (!peerConnected) sendPacket("hello", {});
    }, 1800);

    if (role === "host") {
      const announce = () => {
        if (!peerConnected && mode === "online") {
          broadcastLobbyRoom({ roomCode, gameId: game.id, hostName: myName });
        }
      };
      announce();
      announceTimer = window.setInterval(announce, 3000);
    }
    if (onModeChange) onModeChange({ mode, role, roomCode, peerConnected });
  }

  function setMode(newMode) {
    cleanupChannels();
    mode = newMode;
    peerConnected = newMode !== "online";
    role = "host";
    lobbyWrap.querySelectorAll("[data-mp-mode]").forEach(btn => {
      btn.classList.toggle("mp-active", btn.dataset.mpMode === newMode);
    });
    onlineControls.style.display = newMode === "online" ? "flex" : "none";
    openRoomsList.style.display = newMode === "online" ? "flex" : "none";
    updateNamesUI();
    if (newMode === "online") {
      connectToRoom(generateRoomCode(game.id), "host");
    } else if (onModeChange) {
      onModeChange({ mode: newMode, role: "host", roomCode: "", peerConnected: true });
    }
  }

  lobbyWrap.querySelectorAll("[data-mp-mode]").forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mpMode));
  });

  lobbyWrap.querySelector("#mp-create-btn").addEventListener("click", () => {
    const code = generateRoomCode(game.id);
    connectToRoom(code, "host");
    showToast(currentLanguage === "ru"
      ? `Комната ${code} создана! Отправьте код или ссылку другу.`
      : currentLanguage === "de"
        ? `Raum ${code} erstellt! Teile den Code oder Link mit einem Freund.`
        : `Room ${code} created! Share the code or invite link with a friend.`);
  });

  lobbyWrap.querySelector("#mp-join-form").addEventListener("submit", ev => {
    ev.preventDefault();
    const input = lobbyWrap.querySelector("#mp-code-field");
    const raw = input.value.trim().toUpperCase();
    if (raw.length < 3) {
      showToast("Enter a room code (for example, T8K2M)");
      return;
    }
    connectToRoom(raw, "guest");
  });

  copyCodeBtn.addEventListener("click", async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      showToast(currentLanguage === "ru"
        ? `Код комнаты ${roomCode} скопирован!`
        : currentLanguage === "de"
          ? `Raumcode ${roomCode} kopiert!`
          : `Room code ${roomCode} copied!`);
    } catch (_e) {
      showToast(`${translatedValue("Room code")}: ${roomCode}`);
    }
  });

  copyLinkBtn.addEventListener("click", async () => {
    if (!roomCode) return;
    const baseUrl = window.location.href.split(/[?#]/)[0];
    const url = `${baseUrl}?game=${encodeURIComponent(game.id)}&room=${encodeURIComponent(roomCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invite link copied! Share it with a friend.");
    } catch (_e) {
      showToast(url);
    }
  });

  sendChatBtn.addEventListener("click", async () => {
    if (!roomCode) return;
    if (!backendClient || !currentUser) {
      showToast("Sign in or copy the invite link using the button!");
      return;
    }
    const { data: players } = await backendClient
      .from("profiles")
      .select("id,username")
      .neq("id", currentUser.id)
      .limit(10);
    if (!players || !players.length) {
      showToast("No other players in the list yet — share the direct invite link!");
      return;
    }
    const target = players[0];
    const inviteText = `Join me in ${translatedValue(game.title)}! ${translatedValue("Room code")}: ${roomCode} [QORUM_INVITE:${game.id}:${roomCode}]`;
    const { error } = await backendClient
      .from("direct_messages")
      .insert({ sender_id: currentUser.id, recipient_id: target.id, content: inviteText });
    if (!error) {
      showToast(currentLanguage === "ru"
        ? `Приглашение в комнату ${roomCode} отправлено игроку ${target.username}!`
        : currentLanguage === "de"
          ? `Einladung für Raum ${roomCode} an ${target.username} gesendet!`
          : `Room ${roomCode} invite sent to ${target.username}!`);
    } else {
      showToast("Could not send chat invite — copy the invite link instead.");
    }
  });

  lobbyWrap.querySelectorAll("[data-react]").forEach(btn => {
    btn.addEventListener("click", () => {
      const emoji = btn.dataset.react;
      spawnFloatingReaction(emoji, "right");
      sendPacket("reaction", { emoji });
    });
  });

  lobbyWrap.querySelector("#mp-rematch-btn").addEventListener("click", () => {
    sendPacket("rematch", {});
    if (onRematch) onRematch(false);
  });

  let destroyed = false;
  const initialJoinCode = pendingRoomJoinCode;
  pendingRoomJoinCode = null;
  if (initialJoinCode) lobbyWrap.querySelector("#mp-code-field").value = initialJoinCode;
  queueMicrotask(() => {
    if (destroyed) return;
    if (initialJoinCode) connectToRoom(initialJoinCode, "guest");
    else connectToRoom(generateRoomCode(game.id), "host");
  });

  return {
    getMode: () => mode,
    getRole: () => role,
    isPeerConnected: () => peerConnected,
    getRoomCode: () => roomCode,
    send: sendPacket,
    joinRoom: (code, asRole = "guest") => connectToRoom(code, asRole),
    setScore: (s1, s2) => {
      s1El.textContent = s1;
      s2El.textContent = s2;
    },
    setActiveTurn: (playerNum) => {
      p1TagEl.classList.toggle("active-turn", playerNum === 1);
      p2TagEl.classList.toggle("active-turn", playerNum === 2);
    },
    extraOptionsEl: lobbyWrap.querySelector("#mp-extra-options"),
    destroy: () => { destroyed = true; cleanupChannels(); }
  };
}

/* ============================================================================
 * SOLO GAME 1: SNAKE DELUXE (Combo, Golden Apples, Frost Berry, Portal Mode)
 * ============================================================================ */
function startSnake(game) {
  gameStage.innerHTML = `
    <div class="game-toolbar">
      <div class="game-toolbar-group">
        <span class="toolbar-label">Borders:</span>
        <button type="button" class="mode-pill-btn active" data-walls="solid">🧱 Solid walls (Classic)</button>
        <button type="button" class="mode-pill-btn" data-walls="wrap">🌀 Portal (Wrap around)</button>
      </div>
      <div class="game-toolbar-group">
        <button type="button" class="mode-pill-btn" id="snake-pause-btn">⏸ Pause (P)</button>
      </div>
    </div>
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score">
        <span><span>Combo:</span> <strong id="snake-combo">x1</strong></span>
        <span><span>Score:</span> <strong id="live-score">0</strong></span>
      </span>
    </div>
    <canvas class="arcade-canvas" width="720" height="384" aria-label="Snake"></canvas>
    <div class="game-stage-footer" id="game-touch-controls">
      <button class="game-control" data-direction="up" aria-label="Move up">↑</button>
      <button class="game-control" data-direction="left" aria-label="Move left">←</button>
      <button class="game-control" data-direction="down" aria-label="Move down">↓</button>
      <button class="game-control" data-direction="right" aria-label="Move right">→</button>
    </div>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  localizeTree(gameStage, true);
  const canvas = gameStage.querySelector("canvas");
  const context = canvas.getContext("2d");
  const cell = 24;
  const columns = canvas.width / cell;
  const rows = canvas.height / cell;

  let wrapWalls = false;
  let paused = false;
  let stopped = false;
  let snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  let direction = { x: 1, y: 0 };
  let turnQueue = [];
  let score = 0;
  let applesEaten = 0;
  let combo = 1;
  let comboUntil = 0;
  let slowUntil = 0;
  let fruit = { x: 18, y: 8 };
  let bonusFruit = null;
  const particles = [];
  const floatTexts = [];
  const endMessage = document.getElementById("game-end-message");

  function isOccupied(x, y) {
    return snake.some(p => p.x === x && p.y === y) ||
      (fruit && fruit.x === x && fruit.y === y) ||
      (bonusFruit && bonusFruit.x === x && bonusFruit.y === y);
  }

  function placeFruit() {
    let tries = 0;
    do {
      fruit = { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) };
      tries++;
    } while (snake.some(part => part.x === fruit.x && part.y === fruit.y) && tries < 200);
  }

  function spawnBonusFruit() {
    let x, y, tries = 0;
    do {
      x = Math.floor(Math.random() * columns);
      y = Math.floor(Math.random() * rows);
      tries++;
    } while (isOccupied(x, y) && tries < 200);
    const kind = Math.random() < 0.68 ? "gold" : "frost";
    bonusFruit = { x, y, kind, expiresAt: performance.now() + 7500 };
  }

  function burst(gx, gy, color) {
    const cx = gx * cell + cell / 2;
    const cy = gy * cell + cell / 2;
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const speed = 1.4 + Math.random() * 2.8;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color
      });
    }
  }

  function addFloatText(gx, gy, text, color) {
    floatTexts.push({
      x: gx * cell + cell / 2,
      y: gy * cell + 6,
      text,
      color,
      life: 1
    });
  }

  function draw() {
    const now = performance.now();
    context.fillStyle = "#151a18";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        if ((x + y) % 2 === 0) {
          context.fillStyle = "rgba(197, 209, 180, 0.018)";
          context.fillRect(x * cell, y * cell, cell, cell);
        }
      }
    }

    if (wrapWalls) {
      context.strokeStyle = "rgba(132, 197, 203, 0.38)";
      context.lineWidth = 3;
      context.setLineDash([8, 6]);
      context.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
      context.setLineDash([]);
    }

    if (combo > 1 && now < comboUntil) {
      const ratio = Math.max(0, (comboUntil - now) / 3600);
      context.fillStyle = "rgba(226, 190, 126, 0.85)";
      context.fillRect(0, 0, canvas.width * ratio, 4);
    }

    const pulse = 1 + Math.sin(now / 180) * 0.1;
    const fx = fruit.x * cell + cell / 2;
    const fy = fruit.y * cell + cell / 2;
    context.fillStyle = "rgba(229, 133, 123, 0.18)";
    context.beginPath();
    context.arc(fx, fy, cell * 0.48 * pulse, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#e5857b";
    context.beginPath();
    context.arc(fx, fy + 1, cell * 0.35, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#a7d489";
    context.beginPath();
    context.ellipse(fx + 3, fy - 7, 4, 2, -0.5, 0, Math.PI * 2);
    context.fill();

    if (bonusFruit) {
      if (now > bonusFruit.expiresAt) {
        bonusFruit = null;
      } else {
        const bx = bonusFruit.x * cell + cell / 2;
        const by = bonusFruit.y * cell + cell / 2;
        const isGold = bonusFruit.kind === "gold";
        context.fillStyle = isGold ? "rgba(226, 190, 126, 0.25)" : "rgba(132, 197, 203, 0.25)";
        context.beginPath();
        context.arc(bx, by, cell * 0.52 * pulse, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = isGold ? "#f2cc76" : "#84c5cb";
        context.beginPath();
        context.arc(bx, by, cell * 0.37, 0, Math.PI * 2);
        context.fill();
      }
    }

    const isSlow = now < slowUntil;
    snake.forEach((part, index) => {
      const ratio = 1 - (index / Math.max(1, snake.length)) * 0.45;
      if (index === 0) {
        context.fillStyle = isSlow ? "#98e4ec" : "#d4e4c0";
      } else {
        context.fillStyle = isSlow
          ? `rgba(120, 192, 204, ${0.45 + ratio * 0.5})`
          : `rgba(154, 178, 138, ${0.42 + ratio * 0.52})`;
      }
      const pad = index === 0 ? 1.5 : 2.5;
      context.beginPath();
      context.roundRect(part.x * cell + pad, part.y * cell + pad, cell - pad * 2, cell - pad * 2, index === 0 ? 8 : 6);
      context.fill();

      if (index === 0) {
        const cx = part.x * cell + cell / 2;
        const cy = part.y * cell + cell / 2;
        const perpX = -direction.y;
        const perpY = direction.x;
        context.fillStyle = "#1c221b";
        context.beginPath();
        context.arc(cx + direction.x * 4 + perpX * 4.5, cy + direction.y * 4 + perpY * 4.5, 2.3, 0, Math.PI * 2);
        context.arc(cx + direction.x * 4 - perpX * 4.5, cy + direction.y * 4 - perpY * 4.5, 2.3, 0, Math.PI * 2);
        context.fill();
      }
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      context.globalAlpha = p.life;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const ft = floatTexts[i];
      ft.y -= 0.9;
      ft.life -= 0.04;
      if (ft.life <= 0) {
        floatTexts.splice(i, 1);
        continue;
      }
      context.globalAlpha = ft.life;
      context.fillStyle = ft.color;
      context.font = "800 13px Inter, sans-serif";
      context.textAlign = "center";
      context.fillText(ft.text, ft.x, ft.y);
      context.globalAlpha = 1;
    }

    if (paused && !stopped) {
      drawCanvasMessage(context, canvas, "Paused", "Press P or the Pause button to continue");
    }
  }

  function endGame() {
    stopped = true;
    endMessage.textContent = `${translatedValue("Game over · Final score ")}${score}${translatedValue(". Press ↻ to try again.")}`;
    rememberScore("snake", score);
    draw();
    drawCanvasMessage(context, canvas, "Nice try!", `${translatedValue("Your score: ")}${score} · ${translatedValue("Press ↻ to play again")}`);
  }

  function stepSnake() {
    if (stopped || paused) return;
    const now = performance.now();
    if (combo > 1 && now > comboUntil) {
      combo = 1;
      const comboEl = document.getElementById("snake-combo");
      if (comboEl) comboEl.textContent = "x1";
    }
    if (turnQueue.length) {
      direction = turnQueue.shift();
    }
    let head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    if (wrapWalls) {
      head.x = (head.x + columns) % columns;
      head.y = (head.y + rows) % rows;
    } else if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows) {
      endGame();
      return;
    }

    const eatingRegular = head.x === fruit.x && head.y === fruit.y;
    const eatingBonus = bonusFruit && head.x === bonusFruit.x && head.y === bonusFruit.y;
    const bodyToCheck = (eatingRegular || eatingBonus) ? snake : snake.slice(0, -1);

    if (bodyToCheck.some(part => part.x === head.x && part.y === head.y)) {
      endGame();
      return;
    }

    snake.unshift(head);
    if (eatingRegular || eatingBonus) {
      if (now <= comboUntil) {
        combo = Math.min(4, combo + 1);
      } else {
        combo = 1;
      }
      comboUntil = now + 3600;
      const comboEl = document.getElementById("snake-combo");
      if (comboEl) comboEl.textContent = `x${combo}`;

      if (eatingRegular) {
        const pts = 1 * combo;
        score += pts;
        applesEaten += 1;
        burst(head.x, head.y, "#e5857b");
        addFloatText(head.x, head.y, combo > 1 ? `+${pts} (x${combo}!)` : `+${pts}`, "#f0eee8");
        placeFruit();
        if (applesEaten % 4 === 0 && !bonusFruit) spawnBonusFruit();
      } else if (eatingBonus) {
        if (bonusFruit.kind === "gold") {
          const pts = 3 * combo;
          score += pts;
          burst(head.x, head.y, "#f2cc76");
          addFloatText(head.x, head.y, `+${pts} ✨`, "#f2cc76");
        } else {
          const pts = 2 * combo;
          score += pts;
          slowUntil = now + 6000;
          burst(head.x, head.y, "#84c5cb");
          addFloatText(head.x, head.y, `❄️ +${pts}`, "#84c5cb");
        }
        bonusFruit = null;
      }
      const liveScoreEl = document.getElementById("live-score");
      if (liveScoreEl) liveScoreEl.textContent = score;
      rememberScore("snake", score);
    } else {
      snake.pop();
    }
  }

  function queueTurn(x, y) {
    const ref = turnQueue.length ? turnQueue[turnQueue.length - 1] : direction;
    if ((x !== -ref.x || y !== -ref.y) && (x !== ref.x || y !== ref.y) && turnQueue.length < 2) {
      turnQueue.push({ x, y });
    }
  }

  function onKeyDown(event) {
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      paused = !paused;
      return;
    }
    const keys = {
      ArrowUp: [0, -1], w: [0, -1],
      ArrowDown: [0, 1], s: [0, 1],
      ArrowLeft: [-1, 0], a: [-1, 0],
      ArrowRight: [1, 0], d: [1, 0]
    };
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keys[key]) {
      event.preventDefault();
      queueTurn(...keys[key]);
    }
  }

  gameStage.querySelectorAll("[data-walls]").forEach(btn => {
    btn.addEventListener("click", () => {
      wrapWalls = btn.dataset.walls === "wrap";
      gameStage.querySelectorAll("[data-walls]").forEach(b => b.classList.toggle("active", b === btn));
    });
  });

  document.getElementById("snake-pause-btn").addEventListener("click", () => {
    paused = !paused;
  });

  document.addEventListener("keydown", onKeyDown);
  document.getElementById("game-touch-controls").addEventListener("click", event => {
    const button = event.target.closest("[data-direction]");
    if (!button) return;
    const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    queueTurn(...directions[button.dataset.direction]);
  });

  let lastStep = performance.now();
  let animId = 0;
  function loop(now) {
    if (stopped) return;
    const baseDelay = Math.max(68, 114 - Math.min(36, Math.floor(score / 3) * 2));
    const stepDelay = now < slowUntil ? baseDelay * 1.32 : baseDelay;
    if (!paused && now - lastStep >= stepDelay) {
      lastStep = now;
      stepSnake();
    }
    if (!stopped) {
      draw();
      animId = requestAnimationFrame(loop);
    }
  }
  animId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(animId);
    document.removeEventListener("keydown", onKeyDown);
  };
}

/* ============================================================================
 * SOLO GAME 2: SKY HOPPER DELUXE (Feathers, Wind Shield, Moving Gates, Parallax)
 * ============================================================================ */
function startSkyHop(game) {
  gameStage.innerHTML = `
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score">
        <span><span>Feathers:</span> <strong id="sky-feathers">0/3</strong></span>
        <span><span>Shield:</span> <strong id="sky-shield">None</strong></span>
        <span><span>Score:</span> <strong id="live-score">0</strong></span>
      </span>
    </div>
    <canvas class="arcade-canvas" width="720" height="380" aria-label="Sky Hopper"></canvas>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  localizeTree(gameStage, true);
  const canvas = gameStage.querySelector("canvas");
  const context = canvas.getContext("2d");
  const player = { x: 155, y: 190, velocity: 0, radius: 13, shield: false, feathers: 0, invulnerableUntil: 0 };
  const obstacles = [];
  const feathers = [];
  const particles = [];
  const popups = [];
  const stars = Array.from({ length: 28 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * (canvas.height - 90),
    r: 0.8 + Math.random() * 1.6,
    speed: 0.25 + Math.random() * 0.4
  }));
  let score = 0;
  let started = false;
  let stopped = false;
  let frameId = 0;
  let lastTime = 0;
  const gap = 132;
  const endMessage = document.getElementById("game-end-message");

  function updateHud() {
    const fEl = document.getElementById("sky-feathers");
    const sEl = document.getElementById("sky-shield");
    const scEl = document.getElementById("live-score");
    if (fEl) fEl.textContent = `${player.feathers}/3`;
    if (sEl) {
      sEl.textContent = translatedValue(player.shield ? "🛡️ ACTIVE" : "None");
      sEl.style.color = player.shield ? "#84c5cb" : "";
    }
    if (scEl) scEl.textContent = score;
  }

  function createObstacle(x) {
    const margin = 52;
    const gapY = margin + Math.random() * (canvas.height - gap - margin * 2);
    const moving = score >= 5 && Math.random() < 0.45;
    obstacles.push({
      x,
      gapY,
      baseGapY: gapY,
      phase: Math.random() * Math.PI * 2,
      moving,
      scored: false
    });
    if (Math.random() < 0.65) {
      feathers.push({
        x: x + 135,
        y: 65 + Math.random() * (canvas.height - 130),
        taken: false,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function flap() {
    if (stopped) return;
    started = true;
    player.velocity = -7.1;
    endMessage.textContent = "";
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: player.x - 10,
        y: player.y + 4,
        vx: -1.5 - Math.random() * 1.8,
        vy: 1 + (Math.random() - 0.5) * 2,
        life: 1,
        color: "#e8e1d2"
      });
    }
  }

  function draw(timestamp) {
    const sky = context.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#1c2630");
    sky.addColorStop(0.6, "#28353c");
    sky.addColorStop(1, "#353c38");
    context.fillStyle = sky;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(232, 220, 190, .14)";
    context.beginPath();
    context.arc(580, 78, 42, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(242, 234, 212, .25)";
    context.beginPath();
    context.arc(580, 78, 28, 0, Math.PI * 2);
    context.fill();

    stars.forEach(st => {
      context.fillStyle = "rgba(255,255,255,0.45)";
      context.beginPath();
      context.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      context.fill();
    });

    obstacles.forEach(obstacle => {
      const grad = context.createLinearGradient(obstacle.x, 0, obstacle.x + 54, 0);
      grad.addColorStop(0, "#687870");
      grad.addColorStop(0.5, "#8da095");
      grad.addColorStop(1, "#5c6b63");
      context.fillStyle = grad;
      context.fillRect(obstacle.x, 0, 54, obstacle.gapY);
      context.fillRect(obstacle.x, obstacle.gapY + gap, 54, canvas.height - obstacle.gapY - gap);
      context.fillStyle = "#afc2b5";
      context.beginPath();
      context.roundRect(obstacle.x - 4, obstacle.gapY - 14, 62, 14, 4);
      context.roundRect(obstacle.x - 4, obstacle.gapY + gap, 62, 14, 4);
      context.fill();
    });

    feathers.forEach(f => {
      if (f.taken) return;
      const fy = f.y + Math.sin((timestamp || 0) / 240 + f.phase) * 6;
      context.save();
      context.translate(f.x, fy);
      context.fillStyle = "rgba(226, 190, 126, 0.24)";
      context.beginPath();
      context.arc(0, 0, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f2cc76";
      context.beginPath();
      context.ellipse(0, 0, 10, 5, -0.4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.045;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      context.globalAlpha = p.life;
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, 2.8 * p.life, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    context.save();
    context.translate(player.x, player.y);
    if (player.shield) {
      context.strokeStyle = "rgba(132, 197, 203, 0.8)";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, 21 + Math.sin((timestamp || 0) / 140) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    const angle = Math.max(-0.5, Math.min(0.65, player.velocity * 0.065));
    context.rotate(angle);
    context.fillStyle = "#d4c098";
    context.beginPath();
    context.ellipse(0, 0, 16, 11.5, 0, 0, Math.PI * 2);
    context.fill();
    const wingOffset = player.velocity < 0 ? -4 : 2;
    context.fillStyle = "#b8a27b";
    context.beginPath();
    context.ellipse(-3, wingOffset, 8, 5, -0.2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#f4efe2";
    context.beginPath();
    context.arc(6, -4, 3.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#222624";
    context.beginPath();
    context.arc(7, -4, 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#d98a6c";
    context.beginPath();
    context.moveTo(13, 0);
    context.lineTo(23, 3.5);
    context.lineTo(13, 7);
    context.fill();
    context.restore();

    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.y -= 0.8;
      pop.life -= 0.035;
      if (pop.life <= 0) {
        popups.splice(i, 1);
        continue;
      }
      context.globalAlpha = pop.life;
      context.fillStyle = pop.color;
      context.font = "800 13px Inter, sans-serif";
      context.textAlign = "center";
      context.fillText(pop.text, pop.x, pop.y);
      context.globalAlpha = 1;
    }
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    endMessage.textContent = `${translatedValue("Run over")} · ${translatedValue("You passed")} ${score} ${translatedValue(score === 1 ? "gate" : "gates")}. ${translatedValue("Press ↻ to fly again.")}`;
    rememberScore("sky-hop", score);
    drawCanvasMessage(context, canvas, "Lovely flight!", `${translatedValue("Final score ")}${score} · ${translatedValue("Press ↻ to try again")}`);
  }

  function loop(timestamp) {
    if (stopped) return;
    const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
    lastTime = timestamp;

    if (started) {
      player.velocity += 0.38 * delta;
      player.y += player.velocity * delta;

      stars.forEach(st => {
        st.x -= st.speed * delta;
        if (st.x < 0) st.x = canvas.width;
      });

      feathers.forEach(f => {
        f.x -= 2.55 * delta;
        if (!f.taken && Math.hypot(player.x - f.x, player.y - f.y) < player.radius + 12) {
          f.taken = true;
          score += 2;
          player.feathers += 1;
          if (player.feathers >= 3 && !player.shield) {
            player.feathers = 0;
            player.shield = true;
            popups.push({ x: player.x, y: player.y - 16, text: translatedValue("🛡️ WIND SHIELD!"), color: "#84c5cb", life: 1 });
          } else {
            popups.push({ x: player.x, y: player.y - 14, text: translatedValue("+2 FEATHER ✨"), color: "#f2cc76", life: 1 });
          }
          updateHud();
        }
      });

      obstacles.forEach(obstacle => {
        obstacle.x -= (2.55 + Math.min(1.1, score * 0.03)) * delta;
        if (obstacle.moving) {
          obstacle.gapY = obstacle.baseGapY + Math.sin(timestamp / 480 + obstacle.phase) * 28;
        }
        if (!obstacle.scored && obstacle.x + 54 < player.x) {
          obstacle.scored = true;
          score += 1;
          const topClearance = (player.y - player.radius) - obstacle.gapY;
          const bottomClearance = (obstacle.gapY + gap) - (player.y + player.radius);
          if (Math.min(topClearance, bottomClearance) < 10) {
            score += 1;
            popups.push({ x: player.x, y: player.y - 18, text: translatedValue("+1 CLOSE CALL! 🔥"), color: "#e5857b", life: 1 });
          }
          updateHud();
        }
        const overlapsX = player.x + player.radius > obstacle.x && player.x - player.radius < obstacle.x + 54;
        const outsideGap = player.y - player.radius < obstacle.gapY || player.y + player.radius > obstacle.gapY + gap;
        if (overlapsX && outsideGap && timestamp > player.invulnerableUntil) {
          if (player.shield) {
            player.shield = false;
            player.invulnerableUntil = timestamp + 1100;
            player.y = obstacle.gapY + gap / 2;
            player.velocity = -3.5;
            popups.push({ x: player.x, y: player.y - 14, text: translatedValue("🛡️ SHIELD SAVED YOU!"), color: "#84c5cb", life: 1 });
            updateHud();
          } else {
            finish();
          }
        }
      });

      while (obstacles.length && obstacles[0].x < -65) obstacles.shift();
      while (feathers.length && feathers[0].x < -40) feathers.shift();
      if (!obstacles.length || obstacles[obstacles.length - 1].x < canvas.width - 220) {
        createObstacle(canvas.width + 15);
      }
      if (player.y - player.radius < 0 || player.y + player.radius > canvas.height) {
        if (player.shield) {
          player.shield = false;
          player.y = canvas.height / 2;
          player.velocity = -4;
          updateHud();
        } else {
          finish();
        }
      }
    } else if (!obstacles.length) {
      createObstacle(canvas.width - 60);
    }

    draw(timestamp);
    if (stopped) {
      drawCanvasMessage(context, canvas, "Lovely flight!", `${translatedValue("Final score ")}${score} · ${translatedValue("Press ↻ to try again")}`);
    } else if (!started && timestamp > 0) {
      drawCanvasMessage(context, canvas, "Sky Hopper", "Press Space or click to take off · Collect feathers for a shield!");
    }
    if (!stopped) frameId = requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    if (event.code === "Space" || event.key === "ArrowUp") {
      event.preventDefault();
      flap();
    }
  }
  document.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointerdown", flap);
  frameId = requestAnimationFrame(loop);
  return () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    document.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointerdown", flap);
  };
}

/* ============================================================================
 * SOLO GAME 3: POCKET PONG PRO (Spin Curve, Smash Meter, Difficulty Levels)
 * ============================================================================ */
function startPong(game) {
  gameStage.innerHTML = `
    <div class="game-toolbar">
      <div class="game-toolbar-group">
        <span class="toolbar-label">AI:</span>
        <button type="button" class="mode-pill-btn" data-ai="2.4">Easy</button>
        <button type="button" class="mode-pill-btn active" data-ai="3.4">Normal</button>
        <button type="button" class="mode-pill-btn" data-ai="4.7">Pro</button>
      </div>
      <div class="game-toolbar-group">
        <span class="toolbar-label"><span>Smash Energy:</span> <strong id="pong-smash-status">0%</strong></span>
      </div>
    </div>
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score"><span>You</span> <strong id="player-score">0</strong> : <strong id="opponent-score">0</strong> <span>AI</span> <span>(to 7)</span></span>
    </div>
    <canvas class="arcade-canvas" width="720" height="380" aria-label="Pocket Pong"></canvas>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  localizeTree(gameStage, true);
  const canvas = gameStage.querySelector("canvas");
  const context = canvas.getContext("2d");
  const paddleHeight = 82;
  const player = { y: canvas.height / 2 - paddleHeight / 2, prevY: canvas.height / 2 - paddleHeight / 2, vy: 0, score: 0, smashEnergy: 0, smashArmed: false };
  const opponent = { y: canvas.height / 2 - paddleHeight / 2, score: 0 };
  const ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 4.5, vy: 2.2, spin: 0, smashing: false };
  const trail = [];
  const ripples = [];
  let aiSpeed = 3.4;
  let stopped = false;
  let frameId = 0;
  let lastTime = 0;
  const endMessage = document.getElementById("game-end-message");

  function updateSmashUI() {
    const el = document.getElementById("pong-smash-status");
    if (!el) return;
    if (player.smashArmed) {
      el.textContent = translatedValue("🔥 ARMED!");
      el.style.color = "#e5857b";
    } else if (player.smashEnergy >= 100) {
      el.textContent = translatedValue("⚡ READY (Space)");
      el.style.color = "#f2cc76";
    } else {
      el.textContent = `${Math.floor(player.smashEnergy)}%`;
      el.style.color = "";
    }
  }

  function armSmash() {
    if (player.smashEnergy >= 100 && !player.smashArmed) {
      player.smashArmed = true;
      updateSmashUI();
    }
  }

  function draw() {
    context.fillStyle = "#16191e";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(232, 230, 222, .11)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, 58, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([8, 10]);
    context.beginPath();
    context.moveTo(canvas.width / 2, 12);
    context.lineTo(canvas.width / 2, canvas.height - 12);
    context.stroke();
    context.setLineDash([]);

    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += 2.2;
      r.alpha -= 0.045;
      if (r.alpha <= 0) {
        ripples.splice(i, 1);
        continue;
      }
      context.strokeStyle = `rgba(197, 209, 180, ${r.alpha})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      context.stroke();
    }

    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      const ratio = (i + 1) / trail.length;
      context.fillStyle = ball.smashing
        ? `rgba(229, 133, 123, ${ratio * 0.45})`
        : `rgba(210, 198, 168, ${ratio * 0.32})`;
      context.beginPath();
      context.arc(t.x, t.y, 7.5 * ratio, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = player.smashArmed ? "#e5857b" : (player.smashEnergy >= 100 ? "#f2cc76" : "#b8cfa2");
    context.beginPath();
    context.roundRect(24, player.y, 12, paddleHeight, 6);
    context.fill();

    context.fillStyle = "#9da9b8";
    context.beginPath();
    context.roundRect(canvas.width - 36, opponent.y, 12, paddleHeight, 6);
    context.fill();

    context.fillStyle = ball.smashing ? "#ff9d8f" : "#ece2c6";
    context.beginPath();
    context.arc(ball.x, ball.y, 8.5, 0, Math.PI * 2);
    context.fill();
  }

  function point(scoredByPlayer) {
    if (scoredByPlayer) player.score += 1;
    else opponent.score += 1;
    document.getElementById("player-score").textContent = player.score;
    document.getElementById("opponent-score").textContent = opponent.score;
    if (player.score >= 7 || opponent.score >= 7) {
      stopped = true;
      const won = player.score >= 7;
      endMessage.textContent = translatedValue(won ? "You win! Press ↻ for a rematch." : "Good game! Press ↻ for another round.");
      rememberScore("pocket-pong", player.score);
      draw();
      drawCanvasMessage(context, canvas, won ? "You win! 🏆" : "Good game!", `${translatedValue("Final score ")}${player.score}–${opponent.score}${translatedValue(" · Press ↻ to play again")}`);
      return;
    }
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.vx = scoredByPlayer ? 4.5 : -4.5;
    ball.vy = (Math.random() * 4 - 2);
    ball.spin = 0;
    ball.smashing = false;
    trail.length = 0;
  }

  function loop(timestamp) {
    if (stopped) return;
    const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
    lastTime = timestamp;

    player.vy = player.y - player.prevY;
    player.prevY = player.y;

    trail.push({ x: ball.x, y: ball.y });
    if (trail.length > 12) trail.shift();

    ball.vy += ball.spin * 0.04 * delta;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

    if (ball.y < 9 || ball.y > canvas.height - 9) {
      ball.vy *= -1;
      ball.y = Math.max(9, Math.min(canvas.height - 9, ball.y));
      ripples.push({ x: ball.x, y: ball.y, radius: 4, alpha: 0.65 });
    }

    const opponentCenter = opponent.y + paddleHeight / 2;
    opponent.y += Math.max(-aiSpeed * delta, Math.min(aiSpeed * delta, ball.y - opponentCenter)) * 0.9;
    opponent.y = Math.max(0, Math.min(canvas.height - paddleHeight, opponent.y));

    if (ball.vx < 0 && ball.x - 8.5 < 36 && ball.x > 18 && ball.y > player.y - 4 && ball.y < player.y + paddleHeight + 4) {
      ball.x = 44;
      const isSmash = player.smashArmed;
      if (isSmash) {
        player.smashArmed = false;
        player.smashEnergy = 0;
        ball.vx = 10.5;
        ball.smashing = true;
      } else {
        player.smashEnergy = Math.min(100, player.smashEnergy + 34);
        ball.vx = Math.min(Math.abs(ball.vx) * 1.05, 8.8);
        ball.smashing = false;
      }
      ball.vy += (ball.y - (player.y + paddleHeight / 2)) * 0.065;
      ball.spin = Math.max(-2.5, Math.min(2.5, player.vy * 0.18));
      ripples.push({ x: ball.x, y: ball.y, radius: 6, alpha: 0.85 });
      updateSmashUI();
    }

    if (ball.vx > 0 && ball.x + 8.5 > canvas.width - 36 && ball.x < canvas.width - 18 && ball.y > opponent.y - 4 && ball.y < opponent.y + paddleHeight + 4) {
      ball.x = canvas.width - 44;
      ball.smashing = false;
      ball.vx = -Math.min(Math.abs(ball.vx) * 1.04, 8.6);
      ball.vy += (ball.y - (opponent.y + paddleHeight / 2)) * 0.05;
      ball.spin *= -0.5;
      ripples.push({ x: ball.x, y: ball.y, radius: 6, alpha: 0.7 });
    }

    if (ball.x < 0) point(false);
    if (ball.x > canvas.width) point(true);
    if (!stopped) {
      draw();
      frameId = requestAnimationFrame(loop);
    }
  }

  function movePlayer(y) {
    player.y = Math.max(0, Math.min(canvas.height - paddleHeight, y));
  }
  function onKeyDown(event) {
    if (event.code === "Space") {
      event.preventDefault();
      armSmash();
    }
    if (["ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(event.key)) event.preventDefault();
    if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") movePlayer(player.y - 28);
    if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") movePlayer(player.y + 28);
  }
  function onPointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    movePlayer((event.clientY - bounds.top) * canvas.height / bounds.height - paddleHeight / 2);
  }
  function onPointerDown() {
    armSmash();
  }

  gameStage.querySelectorAll("[data-ai]").forEach(btn => {
    btn.addEventListener("click", () => {
      aiSpeed = Number(btn.dataset.ai);
      gameStage.querySelectorAll("[data-ai]").forEach(b => b.classList.toggle("active", b === btn));
    });
  });

  document.addEventListener("keydown", onKeyDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  draw();
  frameId = requestAnimationFrame(loop);
  return () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    document.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
  };
}

/* ============================================================================
 * SOLO GAME 4: MEMORY GARDEN ZEN & BLITZ (4x4 / 4x5, Streak, Peek Hint)
 * ============================================================================ */
function startMemoryGarden(game) {
  let pairCount = 8;
  let selected = [];
  let moves = 0;
  let matched = 0;
  let streak = 0;
  let points = 0;
  let hintsLeft = 1;
  let locked = false;
  let mismatchTimer = 0;
  let previewTimer = 0;

  gameStage.innerHTML = `
    <div class="game-toolbar">
      <div class="game-toolbar-group">
        <span class="toolbar-label">Board:</span>
        <button type="button" class="mode-pill-btn active" data-pairs="8">4×4 (16 cards)</button>
        <button type="button" class="mode-pill-btn" data-pairs="10">4×5 (20 cards)</button>
      </div>
      <div class="game-toolbar-group">
        <button type="button" class="mode-pill-btn" id="memory-hint-btn">🔍 Hint (1)</button>
      </div>
    </div>
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score">
        <span><span>Streak:</span> <strong id="memory-streak">0🔥</strong></span>
        <span><span>Moves:</span> <strong id="memory-moves">0</strong></span>
      </span>
    </div>
    <div class="memory-grid" id="memory-grid"></div>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  localizeTree(gameStage, true);

  const allSymbols = ["🍐", "🍄", "🌿", "🌻", "🍋", "🐞", "🪻", "🌙", "🦋", "🍒"];
  const grid = document.getElementById("memory-grid");
  const endMessage = document.getElementById("game-end-message");
  const hintBtn = document.getElementById("memory-hint-btn");
  let cards = [];

  function setupBoard() {
    window.clearTimeout(mismatchTimer);
    window.clearTimeout(previewTimer);
    selected = [];
    moves = 0;
    matched = 0;
    streak = 0;
    points = 0;
    hintsLeft = 1;
    locked = true;
    document.getElementById("memory-moves").textContent = "0";
    document.getElementById("memory-streak").textContent = "0🔥";
    hintBtn.textContent = translatedValue("🔍 Hint (1)");
    hintBtn.disabled = false;
    endMessage.textContent = translatedValue("Memorize the cards...");

    const activeSymbols = allSymbols.slice(0, pairCount);
    cards = [...activeSymbols, ...activeSymbols];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    grid.classList.toggle("cols-5", pairCount === 10);
    grid.innerHTML = cards.map((sym, index) =>
      `<button class="memory-card revealed" type="button" data-index="${index}" aria-label="Garden card">${sym}</button>`
    ).join("");

    previewTimer = window.setTimeout(() => {
      grid.querySelectorAll(".memory-card").forEach(btn => {
        btn.classList.remove("revealed");
        btn.textContent = "✿";
      });
      locked = false;
      endMessage.textContent = "";
    }, 1100);
  }

  hintBtn.addEventListener("click", () => {
    if (hintsLeft <= 0 || locked) return;
    const unmatchedBtns = [...grid.querySelectorAll(".memory-card:not(.matched):not(.revealed)")];
    if (unmatchedBtns.length < 2) return;
    hintsLeft -= 1;
    hintBtn.textContent = translatedValue("🔍 Hint (0)");
    hintBtn.disabled = true;
    const targetSymbol = cards[Number(unmatchedBtns[0].dataset.index)];
    const pairBtns = unmatchedBtns.filter(b => cards[Number(b.dataset.index)] === targetSymbol);
    pairBtns.forEach(b => b.classList.add("hint-glow"));
    window.setTimeout(() => pairBtns.forEach(b => b.classList.remove("hint-glow")), 1000);
  });

  grid.addEventListener("click", event => {
    const card = event.target.closest(".memory-card");
    if (!card || locked || card.classList.contains("revealed") || card.classList.contains("matched")) return;
    const index = Number(card.dataset.index);
    card.textContent = cards[index];
    card.classList.add("revealed");
    selected.push(card);
    if (selected.length !== 2) return;

    moves += 1;
    document.getElementById("memory-moves").textContent = moves;
    const [first, second] = selected;
    if (cards[Number(first.dataset.index)] === cards[Number(second.dataset.index)]) {
      selected.forEach(item => item.classList.replace("revealed", "matched"));
      selected = [];
      matched += 1;
      streak += 1;
      points += 10 * streak;
      document.getElementById("memory-streak").textContent = `${streak}🔥`;
      if (matched === pairCount) {
        const stars = moves <= pairCount + 4 ? "⭐⭐⭐" : (moves <= pairCount + 9 ? "⭐⭐" : "⭐");
        endMessage.textContent = `${stars} ${translatedValue("A lovely match · All pairs found in ")}${moves}${translatedValue(" moves!")} (${points})`;
        const key = "playroom-score-memory-garden";
        const best = Number(localStorage.getItem(key)) || 0;
        if (!best || moves < best) localStorage.setItem(key, String(moves));
        renderGames();
      }
      return;
    }

    streak = 0;
    document.getElementById("memory-streak").textContent = "0🔥";
    locked = true;
    mismatchTimer = window.setTimeout(() => {
      selected.forEach(item => {
        item.classList.remove("revealed");
        item.textContent = "✿";
      });
      selected = [];
      locked = false;
    }, 680);
  });

  gameStage.querySelectorAll("[data-pairs]").forEach(btn => {
    btn.addEventListener("click", () => {
      pairCount = Number(btn.dataset.pairs);
      gameStage.querySelectorAll("[data-pairs]").forEach(b => b.classList.toggle("active", b === btn));
      setupBoard();
    });
  });

  setupBoard();
  return () => {
    window.clearTimeout(mismatchTimer);
    window.clearTimeout(previewTimer);
  };
}

/* ============================================================================
 * MULTIPLAYER GAME 1: TIC-TAC-TOE ARENA (Infinite 3x3, Classic 3x3, Gomoku 6x6)
 * ============================================================================ */
function startTicTacToe(game) {
  gameStage.innerHTML = `
    <div class="game-instructions">
      <span id="ttt-turn-info"></span>
      <span class="game-score" id="ttt-rule-desc">⚡ Infinite 3×3: 4th mark removes the oldest one (no draws!)</span>
    </div>
    <div class="ttt-board-wrap">
      <div class="ttt-grid size-3" id="ttt-grid"></div>
    </div>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;

  const gridEl = document.getElementById("ttt-grid");
  const turnInfoEl = document.getElementById("ttt-turn-info");
  const ruleDescEl = document.getElementById("ttt-rule-desc");
  const endMessage = document.getElementById("game-end-message");

  let subMode = "infinite";
  let boardSize = 3;
  let winLen = 3;
  let board = Array(9).fill(null);
  let moveHistory = { X: [], O: [] };
  let turn = "X";
  let gameOver = false;
  let winLine = [];
  let scores = { X: 0, O: 0 };
  let botTimer = 0;

  const extraHtml = `
    <span class="toolbar-label">Rules:</span>
    <button type="button" class="mode-pill-btn active" data-ttt-rule="infinite">⚡ Infinite 3×3</button>
    <button type="button" class="mode-pill-btn" data-ttt-rule="classic">🎲 Classic 3×3</button>
    <button type="button" class="mode-pill-btn" data-ttt-rule="gomoku6">💠 Gomoku 6×6 (4 in a row)</button>
  `;

  const mp = createMultiplayerController({
    game,
    container: gameStage,
    extraToolbarHtml: extraHtml,
    onModeChange: () => {
      scores = { X: 0, O: 0 };
      mp.setScore(0, 0);
      resetRound(false);
    },
    onPeerReady: ({ role }) => {
      if (role === "host") {
        resetRound(true);
      }
    },
    onRematch: () => {
      resetRound(false);
    },
    onMessage: (type, data) => {
      if (type === "ttt-move") {
        applyMove(data.index, data.symbol, false);
      } else if (type === "ttt-sync") {
        subMode = data.subMode;
        scores = data.scores || scores;
        mp.setScore(scores.X, scores.O);
        syncRuleButtons();
        resetRound(false);
      }
    }
  });

  function syncRuleButtons() {
    mp.extraOptionsEl.querySelectorAll("[data-ttt-rule]").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tttRule === subMode);
    });
    if (subMode === "infinite") {
      boardSize = 3;
      winLen = 3;
      ruleDescEl.textContent = translatedValue("⚡ Infinite 3×3: 4th mark removes the oldest one (no draws!)");
    } else if (subMode === "classic") {
      boardSize = 3;
      winLen = 3;
      ruleDescEl.textContent = translatedValue("🎲 Classic 3×3: get 3 in a row");
    } else {
      boardSize = 6;
      winLen = 4;
      ruleDescEl.textContent = translatedValue("💠 Gomoku 6×6: get 4 in a row in any direction");
    }
  }

  mp.extraOptionsEl.querySelectorAll("[data-ttt-rule]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (mp.getMode() === "online" && mp.getRole() !== "host" && mp.isPeerConnected()) {
        showToast("Only the room host can change the game rules.");
        return;
      }
      subMode = btn.dataset.tttRule;
      syncRuleButtons();
      resetRound(true);
    });
  });

  function checkWinner() {
    const N = boardSize;
    const K = winLen;
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const sym = board[r * N + c];
        if (!sym) continue;
        for (const [dr, dc] of dirs) {
          const cells = [r * N + c];
          for (let step = 1; step < K; step++) {
            const nr = r + dr * step;
            const nc = c + dc * step;
            if (nr < 0 || nr >= N || nc < 0 || nc >= N) break;
            if (board[nr * N + nc] === sym) cells.push(nr * N + nc);
            else break;
          }
          if (cells.length === K) return { winner: sym, line: cells };
        }
      }
    }
    if (subMode !== "infinite" && board.every(cell => cell !== null)) {
      return { winner: "draw", line: [] };
    }
    return null;
  }

  function renderBoard() {
    gridEl.className = `ttt-grid size-${boardSize}`;
    const fadingX = subMode === "infinite" && moveHistory.X.length === 3 && turn === "X" ? moveHistory.X[0] : -1;
    const fadingO = subMode === "infinite" && moveHistory.O.length === 3 && turn === "O" ? moveHistory.O[0] : -1;

    gridEl.innerHTML = board.map((cell, idx) => {
      const classes = ["ttt-cell"];
      if (cell === "X") classes.push("mark-x");
      if (cell === "O") classes.push("mark-o");
      if (idx === fadingX || idx === fadingO) classes.push("fading-soon");
      if (winLine.includes(idx)) classes.push("win-cell");
      const label = cell === "X" ? "✕" : (cell === "O" ? "◯" : "");
      return `<button type="button" class="${classes.join(" ")}" data-cell="${idx}" ${cell || gameOver ? "disabled" : ""}>${label}</button>`;
    }).join("");

    mp.setActiveTurn(turn === "X" ? 1 : 2);
    if (!gameOver) {
      const mode = mp.getMode();
      if (mode === "online") {
        const mySym = mp.getRole() === "host" ? "X" : "O";
        if (!mp.isPeerConnected()) {
          turnInfoEl.textContent = translatedValue("⏳ Waiting for opponent to join (or switch to Vs AI / 2 Players)...");
        } else {
          turnInfoEl.textContent = turn === mySym
            ? (currentLanguage === "ru" ? `🟢 Ваш ход (${mySym === "X" ? "✕" : "◯"})` : currentLanguage === "de" ? `🟢 Dein Zug (${mySym === "X" ? "✕" : "◯"})` : `🟢 Your turn (${mySym === "X" ? "✕" : "◯"})`)
            : (currentLanguage === "ru" ? `⏳ Ход соперника (${turn === "X" ? "✕" : "◯"})...` : currentLanguage === "de" ? `⏳ Zug des Gegners (${turn === "X" ? "✕" : "◯"})...` : `⏳ Opponent's turn (${turn === "X" ? "✕" : "◯"})...`);
        }
      } else if (mode === "bot") {
        turnInfoEl.textContent = turn === "X"
          ? (currentLanguage === "ru" ? "🟢 Ваш ход (✕)" : currentLanguage === "de" ? "🟢 Dein Zug (✕)" : "🟢 Your turn (✕)")
          : translatedValue("🤖 AI Bot is thinking...");
      } else {
        turnInfoEl.textContent = `${translatedValue(turn === "X" ? "Player 1" : "Player 2")} (${turn === "X" ? "✕" : "◯"})`;
      }
    }
  }

  function applyMove(index, sym, broadcastMove = true) {
    if (gameOver || board[index] !== null || sym !== turn) return;

    if (subMode === "infinite") {
      const hist = moveHistory[sym];
      if (hist.length >= 3) {
        const removedIdx = hist.shift();
        board[removedIdx] = null;
      }
      hist.push(index);
    }
    board[index] = sym;

    if (broadcastMove && mp.getMode() === "online") {
      mp.send("ttt-move", { index, symbol: sym });
    }

    const res = checkWinner();
    if (res) {
      gameOver = true;
      winLine = res.line;
      if (res.winner === "draw") {
        turnInfoEl.textContent = translatedValue("Draw!");
        endMessage.textContent = translatedValue("It's a draw! Click '↻ Rematch' for another round.");
      } else {
        scores[res.winner] += 1;
        mp.setScore(scores.X, scores.O);
        const isMyWin = mp.getMode() !== "online" ? res.winner === "X" : ((mp.getRole() === "host" && res.winner === "X") || (mp.getRole() === "guest" && res.winner === "O"));
        if (isMyWin) recordMultiplayerWin(game.id);
        const winLabel = res.winner === "X" ? `${translatedValue("Player 1")} (✕)` : `${translatedValue(mp.getMode() === "bot" ? "AI Bot 🤖" : "Player 2")} (◯)`;
        turnInfoEl.textContent = `🏆 ${winLabel}`;
        endMessage.textContent = `🏆 ${winLabel} — ${translatedValue("↻ Rematch")}`;
      }
      renderBoard();
      return;
    }

    turn = turn === "X" ? "O" : "X";
    renderBoard();

    if (!gameOver && mp.getMode() === "bot" && turn === "O") {
      window.clearTimeout(botTimer);
      botTimer = window.setTimeout(makeBotMove, 380);
    }
  }

  function findWinningCell(testSym) {
    for (let i = 0; i < board.length; i++) {
      if (board[i] !== null) continue;
      const saved = [...board];
      if (subMode === "infinite" && moveHistory[testSym].length >= 3) {
        board[moveHistory[testSym][0]] = null;
      }
      board[i] = testSym;
      const win = checkWinner();
      board = saved;
      if (win && win.winner === testSym) return i;
    }
    return -1;
  }

  function makeBotMove() {
    if (gameOver || turn !== "O") return;
    let move = findWinningCell("O");
    if (move === -1) move = findWinningCell("X");
    if (move === -1) {
      const center = boardSize === 3 ? [4] : [14, 15, 20, 21];
      const availCenter = center.filter(i => board[i] === null);
      if (availCenter.length) move = availCenter[Math.floor(Math.random() * availCenter.length)];
    }
    if (move === -1) {
      const empty = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
      if (empty.length) move = empty[Math.floor(Math.random() * empty.length)];
    }
    if (move !== -1) applyMove(move, "O", false);
  }

  function resetRound(syncToPeer = false) {
    window.clearTimeout(botTimer);
    syncRuleButtons();
    board = Array(boardSize * boardSize).fill(null);
    moveHistory = { X: [], O: [] };
    turn = "X";
    gameOver = false;
    winLine = [];
    endMessage.textContent = "";
    renderBoard();
    if (syncToPeer && mp.getMode() === "online") {
      mp.send("ttt-sync", { subMode, scores });
    }
  }

  gridEl.addEventListener("click", ev => {
    const btn = ev.target.closest("[data-cell]");
    if (!btn || gameOver) return;
    const idx = Number(btn.dataset.cell);
    const mode = mp.getMode();
    if (mode === "online") {
      if (!mp.isPeerConnected()) {
        showToast("Wait for your opponent to connect or switch to 'Vs AI'!");
        return;
      }
      const mySym = mp.getRole() === "host" ? "X" : "O";
      if (turn !== mySym) {
        showToast("It is your opponent's turn!");
        return;
      }
      applyMove(idx, mySym, true);
    } else if (mode === "bot") {
      if (turn !== "X") return;
      applyMove(idx, "X", false);
    } else {
      applyMove(idx, turn, false);
    }
  });

  resetRound(false);
  return () => {
    window.clearTimeout(botTimer);
    mp.destroy();
  };
}

/* ============================================================================
 * MULTIPLAYER GAME 2: NEON AIR HOCKEY 1v1 (Realtime Physics, Dash, Bumpers)
 * ============================================================================ */
function startNeonDuel(game) {
  gameStage.innerHTML = `
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score">First to 7 goals · Space / Click — Power Dash 🔥</span>
    </div>
    <canvas class="arcade-canvas" width="720" height="400" aria-label="Neon Air Hockey"></canvas>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  const canvas = gameStage.querySelector("canvas");
  const context = canvas.getContext("2d");
  const endMessage = document.getElementById("game-end-message");

  let useBumpers = true;
  let stopped = false;
  let matchOver = false;
  let frameId = 0;
  let lastTime = 0;
  let lastNetSend = 0;

  const goalTop = 125;
  const goalBottom = 275;
  const p1 = { x: 95, y: 200, vx: 0, vy: 0, r: 22, score: 0, dashUntil: 0, cooldownUntil: 0 };
  const p2 = { x: 625, y: 200, vx: 0, vy: 0, r: 22, score: 0, dashUntil: 0, cooldownUntil: 0 };
  const puck = { x: 360, y: 200, vx: 0, vy: 0, r: 13, fire: false, trail: [] };
  const bumpers = [
    { x: 360, y: 92, r: 16, pulse: 0 },
    { x: 360, y: 308, r: 16, pulse: 0 }
  ];
  const sparks = [];
  const keysPressed = new Set();

  const extraHtml = `
    <button type="button" class="mode-pill-btn active" id="hockey-bumper-toggle">🔮 Bumpers: ON</button>
  `;

  const mp = createMultiplayerController({
    game,
    container: gameStage,
    extraToolbarHtml: extraHtml,
    onModeChange: () => resetMatch(),
    onPeerReady: () => resetMatch(),
    onRematch: () => resetMatch(),
    onMessage: (type, data) => {
      if (type === "hockey-guest-input" && mp.getRole() === "host") {
        p2.x = Math.max(canvas.width / 2 + p2.r, Math.min(canvas.width - p2.r, data.x));
        p2.y = Math.max(p2.r, Math.min(canvas.height - p2.r, data.y));
        p2.vx = data.vx || 0;
        p2.vy = data.vy || 0;
        if (data.dash) triggerDash(p2);
      } else if (type === "hockey-state" && mp.getRole() === "guest") {
        p1.x = data.p1x;
        p1.y = data.p1y;
        puck.x = data.px;
        puck.y = data.py;
        puck.vx = data.pvx;
        puck.vy = data.pvy;
        puck.fire = data.fire;
        useBumpers = data.useBumpers;
        if (data.s1 !== p1.score || data.s2 !== p2.score) {
          p1.score = data.s1;
          p2.score = data.s2;
          mp.setScore(p1.score, p2.score);
          checkMatchEnd();
        }
      }
    }
  });

  const bumperBtn = mp.extraOptionsEl.querySelector("#hockey-bumper-toggle");
  bumperBtn.addEventListener("click", () => {
    useBumpers = !useBumpers;
    bumperBtn.textContent = translatedValue(useBumpers ? "🔮 Bumpers: ON" : "🔮 Bumpers: OFF");
    bumperBtn.classList.toggle("active", useBumpers);
  });

  function triggerDash(paddle) {
    const now = performance.now();
    if (now < paddle.cooldownUntil) return;
    paddle.dashUntil = now + 320;
    paddle.cooldownUntil = now + 1400;
  }

  function addSparks(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 4;
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  function resetPuck(dir = 0) {
    puck.x = canvas.width / 2 + dir * 40;
    puck.y = canvas.height / 2;
    puck.vx = dir === 0 ? (Math.random() < 0.5 ? 3.5 : -3.5) : dir * 3.2;
    puck.vy = (Math.random() - 0.5) * 3;
    puck.fire = false;
    puck.trail.length = 0;
  }

  function checkMatchEnd() {
    if (p1.score >= 7 || p2.score >= 7) {
      matchOver = true;
      const p1Won = p1.score >= 7;
      const isMyWin = mp.getMode() !== "online" ? p1Won : ((mp.getRole() === "host" && p1Won) || (mp.getRole() === "guest" && !p1Won));
      if (isMyWin) recordMultiplayerWin(game.id);
      endMessage.textContent = `${translatedValue(p1Won ? "Player 1 Wins! 🏆" : "Player 2 Wins! 🏆")} (${p1.score}:${p2.score})`;
    }
  }

  function resetMatch() {
    p1.score = 0;
    p2.score = 0;
    p1.x = 95; p1.y = 200;
    p2.x = 625; p2.y = 200;
    matchOver = false;
    endMessage.textContent = "";
    mp.setScore(0, 0);
    resetPuck(0);
  }

  function resolvePaddleCollision(paddle) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const minDist = puck.r + paddle.r;
    if (dist < minDist && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      puck.x = paddle.x + nx * (minDist + 1);
      puck.y = paddle.y + ny * (minDist + 1);
      const isDashing = performance.now() < paddle.dashUntil;
      const basePower = isDashing ? 11.2 : 7.4;
      puck.vx = nx * basePower + paddle.vx * 0.35;
      puck.vy = ny * basePower + paddle.vy * 0.35;
      puck.fire = isDashing;
      addSparks(puck.x, puck.y, isDashing ? "#e5857b" : "#84c5cb", isDashing ? 18 : 9);
    }
  }

  function updatePhysics(delta, now) {
    const mode = mp.getMode();
    const role = mp.getRole();

    const moveStep = (now < p1.dashUntil ? 7.8 : 5.2) * delta;
    const prev1X = p1.x, prev1Y = p1.y;
    const prev2X = p2.x, prev2Y = p2.y;

    if (mode !== "online" || role === "host") {
      if (keysPressed.has("w")) p1.y -= moveStep;
      if (keysPressed.has("s")) p1.y += moveStep;
      if (keysPressed.has("a")) p1.x -= moveStep;
      if (keysPressed.has("d")) p1.x += moveStep;
      p1.x = Math.max(p1.r, Math.min(canvas.width / 2 - p1.r, p1.x));
      p1.y = Math.max(p1.r, Math.min(canvas.height - p1.r, p1.y));
    }

    if (mode === "local") {
      const moveStep2 = (now < p2.dashUntil ? 7.8 : 5.2) * delta;
      if (keysPressed.has("arrowup")) p2.y -= moveStep2;
      if (keysPressed.has("arrowdown")) p2.y += moveStep2;
      if (keysPressed.has("arrowleft")) p2.x -= moveStep2;
      if (keysPressed.has("arrowright")) p2.x += moveStep2;
      p2.x = Math.max(canvas.width / 2 + p2.r, Math.min(canvas.width - p2.r, p2.x));
      p2.y = Math.max(p2.r, Math.min(canvas.height - p2.r, p2.y));
    } else if (mode === "bot" || (mode === "online" && !mp.isPeerConnected())) {
      const targetX = puck.x > canvas.width / 2 ? Math.min(canvas.width - 45, puck.x + 18) : canvas.width - 95;
      const targetY = puck.x > canvas.width * 0.35 ? puck.y : canvas.height / 2;
      p2.x += Math.max(-4.3 * delta, Math.min(4.3 * delta, targetX - p2.x));
      p2.y += Math.max(-4.6 * delta, Math.min(4.6 * delta, targetY - p2.y));
      p2.x = Math.max(canvas.width / 2 + p2.r, Math.min(canvas.width - p2.r, p2.x));
      p2.y = Math.max(p2.r, Math.min(canvas.height - p2.r, p2.y));
    } else if (mode === "online" && role === "guest") {
      const moveStepG = (now < p2.dashUntil ? 7.8 : 5.2) * delta;
      if (keysPressed.has("w") || keysPressed.has("arrowup")) p2.y -= moveStepG;
      if (keysPressed.has("s") || keysPressed.has("arrowdown")) p2.y += moveStepG;
      if (keysPressed.has("a") || keysPressed.has("arrowleft")) p2.x -= moveStepG;
      if (keysPressed.has("d") || keysPressed.has("arrowright")) p2.x += moveStepG;
      p2.x = Math.max(canvas.width / 2 + p2.r, Math.min(canvas.width - p2.r, p2.x));
      p2.y = Math.max(p2.r, Math.min(canvas.height - p2.r, p2.y));
    }

    p1.vx = p1.x - prev1X;
    p1.vy = p1.y - prev1Y;
    p2.vx = p2.x - prev2X;
    p2.vy = p2.y - prev2Y;

    if (mode === "online" && role === "guest") {
      if (now - lastNetSend > 24) {
        lastNetSend = now;
        mp.send("hockey-guest-input", { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy });
      }
      puck.trail.push({ x: puck.x, y: puck.y });
      if (puck.trail.length > 12) puck.trail.shift();
      return;
    }

    puck.x += puck.vx * delta;
    puck.y += puck.vy * delta;
    puck.vx *= Math.pow(0.994, delta);
    puck.vy *= Math.pow(0.994, delta);

    puck.trail.push({ x: puck.x, y: puck.y });
    if (puck.trail.length > 12) puck.trail.shift();

    if (puck.y - puck.r < 0) { puck.y = puck.r; puck.vy *= -1; addSparks(puck.x, puck.y, "#c5d1b4", 5); }
    if (puck.y + puck.r > canvas.height) { puck.y = canvas.height - puck.r; puck.vy *= -1; addSparks(puck.x, puck.y, "#c5d1b4", 5); }

    if (puck.x - puck.r < 0) {
      if (puck.y > goalTop && puck.y < goalBottom) {
        p2.score += 1;
        mp.setScore(p1.score, p2.score);
        addSparks(20, puck.y, "#84c5cb", 24);
        checkMatchEnd();
        if (!matchOver) resetPuck(-1);
      } else {
        puck.x = puck.r;
        puck.vx *= -1;
      }
    }

    if (puck.x + puck.r > canvas.width) {
      if (puck.y > goalTop && puck.y < goalBottom) {
        p1.score += 1;
        mp.setScore(p1.score, p2.score);
        addSparks(canvas.width - 20, puck.y, "#c5d1b4", 24);
        checkMatchEnd();
        if (!matchOver) resetPuck(1);
      } else {
        puck.x = canvas.width - puck.r;
        puck.vx *= -1;
      }
    }

    if (useBumpers) {
      bumpers.forEach(b => {
        const dx = puck.x - b.x;
        const dy = puck.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < puck.r + b.r && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          puck.x = b.x + nx * (puck.r + b.r + 1);
          puck.y = b.y + ny * (puck.r + b.r + 1);
          const speed = Math.max(6.2, Math.hypot(puck.vx, puck.vy) * 1.15);
          puck.vx = nx * speed;
          puck.vy = ny * speed;
          b.pulse = 1;
          addSparks(b.x, b.y, "#f2cc76", 10);
        }
      });
    }

    resolvePaddleCollision(p1);
    resolvePaddleCollision(p2);

    if (mode === "online" && role === "host" && now - lastNetSend > 24) {
      lastNetSend = now;
      mp.send("hockey-state", {
        p1x: p1.x, p1y: p1.y,
        px: puck.x, py: puck.y,
        pvx: puck.vx, pvy: puck.vy,
        fire: puck.fire,
        s1: p1.score, s2: p2.score,
        useBumpers
      });
    }
  }

  function draw(now) {
    context.fillStyle = "#12161c";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(132, 197, 203, 0.16)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(canvas.width / 2, 0);
    context.lineTo(canvas.width / 2, canvas.height);
    context.stroke();

    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, 56, 0, Math.PI * 2);
    context.stroke();

    context.lineWidth = 6;
    context.strokeStyle = "#98ebc2";
    context.beginPath();
    context.moveTo(3, goalTop);
    context.lineTo(3, goalBottom);
    context.stroke();

    context.strokeStyle = "#84c5cb";
    context.beginPath();
    context.moveTo(canvas.width - 3, goalTop);
    context.lineTo(canvas.width - 3, goalBottom);
    context.stroke();

    if (useBumpers) {
      bumpers.forEach(b => {
        if (b.pulse > 0) b.pulse = Math.max(0, b.pulse - 0.06);
        context.fillStyle = "rgba(226, 190, 126, 0.2)";
        context.beginPath();
        context.arc(b.x, b.y, b.r + 5 + b.pulse * 6, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#e2be7e";
        context.beginPath();
        context.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        context.fill();
      });
    }

    for (let i = 0; i < puck.trail.length; i++) {
      const t = puck.trail[i];
      const r = (i + 1) / puck.trail.length;
      context.fillStyle = puck.fire
        ? `rgba(229, 133, 123, ${r * 0.48})`
        : `rgba(132, 197, 203, ${r * 0.32})`;
      context.beginPath();
      context.arc(t.x, t.y, puck.r * r, 0, Math.PI * 2);
      context.fill();
    }

    const drawStriker = (st, mainColor, ringColor) => {
      const dashing = now < st.dashUntil;
      context.fillStyle = dashing ? "rgba(229, 133, 123, 0.35)" : ringColor;
      context.beginPath();
      context.arc(st.x, st.y, st.r + (dashing ? 5 : 2), 0, Math.PI * 2);
      context.fill();
      context.fillStyle = dashing ? "#e5857b" : mainColor;
      context.beginPath();
      context.arc(st.x, st.y, st.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#15191f";
      context.beginPath();
      context.arc(st.x, st.y, st.r * 0.45, 0, Math.PI * 2);
      context.fill();
    };
    drawStriker(p1, "#98ebc2", "rgba(152, 235, 194, 0.25)");
    drawStriker(p2, "#84c5cb", "rgba(132, 197, 203, 0.25)");

    context.fillStyle = puck.fire ? "#ff8c7a" : "#f5efe0";
    context.beginPath();
    context.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2);
    context.fill();

    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= 0.05;
      if (sp.life <= 0) { sparks.splice(i, 1); continue; }
      context.globalAlpha = sp.life;
      context.fillStyle = sp.color;
      context.beginPath();
      context.arc(sp.x, sp.y, 2.6, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    if (matchOver) {
      drawCanvasMessage(
        context,
        canvas,
        p1.score >= 7 ? "Player 1 Wins! 🏆" : "Player 2 Wins! 🏆",
        `${translatedValue("Final score ")}${p1.score}:${p2.score} · ${translatedValue("↻ Rematch")}`
      );
    }
  }

  function onPointerMove(ev) {
    if (matchOver) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
    if (mp.getMode() === "online" && mp.getRole() === "guest") {
      p2.vx = mx - p2.x;
      p2.vy = my - p2.y;
      p2.x = Math.max(canvas.width / 2 + p2.r, Math.min(canvas.width - p2.r, mx));
      p2.y = Math.max(p2.r, Math.min(canvas.height - p2.r, my));
    } else {
      p1.vx = mx - p1.x;
      p1.vy = my - p1.y;
      p1.x = Math.max(p1.r, Math.min(canvas.width / 2 - p1.r, mx));
      p1.y = Math.max(p1.r, Math.min(canvas.height - p1.r, my));
    }
  }

  function onPointerDown() {
    if (mp.getMode() === "online" && mp.getRole() === "guest") {
      triggerDash(p2);
      mp.send("hockey-guest-input", { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, dash: true });
    } else {
      triggerDash(p1);
    }
  }

  function onKeyDown(ev) {
    const k = ev.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
      ev.preventDefault();
    }
    keysPressed.add(k);
    if (ev.code === "Space") {
      if (mp.getMode() === "online" && mp.getRole() === "guest") {
        triggerDash(p2);
        mp.send("hockey-guest-input", { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, dash: true });
      } else {
        triggerDash(p1);
      }
    }
  }

  function onKeyUp(ev) {
    keysPressed.delete(ev.key.toLowerCase());
  }

  function loop(timestamp) {
    if (stopped) return;
    const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
    lastTime = timestamp;
    if (!matchOver) updatePhysics(delta, timestamp);
    draw(timestamp);
    frameId = requestAnimationFrame(loop);
  }

  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  resetMatch();
  frameId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    mp.destroy();
  };
}

/* ============================================================================
 * MULTIPLAYER GAME 3: CONNECT FOUR GRAVITY DROP (7x6 + Bomb Power-Disc)
 * ============================================================================ */
function startConnectFour(game) {
  const COLS = 7;
  const ROWS = 6;
  gameStage.innerHTML = `
    <div class="game-instructions">
      <span id="c4-turn-text"></span>
      <span class="game-score">Connect 4 in a row · 💣 Bomb destroys the disc below!</span>
    </div>
    <div class="c4-wrap">
      <div class="c4-board" id="c4-board"></div>
    </div>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;

  const boardEl = document.getElementById("c4-board");
  const turnTextEl = document.getElementById("c4-turn-text");
  const endMessage = document.getElementById("game-end-message");

  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  let turn = 1;
  let gameOver = false;
  let winCells = [];
  let scores = { 1: 0, 2: 0 };
  let bombsLeft = { 1: 1, 2: 1 };
  let bombArmed = false;
  let hoverCol = -1;
  let botTimer = 0;

  const extraHtml = `
    <button type="button" class="mode-pill-btn" id="c4-bomb-btn">💣 Bomb disc (1)</button>
  `;

  const mp = createMultiplayerController({
    game,
    container: gameStage,
    extraToolbarHtml: extraHtml,
    onModeChange: () => {
      scores = { 1: 0, 2: 0 };
      mp.setScore(0, 0);
      resetRound();
    },
    onPeerReady: () => resetRound(),
    onRematch: () => resetRound(),
    onMessage: (type, data) => {
      if (type === "c4-drop") {
        dropDisc(data.col, data.player, data.isBomb, false);
      }
    }
  });

  const bombBtn = mp.extraOptionsEl.querySelector("#c4-bomb-btn");
  bombBtn.addEventListener("click", () => {
    if (gameOver) return;
    const myPlayer = (mp.getMode() === "online" && mp.getRole() === "guest") ? 2 : turn;
    if (bombsLeft[myPlayer] <= 0) {
      showToast("Bomb disc already used in this round!");
      return;
    }
    bombArmed = !bombArmed;
    bombBtn.classList.toggle("active", bombArmed);
    bombBtn.textContent = bombArmed
      ? translatedValue("💣 BOMB ARMED!")
      : translatedValue(bombsLeft[myPlayer] > 0 ? "💣 Bomb disc (1)" : "💣 Bomb disc (0)");
  });

  function checkWin() {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        for (const [dr, dc] of dirs) {
          const line = [[r, c]];
          for (let k = 1; k < 4; k++) {
            const nr = r + dr * k;
            const nc = c + dc * k;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
            if (grid[nr][nc] === p) line.push([nr, nc]);
            else break;
          }
          if (line.length === 4) return { winner: p, line };
        }
      }
    }
    if (grid[0].every(v => v !== 0)) return { winner: "draw", line: [] };
    return null;
  }

  function renderBoard() {
    const winSet = new Set(winCells.map(([r, c]) => `${r},${c}`));
    let html = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const val = grid[r][c];
        const cls = ["c4-cell"];
        if (val === 1) cls.push("p1");
        if (val === 2) cls.push("p2");
        if (c === hoverCol && !gameOver) cls.push("col-hover");
        if (winSet.has(`${r},${c}`)) cls.push("win-disc");
        html += `<button type="button" class="${cls.join(" ")}" data-col="${c}" data-row="${r}" aria-label="Column ${c + 1}"></button>`;
      }
    }
    boardEl.innerHTML = html;
    mp.setActiveTurn(turn);

    const myPlayer = (mp.getMode() === "online" && mp.getRole() === "guest") ? 2 : (mp.getMode() === "online" ? 1 : turn);
    bombBtn.disabled = bombsLeft[myPlayer] <= 0 || gameOver;
    if (!bombArmed) {
      bombBtn.textContent = translatedValue(bombsLeft[myPlayer] > 0 ? "💣 Bomb disc (1)" : "💣 Bomb disc (0)");
    }

    if (!gameOver) {
      if (mp.getMode() === "online") {
        const myTurn = (mp.getRole() === "host" && turn === 1) || (mp.getRole() === "guest" && turn === 2);
        turnTextEl.textContent = !mp.isPeerConnected()
          ? translatedValue("Waiting for opponent...")
          : (myTurn
            ? (currentLanguage === "ru" ? `🟢 Ваш ход (${turn === 1 ? "🟡" : "🔵"})` : currentLanguage === "de" ? `🟢 Dein Zug (${turn === 1 ? "🟡" : "🔵"})` : `🟢 Your turn (${turn === 1 ? "🟡" : "🔵"})`)
            : (currentLanguage === "ru" ? "⏳ Ход соперника..." : currentLanguage === "de" ? "⏳ Zug des Gegners..." : "⏳ Opponent's turn..."));
      } else if (mp.getMode() === "bot") {
        turnTextEl.textContent = turn === 1
          ? (currentLanguage === "ru" ? "🟢 Ваш ход (🟡)" : currentLanguage === "de" ? "🟢 Dein Zug (🟡)" : "🟢 Your turn (🟡)")
          : translatedValue("🤖 AI Bot is choosing a column...");
      } else {
        turnTextEl.textContent = `${translatedValue(turn === 1 ? "Player 1" : "Player 2")} (${turn === 1 ? "🟡" : "🔵"})`;
      }
    }
  }

  function dropDisc(col, player, isBomb = false, broadcastMove = true) {
    if (gameOver || player !== turn || col < 0 || col >= COLS) return false;
    let targetRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] === 0) {
        targetRow = r;
        break;
      }
    }
    if (targetRow === -1) return false;

    if (isBomb && bombsLeft[player] > 0) {
      bombsLeft[player] -= 1;
      bombArmed = false;
      bombBtn.classList.remove("active");
      if (targetRow < ROWS - 1) {
        grid[targetRow + 1][col] = player;
      } else {
        grid[targetRow][col] = player;
      }
      showToast("💥 Bomb disc destroyed the piece below!");
    } else {
      grid[targetRow][col] = player;
    }

    if (broadcastMove && mp.getMode() === "online") {
      mp.send("c4-drop", { col, player, isBomb });
    }

    const res = checkWin();
    if (res) {
      gameOver = true;
      winCells = res.line;
      if (res.winner === "draw") {
        turnTextEl.textContent = translatedValue("Draw!");
        endMessage.textContent = translatedValue("Board is full — it's a draw! Click '↻ Rematch'.");
      } else {
        scores[res.winner] += 1;
        mp.setScore(scores[1], scores[2]);
        const isMyWin = mp.getMode() !== "online" ? res.winner === 1 : ((mp.getRole() === "host" && res.winner === 1) || (mp.getRole() === "guest" && res.winner === 2));
        if (isMyWin) recordMultiplayerWin(game.id);
        const wName = res.winner === 1 ? `${translatedValue("Player 1")} (🟡)` : `${translatedValue(mp.getMode() === "bot" ? "AI Bot 🤖" : "Player 2")} (🔵)`;
        turnTextEl.textContent = `🏆 ${wName}`;
        endMessage.textContent = `🏆 ${wName} — ${translatedValue("↻ Rematch")}`;
      }
      renderBoard();
      return true;
    }

    turn = turn === 1 ? 2 : 1;
    renderBoard();

    if (!gameOver && mp.getMode() === "bot" && turn === 2) {
      window.clearTimeout(botTimer);
      botTimer = window.setTimeout(makeBotDrop, 420);
    }
    return true;
  }

  function simulateColForWin(col, testPlayer) {
    let rTarget = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] === 0) { rTarget = r; break; }
    }
    if (rTarget === -1) return false;
    grid[rTarget][col] = testPlayer;
    const w = checkWin();
    grid[rTarget][col] = 0;
    return w && w.winner === testPlayer;
  }

  function makeBotDrop() {
    if (gameOver || turn !== 2) return;
    const validCols = [];
    for (let c = 0; c < COLS; c++) {
      if (grid[0][c] === 0) validCols.push(c);
    }
    if (!validCols.length) return;
    for (const c of validCols) {
      if (simulateColForWin(c, 2)) { dropDisc(c, 2, false, false); return; }
    }
    for (const c of validCols) {
      if (simulateColForWin(c, 1)) { dropDisc(c, 2, false, false); return; }
    }
    const pref = [3, 2, 4, 1, 5, 0, 6].filter(c => validCols.includes(c));
    const pick = pref[Math.floor(Math.random() * Math.min(3, pref.length))];
    dropDisc(pick, 2, false, false);
  }

  function resetRound() {
    window.clearTimeout(botTimer);
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    turn = 1;
    gameOver = false;
    winCells = [];
    bombsLeft = { 1: 1, 2: 1 };
    bombArmed = false;
    bombBtn.classList.remove("active");
    endMessage.textContent = "";
    renderBoard();
  }

  boardEl.addEventListener("pointermove", ev => {
    const cell = ev.target.closest("[data-col]");
    const col = cell ? Number(cell.dataset.col) : -1;
    if (col !== hoverCol) {
      hoverCol = col;
      boardEl.querySelectorAll(".c4-cell").forEach(el => {
        el.classList.toggle("col-hover", Number(el.dataset.col) === hoverCol);
      });
    }
  });

  boardEl.addEventListener("click", ev => {
    const cell = ev.target.closest("[data-col]");
    if (!cell || gameOver) return;
    const col = Number(cell.dataset.col);
    const mode = mp.getMode();
    if (mode === "online") {
      if (!mp.isPeerConnected()) {
        showToast("Wait for your opponent to connect or switch to 'Vs AI'!");
        return;
      }
      const myPlayer = mp.getRole() === "host" ? 1 : 2;
      if (turn !== myPlayer) {
        showToast("It is your opponent's turn!");
        return;
      }
      dropDisc(col, myPlayer, bombArmed, true);
    } else if (mode === "bot") {
      if (turn !== 1) return;
      dropDisc(col, 1, bombArmed, false);
    } else {
      dropDisc(col, turn, bombArmed, false);
    }
  });

  resetRound();
  return () => {
    window.clearTimeout(botTimer);
    mp.destroy();
  };
}

/* ============================================================================
 * MULTIPLAYER GAME 4: TANK BRAWL 1v1 (Ricochet Shells, Crates, Power-ups)
 * ============================================================================ */
function startTankBrawl(game) {
  gameStage.innerHTML = `
    <div class="game-instructions">
      <span>${game.controls}</span>
      <span class="game-score">Shells ricochet once · Collect 🛡️ 🔱 ❤️ power-ups in the center!</span>
    </div>
    <canvas class="arcade-canvas" width="720" height="400" aria-label="Tank Arena"></canvas>
    <p class="game-end-message" id="game-end-message" aria-live="polite"></p>
  `;
  const canvas = gameStage.querySelector("canvas");
  const context = canvas.getContext("2d");
  const endMessage = document.getElementById("game-end-message");

  let stopped = false;
  let roundOver = false;
  let frameId = 0;
  let lastTime = 0;
  let lastNetSend = 0;
  let scores = { 1: 0, 2: 0 };

  const keys = new Set();
  let bullets = [];
  let crates = [];
  let powerup = null;
  const explosions = [];

  const walls = [
    { x: 185, y: 80, w: 26, h: 95 },
    { x: 185, y: 225, w: 26, h: 95 },
    { x: 509, y: 80, w: 26, h: 95 },
    { x: 509, y: 225, w: 26, h: 95 },
    { x: 332, y: 168, w: 56, h: 64 }
  ];

  const t1 = { x: 80, y: 200, angle: 0, hp: 3, ammo: 3, reloadTimer: 0, shield: false, triple: 0, fireCooldown: 0 };
  const t2 = { x: 640, y: 200, angle: Math.PI, hp: 3, ammo: 3, reloadTimer: 0, shield: false, triple: 0, fireCooldown: 0 };

  const mp = createMultiplayerController({
    game,
    container: gameStage,
    onModeChange: () => {
      scores = { 1: 0, 2: 0 };
      mp.setScore(0, 0);
      resetArena();
    },
    onPeerReady: () => resetArena(),
    onRematch: () => resetArena(),
    onMessage: (type, data) => {
      if (type === "tank-guest" && mp.getRole() === "host") {
        t2.x = data.x;
        t2.y = data.y;
        t2.angle = data.angle;
        if (data.shoot) fireTank(t2, 2);
      } else if (type === "tank-state" && mp.getRole() === "guest") {
        t1.x = data.t1.x; t1.y = data.t1.y; t1.angle = data.t1.angle; t1.hp = data.t1.hp; t1.shield = data.t1.shield;
        t2.hp = data.t2.hp; t2.shield = data.t2.shield;
        bullets = data.bullets || [];
        crates = data.crates || [];
        powerup = data.powerup || null;
        if (data.s1 !== scores[1] || data.s2 !== scores[2]) {
          scores[1] = data.s1;
          scores[2] = data.s2;
          mp.setScore(scores[1], scores[2]);
        }
      }
    }
  });

  function resetArena() {
    roundOver = false;
    endMessage.textContent = "";
    t1.x = 80; t1.y = 200; t1.angle = 0; t1.hp = 3; t1.ammo = 3; t1.shield = false; t1.triple = 0;
    t2.x = 640; t2.y = 200; t2.angle = Math.PI; t2.hp = 3; t2.ammo = 3; t2.shield = false; t2.triple = 0;
    bullets = [];
    crates = [
      { x: 344, y: 65, w: 32, h: 32, hp: 2 },
      { x: 344, y: 303, w: 32, h: 32, hp: 2 },
      { x: 255, y: 184, w: 32, h: 32, hp: 2 },
      { x: 433, y: 184, w: 32, h: 32, hp: 2 }
    ];
    powerup = { x: 360, y: 128, kind: "shield" };
  }

  function addBoom(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 3.8;
      explosions.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color });
    }
  }

  function circleRectCollide(cx, cy, cr, r) {
    const closestX = Math.max(r.x, Math.min(cx, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(cy, r.y + r.h));
    return Math.hypot(cx - closestX, cy - closestY) < cr;
  }

  function canMoveTank(nx, ny) {
    const r = 16;
    if (nx < r + 4 || nx > canvas.width - r - 4 || ny < r + 4 || ny > canvas.height - r - 4) return false;
    for (const w of walls) {
      if (circleRectCollide(nx, ny, r, w)) return false;
    }
    for (const c of crates) {
      if (circleRectCollide(nx, ny, r, c)) return false;
    }
    return true;
  }

  function fireTank(tank, owner) {
    const now = performance.now();
    if (roundOver || tank.ammo <= 0 || now < tank.fireCooldown) return;
    tank.ammo -= 1;
    tank.fireCooldown = now + 260;
    const angles = tank.triple > 0 ? [tank.angle - 0.2, tank.angle, tank.angle + 0.2] : [tank.angle];
    if (tank.triple > 0) tank.triple -= 1;
    angles.forEach(ang => {
      bullets.push({
        x: tank.x + Math.cos(ang) * 22,
        y: tank.y + Math.sin(ang) * 22,
        vx: Math.cos(ang) * 6.5,
        vy: Math.sin(ang) * 6.5,
        bounces: 1,
        owner
      });
    });
    addBoom(tank.x + Math.cos(tank.angle) * 22, tank.y + Math.sin(tank.angle) * 22, "#f2cc76", 6);
  }

  function updateTankControls(tank, upKey, downKey, leftKey, rightKey, delta) {
    const rotSpeed = 0.068 * delta;
    const moveSpeed = 2.85 * delta;
    if (keys.has(leftKey)) tank.angle -= rotSpeed;
    if (keys.has(rightKey)) tank.angle += rotSpeed;
    let dir = 0;
    if (keys.has(upKey)) dir = 1;
    if (keys.has(downKey)) dir = -0.75;
    if (dir !== 0) {
      const nx = tank.x + Math.cos(tank.angle) * moveSpeed * dir;
      const ny = tank.y + Math.sin(tank.angle) * moveSpeed * dir;
      if (canMoveTank(nx, tank.y)) tank.x = nx;
      if (canMoveTank(tank.x, ny)) tank.y = ny;
    }
  }

  function stepGame(delta, now) {
    const mode = mp.getMode();
    const role = mp.getRole();

    [t1, t2].forEach(t => {
      if (t.ammo < 3) {
        t.reloadTimer += delta;
        if (t.reloadTimer > 52) {
          t.ammo += 1;
          t.reloadTimer = 0;
        }
      }
    });

    if (mode !== "online" || role === "host") {
      updateTankControls(t1, "w", "s", "a", "d", delta);
    }

    if (mode === "local") {
      updateTankControls(t2, "arrowup", "arrowdown", "arrowleft", "arrowright", delta);
    } else if (mode === "bot" || (mode === "online" && !mp.isPeerConnected())) {
      const desiredAngle = Math.atan2(t1.y - t2.y, t1.x - t2.x);
      let diff = desiredAngle - t2.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      t2.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.048 * delta);
      const dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
      if (dist > 170) {
        const nx = t2.x + Math.cos(t2.angle) * 2.1 * delta;
        const ny = t2.y + Math.sin(t2.angle) * 2.1 * delta;
        if (canMoveTank(nx, t2.y)) t2.x = nx;
        if (canMoveTank(t2.x, ny)) t2.y = ny;
      }
      if (Math.abs(diff) < 0.24 && Math.random() < 0.045) {
        fireTank(t2, 2);
      }
    } else if (mode === "online" && role === "guest") {
      updateTankControls(t2, "w", "s", "a", "d", delta);
      if (now - lastNetSend > 28) {
        lastNetSend = now;
        mp.send("tank-guest", { x: t2.x, y: t2.y, angle: t2.angle });
      }
      return;
    }

    if (!powerup && Math.random() < 0.005) {
      const kinds = ["shield", "triple", "heal"];
      powerup = {
        x: 360,
        y: Math.random() < 0.5 ? 122 : 278,
        kind: kinds[Math.floor(Math.random() * kinds.length)]
      };
    }
    if (powerup) {
      [t1, t2].forEach(t => {
        if (powerup && Math.hypot(t.x - powerup.x, t.y - powerup.y) < 26) {
          if (powerup.kind === "shield") t.shield = true;
          if (powerup.kind === "triple") t.triple = 2;
          if (powerup.kind === "heal") t.hp = Math.min(3, t.hp + 1);
          addBoom(powerup.x, powerup.y, "#98ebc2", 14);
          powerup = null;
        }
      });
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const prevX = b.x;
      const prevY = b.y;
      b.x += b.vx * delta;
      b.y += b.vy * delta;

      let bounced = false;
      if (b.x < 6 || b.x > canvas.width - 6) {
        if (b.bounces > 0) { b.vx *= -1; b.bounces--; bounced = true; }
        else { bullets.splice(i, 1); continue; }
      }
      if (b.y < 6 || b.y > canvas.height - 6) {
        if (b.bounces > 0) { b.vy *= -1; b.bounces--; bounced = true; }
        else { bullets.splice(i, 1); continue; }
      }

      let removed = false;
      for (const w of walls) {
        if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) {
          if (b.bounces > 0) {
            if (prevX <= w.x || prevX >= w.x + w.w) b.vx *= -1;
            else b.vy *= -1;
            b.bounces--;
            bounced = true;
          } else {
            addBoom(b.x, b.y, "#c5d1b4", 6);
            bullets.splice(i, 1);
            removed = true;
          }
          break;
        }
      }
      if (removed) continue;
      if (bounced) addBoom(b.x, b.y, "#f2cc76", 5);

      for (let ci = crates.length - 1; ci >= 0; ci--) {
        const c = crates[ci];
        if (b.x > c.x && b.x < c.x + c.w && b.y > c.y && b.y < c.y + c.h) {
          c.hp -= 1;
          addBoom(b.x, b.y, "#d9a773", 10);
          if (c.hp <= 0) crates.splice(ci, 1);
          bullets.splice(i, 1);
          removed = true;
          break;
        }
      }
      if (removed) continue;

      const checkTankHit = (tank, tankNum) => {
        if (Math.hypot(b.x - tank.x, b.y - tank.y) < 17) {
          if (tank.shield) {
            tank.shield = false;
            addBoom(tank.x, tank.y, "#84c5cb", 16);
          } else {
            tank.hp -= 1;
            addBoom(tank.x, tank.y, "#e5857b", 22);
            if (tank.hp <= 0) {
              roundOver = true;
              const winner = tankNum === 1 ? 2 : 1;
              scores[winner] += 1;
              mp.setScore(scores[1], scores[2]);
              const isMyWin = mp.getMode() !== "online" ? winner === 1 : ((mp.getRole() === "host" && winner === 1) || (mp.getRole() === "guest" && winner === 2));
              if (isMyWin) recordMultiplayerWin(game.id);
              endMessage.textContent = `${translatedValue(winner === 1 ? "Tank 1 Wins! 🏆" : "Tank 2 Wins! 🏆")} — ${translatedValue("Click '↻ Rematch' above for a new battle")}`;
            }
          }
          return true;
        }
        return false;
      };

      if (checkTankHit(t1, 1) || checkTankHit(t2, 2)) {
        bullets.splice(i, 1);
      }
    }

    if (mode === "online" && role === "host" && now - lastNetSend > 28) {
      lastNetSend = now;
      mp.send("tank-state", {
        t1: { x: t1.x, y: t1.y, angle: t1.angle, hp: t1.hp, shield: t1.shield },
        t2: { hp: t2.hp, shield: t2.shield },
        bullets,
        crates,
        powerup,
        s1: scores[1],
        s2: scores[2]
      });
    }
  }

  function drawTank(t, bodyColor, turretColor) {
    context.save();
    context.translate(t.x, t.y);
    if (t.shield) {
      context.strokeStyle = "#84c5cb";
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, 23, 0, Math.PI * 2);
      context.stroke();
    }
    context.save();
    context.rotate(t.angle);
    context.fillStyle = "#25282c";
    context.fillRect(-16, -15, 32, 6);
    context.fillRect(-16, 9, 32, 6);
    context.fillStyle = bodyColor;
    context.beginPath();
    context.roundRect(-14, -11, 28, 22, 5);
    context.fill();
    context.fillStyle = turretColor;
    context.fillRect(0, -3, 21, 6);
    context.beginPath();
    context.arc(0, 0, 7.5, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.fillStyle = "#f0eee8";
    context.font = "700 10px Inter, sans-serif";
    context.textAlign = "center";
    context.fillText("❤️".repeat(Math.max(0, t.hp)), 0, -22);
    context.restore();
  }

  function draw() {
    context.fillStyle = "#171a17";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = "rgba(197, 209, 180, 0.04)";
    for (let x = 0; x < canvas.width; x += 36) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
    }
    for (let y = 0; y < canvas.height; y += 36) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
    }

    walls.forEach(w => {
      context.fillStyle = "#32383d";
      context.beginPath();
      context.roundRect(w.x, w.y, w.w, w.h, 5);
      context.fill();
      context.strokeStyle = "rgba(255,255,255,0.12)";
      context.stroke();
    });

    crates.forEach(c => {
      context.fillStyle = c.hp === 2 ? "#8c6d46" : "#6e5334";
      context.beginPath();
      context.roundRect(c.x, c.y, c.w, c.h, 4);
      context.fill();
      context.strokeStyle = "#b59164";
      context.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
    });

    if (powerup) {
      context.fillStyle = "rgba(226, 190, 126, 0.22)";
      context.beginPath();
      context.arc(powerup.x, powerup.y, 16, 0, Math.PI * 2);
      context.fill();
      context.font = "16px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      const icon = powerup.kind === "shield" ? "🛡️" : (powerup.kind === "triple" ? "🔱" : "❤️");
      context.fillText(icon, powerup.x, powerup.y);
      context.textBaseline = "alphabetic";
    }

    drawTank(t1, "#8ab87a", "#b8df9e");
    drawTank(t2, "#6faab5", "#9fe0eb");

    bullets.forEach(b => {
      context.fillStyle = b.bounces > 0 ? "#f2cc76" : "#e5857b";
      context.beginPath();
      context.arc(b.x, b.y, 4.2, 0, Math.PI * 2);
      context.fill();
    });

    for (let i = explosions.length - 1; i >= 0; i--) {
      const ex = explosions[i];
      ex.x += ex.vx;
      ex.y += ex.vy;
      ex.life -= 0.05;
      if (ex.life <= 0) { explosions.splice(i, 1); continue; }
      context.globalAlpha = ex.life;
      context.fillStyle = ex.color;
      context.beginPath();
      context.arc(ex.x, ex.y, 3.2, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    if (roundOver) {
      drawCanvasMessage(
        context,
        canvas,
        t1.hp > 0 ? "Tank 1 Wins! 🏆" : "Tank 2 Wins! 🏆",
        "Click '↻ Rematch' above for a new battle"
      );
    }
  }

  function onKeyDown(ev) {
    const k = ev.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter"].includes(k)) {
      ev.preventDefault();
    }
    keys.add(k);
    if (ev.code === "Space") {
      if (mp.getMode() === "online" && mp.getRole() === "guest") {
        mp.send("tank-guest", { x: t2.x, y: t2.y, angle: t2.angle, shoot: true });
      } else {
        fireTank(t1, 1);
      }
    }
    if (ev.key === "Enter" && mp.getMode() === "local") {
      fireTank(t2, 2);
    }
  }

  function onKeyUp(ev) {
    keys.delete(ev.key.toLowerCase());
  }

  function onPointerDown(ev) {
    const rect = canvas.getBoundingClientRect();
    const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
    if (mp.getMode() === "online" && mp.getRole() === "guest") {
      t2.angle = Math.atan2(my - t2.y, mx - t2.x);
      mp.send("tank-guest", { x: t2.x, y: t2.y, angle: t2.angle, shoot: true });
    } else {
      t1.angle = Math.atan2(my - t1.y, mx - t1.x);
      fireTank(t1, 1);
    }
  }

  function loop(timestamp) {
    if (stopped) return;
    const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
    lastTime = timestamp;
    if (!roundOver) stepGame(delta, timestamp);
    draw();
    frameId = requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", onPointerDown);
  resetArena();
  frameId = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(frameId);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    canvas.removeEventListener("pointerdown", onPointerDown);
    mp.destroy();
  };
}

let trackingAttempt = 0;

async function finishGameTracking(cancelPending = true) {
  if (cancelPending) trackingAttempt += 1;
  window.clearInterval(trackingHeartbeat);
  trackingHeartbeat = null;
  if (localPlayStartMs && activeGameId) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - localPlayStartMs) / 1000));
    localPlayStartMs = 0;
    if (elapsedSec > 0) {
      personalGameSeconds[activeGameId] = (personalGameSeconds[activeGameId] || 0) + elapsedSec;
      localStorage.setItem(`qorum-playtime-${activeGameId}`, String(personalGameSeconds[activeGameId]));
      renderGames();
    }
  }
  const sessionId = activeTrackingSessionId;
  activeTrackingSessionId = null;
  if (!sessionId || !backendClient || !currentUser) return;
  const { error } = await backendClient.rpc("finish_game_session", { p_session_id: sessionId });
  if (error) {
    console.error("Could not save the game session.", error);
    showToast("Could not save this play session. Please try again.");
  }
  await loadPersonalPlaytime();
}

async function startGameTracking(gameId) {
  const attempt = ++trackingAttempt;
  await finishGameTracking(false);
  localPlayStartMs = Date.now();
  if (backendClient && !currentUser) showToast("Sign in to record your play time.");
  if (!backendClient || !currentUser || activeGameId !== gameId || attempt !== trackingAttempt) return;
  const { data: sessionId, error } = await backendClient.rpc("start_game_session", { p_game_id: gameId });
  if (error) {
    if (!legacyDbGameIds.has(gameId)) return;
    console.error("Could not start the game timer.", error);
    showToast("Game time could not be recorded.");
    return;
  }
  if (activeGameId !== gameId || attempt !== trackingAttempt) {
    const { error: finishError } = await backendClient.rpc("finish_game_session", { p_session_id: sessionId });
    if (finishError) console.error("Could not close the interrupted game session.", finishError);
    return;
  }
  activeTrackingSessionId = sessionId;
  trackingHeartbeat = window.setInterval(async () => {
    if (!activeTrackingSessionId || !currentUser) return;
    const { error: heartbeatError } = await backendClient.rpc("heartbeat_game_session", {
      p_session_id: activeTrackingSessionId
    });
    if (heartbeatError) {
      console.error("Could not update the game timer.", heartbeatError);
      showToast("Play-time tracking was interrupted.");
      window.clearInterval(trackingHeartbeat);
      trackingHeartbeat = null;
    }
  }, 30_000);
}

function renderChatMessage(message) {
  const messages = document.getElementById("chat-messages");
  if (!messages || messages.querySelector(`[data-message-id="${message.id}"]`)) return;
  const emptyState = messages.querySelector(".empty-state");
  if (emptyState) emptyState.remove();
  const item = document.createElement("div");
  item.className = `message${currentUser && message.sender_id === currentUser.id ? " mine" : ""}`;
  item.dataset.messageId = message.id;

  const rawContent = String(message.content || "");
  const inviteMatch = /\[QORUM_INVITE:([a-z0-9-]+):([A-Z0-9]+)\]/i.exec(rawContent);
  const cleanText = rawContent.replace(/\[QORUM_INVITE:[^\]]+\]/gi, "").trim();
  const textSpan = document.createElement("div");
  textSpan.textContent = cleanText || rawContent;
  item.append(textSpan);

  if (inviteMatch) {
    const [, invGameId, invRoom] = inviteMatch;
    const joinBtn = document.createElement("button");
    joinBtn.type = "button";
    joinBtn.className = "message-invite-btn";
    joinBtn.dataset.joinGame = invGameId;
    joinBtn.dataset.joinRoom = invRoom.toUpperCase();
    joinBtn.textContent = `🎮 ${translatedValue("Join room")} ${invRoom.toUpperCase()}`;
    item.append(joinBtn);
  }

  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at));
  item.append(time);
  messages.append(item);
  messages.scrollTop = messages.scrollHeight;
}

async function loadConversation(userId, username, avatarPath = null) {
  if (!backendClient || !currentUser) {
    showToast("Sign in to message other QORUM players.");
    openAuth("signin");
    return;
  }
  const ownerId = currentUser.id;
  activeChatUserId = userId;
  const title = document.getElementById("chat-title");
  const status = document.getElementById("chat-status");
  const avatar = document.getElementById("chat-avatar");
  const messages = document.getElementById("chat-messages");
  const input = document.getElementById("chat-input");
  const submit = document.querySelector("#chat-form button[type='submit']");
  if (!title || !messages) return;
  title.textContent = username;
  if (status) status.textContent = translatedValue("Direct messages");
  setAvatar(avatar, username, avatarPath);
  if (input) input.disabled = false;
  if (submit) submit.disabled = false;
  document.querySelectorAll(".friend").forEach(friend => {
    friend.classList.toggle("selected", friend.dataset.userId === userId);
  });
  messages.replaceChildren();
  const { data, error } = await backendClient
    .from("direct_messages")
    .select("id,sender_id,recipient_id,content,created_at")
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${currentUser.id})`)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Could not load the conversation.", error);
    showToast("Messages could not be loaded.");
    return;
  }
  if (!currentUser || currentUser.id !== ownerId) return;
  if (activeChatUserId !== userId) return;
  data.reverse().forEach(renderChatMessage);
  if (!data.length) messages.innerHTML = `<div class="empty-state">${translatedValue("Start the conversation with a message.")}</div>`;
  messages.scrollTop = messages.scrollHeight;
  if (activeChatChannel) await backendClient.removeChannel(activeChatChannel);
  activeChatChannel = backendClient.channel(`messages:${currentUser.id}:${userId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "direct_messages",
      filter: `recipient_id=eq.${currentUser.id}`
    }, payload => {
      if (payload.new.sender_id === activeChatUserId) renderChatMessage(payload.new);
    })
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "direct_messages",
      filter: `sender_id=eq.${currentUser.id}`
    }, payload => {
      if (payload.new.recipient_id === activeChatUserId) renderChatMessage(payload.new);
    })
    .subscribe();
}

function renderPublicChatMessage(message) {
  const messages = document.getElementById("public-chat-messages");
  if (!messages || messages.querySelector(`[data-message-id="${message.id}"]`)) return;
  const emptyState = messages.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const profile = Array.isArray(message.profiles) ? message.profiles[0] : message.profiles;
  const item = document.createElement("article");
  item.className = "message public-message";
  item.dataset.messageId = message.id;
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  setAvatar(avatar, profile?.username || "QORUM player", profile?.avatar_path);
  const copy = document.createElement("div");
  copy.className = "public-message-copy";
  const name = document.createElement("strong");
  name.textContent = profile?.username || "QORUM player";
  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" })
    .format(new Date(message.created_at));
  const text = document.createElement("p");
  text.className = "public-message-text";
  text.textContent = message.content;
  copy.append(name, time, text);
  item.append(avatar, copy);
  messages.append(item);
  while (messages.children.length > 100) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}

async function loadPublicChatMessages() {
  const messages = document.getElementById("public-chat-messages");
  if (!messages || !backendClient) return;
  const { data, error } = await backendClient
    .from("public_chat_messages")
    .select("id,sender_id,content,created_at,profiles(username,avatar_path)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Could not load the public community chat.", error);
    messages.replaceChildren();
    const notice = document.createElement("div");
    notice.className = "empty-state";
    notice.textContent = translatedValue("Community chat is temporarily unavailable.");
    messages.append(notice);
    return;
  }
  messages.replaceChildren();
  if (!data.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = translatedValue("No messages yet. Start the conversation.");
    messages.append(emptyState);
  } else {
    data.reverse().forEach(renderPublicChatMessage);
  }
  messages.scrollTop = messages.scrollHeight;
}

function initializePublicChat() {
  const form = document.getElementById("public-chat-form");
  const messages = document.getElementById("public-chat-messages");
  if (!form || !messages || !backendClient) return;

  void loadPublicChatMessages();
  if (publicChatChannel) return;
  publicChatChannel = backendClient.channel("public-community-chat")
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "public_chat_messages",
    }, () => {
      void loadPublicChatMessages();
    })
    .subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("The public community chat realtime connection failed.", status);
        showToast("Live chat updates are temporarily unavailable.");
      }
    });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("public-chat-input");
    const submit = form.querySelector("button[type='submit']");
    const content = input.value.trim();
    if (!currentUser) {
      showToast("Sign in to send a message in community chat.");
      openAuth("signin");
      return;
    }
    if (!content || content.length > 500) return;

    submit.disabled = true;
    const { data, error } = await backendClient
      .from("public_chat_messages")
      .insert({ sender_id: currentUser.id, content })
      .select("id,sender_id,content,created_at,profiles(username,avatar_path)")
      .single();
    submit.disabled = !currentUser;
    if (error) {
      console.error("Could not send a public community chat message.", error);
      showToast(error.message.includes("Please wait")
        ? "Please wait a moment before sending another message."
        : "Your message could not be sent.");
      return;
    }
    renderPublicChatMessage(data);
    input.value = "";
  });
}

function createPlayerButton(player) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "friend";
  button.dataset.userId = player.id;
  button.dataset.username = player.username;
  button.dataset.avatarPath = player.avatar_path || "";
  const avatar = document.createElement("span");
  avatar.className = "avatar";
  setAvatar(avatar, player.username, player.avatar_path);
  const info = document.createElement("span");
  info.className = "friend-info";
  const name = document.createElement("span");
  name.className = "friend-name";
  name.textContent = player.username;
  const subtitle = document.createElement("span");
  subtitle.className = "friend-status";
  subtitle.textContent = translatedValue("QORUM player");
  info.append(name, subtitle);
  button.append(avatar, info);
  return button;
}

async function loadPlayers() {
  const list = document.getElementById("friend-list");
  const count = document.getElementById("online-count");
  if (!list || !backendClient || !currentUser) return;
  const ownerId = currentUser.id;
  const { data, error } = await backendClient
    .from("profiles")
    .select("id,username,avatar_path")
    .neq("id", currentUser.id)
    .order("username")
    .limit(50);
  if (error) {
    console.error("Could not load QORUM players.", error);
    showToast("Player list could not be loaded.");
    return;
  }
  if (currentUser?.id !== ownerId) return;
  list.replaceChildren(...data.map(createPlayerButton));
  if (!data.length) list.innerHTML = `<span class="friend-status">${translatedValue("No other players yet.")}</span>`;
  if (count) count.textContent = data.length;
}

async function searchPlayers(query) {
  const results = document.getElementById("player-results");
  if (!results || !backendClient || !currentUser) {
    showToast("Sign in to find and message players.");
    openAuth("signin");
    return;
  }
  if (query.length < 3) {
    results.textContent = translatedValue("Enter at least 3 characters to search.");
    return;
  }
  const { data, error } = await backendClient
    .from("profiles")
    .select("id,username,avatar_path")
    .ilike("username", `%${query}%`)
    .neq("id", currentUser.id)
    .order("username")
    .limit(20);
  if (error) {
    console.error("Could not search players.", error);
    showToast("Player search failed.");
    return;
  }
  results.replaceChildren();
  if (!data.length) {
    results.textContent = translatedValue("No players found. Check the username and try again.");
    return;
  }
  data.forEach(player => results.append(createPlayerButton(player)));
}

async function loadPersonalPlaytime() {
  if (!backendClient || !currentUser) return;
  const ownerId = currentUser.id;
  const { data, error } = await backendClient
    .from("game_sessions")
    .select("game_id,started_at,last_heartbeat_at,ended_at,duration_seconds")
    .eq("user_id", currentUser.id);
  if (error) {
    console.error("Could not load play-time totals.", error);
    showToast("Your play-time totals could not be loaded.");
    return;
  }
  if (currentUser?.id !== ownerId) return;
  for (const game of games) {
    personalGameSeconds[game.id] = Number(localStorage.getItem(`qorum-playtime-${game.id}`)) || 0;
  }
  const dbTotals = {};
  const now = Date.now();
  for (const session of data) {
    const seconds = session.ended_at
      ? session.duration_seconds
      : Math.max(0, Math.floor((Math.min(now, new Date(session.last_heartbeat_at).getTime() + 45_000) - new Date(session.started_at).getTime()) / 1000));
    dbTotals[session.game_id] = (dbTotals[session.game_id] || 0) + seconds;
  }
  for (const [gid, sec] of Object.entries(dbTotals)) {
    personalGameSeconds[gid] = Math.max(personalGameSeconds[gid] || 0, sec);
  }
  const totalSeconds = Object.values(personalGameSeconds).reduce((total, seconds) => total + seconds, 0);
  const totalTime = document.getElementById("profile-session-count");
  if (totalTime) totalTime.textContent = formatDuration(totalSeconds);
  const timeList = document.getElementById("profile-game-times");
  if (timeList) {
    timeList.replaceChildren(...games.map(game => {
      const row = document.createElement("div");
      row.className = "profile-game-time";
      const label = document.createElement("span");
      label.textContent = game.title;
      const duration = document.createElement("strong");
      duration.textContent = formatDuration(personalGameSeconds[game.id]);
      row.append(label, duration);
      return row;
    }));
    localizeTree(timeList, true);
  }
  renderGames();
}

async function loadPublicPlaytime() {
  const table = document.getElementById("public-stats");
  if (!table) return;
  if (!backendClient) {
    table.innerHTML = `<tr><td colspan="3">${translatedValue("Statistics are unavailable until the account service is configured.")}</td></tr>`;
    return;
  }
  const { data, error } = await backendClient.rpc("get_public_game_stats");
  if (error) {
    console.error("Could not load public game statistics.", error);
    table.innerHTML = `<tr><td colspan="3">${translatedValue("Statistics could not be loaded. Please try again later.")}</td></tr>`;
    return;
  }
  table.replaceChildren();
  const totals = new Map((data || []).map(row => [row.game_id, row]));
  for (const game of games) {
    const row = totals.get(game.id);
    const localSec = Number(localStorage.getItem(`qorum-playtime-${game.id}`)) || 0;
    const totalSec = Math.max(row ? Number(row.total_seconds) : 0, localSec);
    const tr = document.createElement("tr");
    const title = document.createElement("td");
    title.textContent = game.title;
    const time = document.createElement("td");
    time.textContent = formatDuration(totalSec);
    const players = document.createElement("td");
    players.textContent = row ? row.player_count : (localSec > 0 ? "1" : "0");
    tr.append(title, time, players);
    table.append(tr);
  }
  localizeTree(table, true);
}

function launchGame(gameId, joinRoomCode = null) {
  const game = games.find(item => item.id === gameId);
  if (!game) return;
  if (!gameModal || !gameStage) {
    const url = `index.html?game=${encodeURIComponent(gameId)}${joinRoomCode ? `&room=${encodeURIComponent(joinRoomCode)}` : ""}`;
    window.location.href = url;
    return;
  }
  if (activeGameCleanup) activeGameCleanup();
  activeGameId = gameId;
  if (joinRoomCode) pendingRoomJoinCode = joinRoomCode;
  startGameTracking(gameId);
  document.getElementById("game-title").textContent = game.title;
  document.getElementById("game-description").textContent = game.instructions;
  gameModal.classList.add("open");
  if (game.kind === "snake") activeGameCleanup = startSnake(game);
  if (game.kind === "sky") activeGameCleanup = startSkyHop(game);
  if (game.kind === "pong") activeGameCleanup = startPong(game);
  if (game.kind === "memory") activeGameCleanup = startMemoryGarden(game);
  if (game.kind === "ttt") activeGameCleanup = startTicTacToe(game);
  if (game.kind === "hockey") activeGameCleanup = startNeonDuel(game);
  if (game.kind === "c4") activeGameCleanup = startConnectFour(game);
  if (game.kind === "tanks") activeGameCleanup = startTankBrawl(game);
  localizeTree(gameModal, true);
}

function closeGame() {
  if (activeGameCleanup) activeGameCleanup();
  activeGameCleanup = null;
  finishGameTracking();
  activeGameId = null;
  if (gameModal) gameModal.classList.remove("open");
  if (gameStage) gameStage.replaceChildren();
}

document.addEventListener("click", event => {
  const playBtn = event.target.closest("[data-play]");
  if (playBtn) {
    launchGame(playBtn.dataset.play);
    return;
  }
  const joinBtn = event.target.closest("[data-join-room]");
  if (joinBtn) {
    const rCode = joinBtn.dataset.joinRoom;
    const gId = joinBtn.dataset.joinGame || PREFIX_GAME_MAP[rCode.charAt(0)] || "tic-tac-toe";
    launchGame(gId, rCode);
  }
});

const quickJoinForm = document.getElementById("quick-join-form");
if (quickJoinForm) {
  quickJoinForm.addEventListener("submit", ev => {
    ev.preventDefault();
    const input = document.getElementById("quick-room-code");
    const code = (input?.value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 3) {
      showToast("Enter a room code (for example, T8K2M)");
      return;
    }
    const openInfo = openLobbyRooms.get(code);
    const gId = (openInfo && openInfo.gameId) || PREFIX_GAME_MAP[code.charAt(0)] || "tic-tac-toe";
    launchGame(gId, code);
  });
}

const chatForm = document.getElementById("chat-form");
if (chatForm) {
  chatForm.addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!backendClient || !currentUser || !activeChatUserId || !text) {
      if (!currentUser) showToast("Sign in and select a player before sending a message.");
      return;
    }
    const submit = chatForm.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    const { data, error } = await backendClient
      .from("direct_messages")
      .insert({ sender_id: currentUser.id, recipient_id: activeChatUserId, content: text })
      .select("id,sender_id,recipient_id,content,created_at")
      .single();
    if (submit) submit.disabled = false;
    if (error) {
      console.error("Could not send the message.", error);
      showToast("Message could not be sent.");
      return;
    }
    renderChatMessage(data);
    input.value = "";
  });
}

document.addEventListener("click", event => {
  const player = event.target.closest(".friend[data-user-id], .player-results .friend[data-user-id]");
  if (!player) return;
  const userId = player.dataset.userId;
  const username = player.dataset.username;
  if (document.getElementById("chat-title")) {
    loadConversation(userId, username, player.dataset.avatarPath || null);
  } else {
    window.location.href = `community.html?user=${encodeURIComponent(userId)}`;
  }
});

const playerSearchForm = document.getElementById("player-search-form");
if (playerSearchForm) {
  playerSearchForm.addEventListener("submit", event => {
    event.preventDefault();
    searchPlayers(document.getElementById("player-search").value.trim());
  });
}

const urlParams = new URLSearchParams(window.location.search);
const requestedUser = urlParams.get("user");
if (requestedUser && /^[0-9a-f-]{36}$/i.test(requestedUser)) {
  window.addEventListener("qorum-auth-ready", async () => {
    if (!currentUser) return;
    const { data, error } = await backendClient
      .from("profiles")
      .select("id,username,avatar_path")
      .eq("id", requestedUser)
      .maybeSingle();
    if (error) {
      console.error("Could not open the selected player's profile.", error);
      showToast("That player could not be found.");
      return;
    }
    if (data) loadConversation(data.id, data.username, data.avatar_path);
  }, { once: true });
}

const requestedGame = urlParams.get("game");
const requestedRoom = urlParams.get("room");
if (requestedGame || requestedRoom) {
  window.setTimeout(() => {
    const code = requestedRoom ? requestedRoom.trim().toUpperCase() : null;
    const gId = requestedGame || (code && PREFIX_GAME_MAP[code.charAt(0)]) || "tic-tac-toe";
    launchGame(gId, code);
  }, 180);
}

if (searchInput) {
  const initialSearch = urlParams.get("search");
  if (initialSearch && featuredGames) searchInput.value = initialSearch;
  searchInput.addEventListener("input", renderGames);
  if (!featuredGames && !libraryGames) {
    searchInput.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const query = searchInput.value.trim();
      window.location.href = query ? `index.html?search=${encodeURIComponent(query)}` : "index.html";
    });
  }
}

const profileAction = document.getElementById("profile-action");
if (profileAction) profileAction.addEventListener("click", signOutOrOpenLogin);
const avatarUpload = document.getElementById("avatar-upload");
if (avatarUpload) avatarUpload.addEventListener("change", () => {
  if (avatarUpload.files?.[0]) void uploadProfileAvatar(avatarUpload.files[0]);
});
const profileSignin = document.getElementById("profile-signin");
if (profileSignin) profileSignin.addEventListener("click", signOutOrOpenLogin);
const modalSwitch = document.getElementById("modal-switch");
if (modalSwitch) modalSwitch.addEventListener("click", () => openAuth(authMode === "signin" ? "signup" : "signin"));
const closeModal = document.getElementById("close-modal");
if (closeModal) closeModal.addEventListener("click", closeAuthModal);
const gameClose = document.getElementById("game-close");
if (gameClose) gameClose.addEventListener("click", closeGame);
const gameRestart = document.getElementById("game-restart");
if (gameRestart) gameRestart.addEventListener("click", () => {
  if (activeGameId) launchGame(activeGameId);
});
if (gameModal) gameModal.addEventListener("click", event => {
  if (event.target === gameModal) closeGame();
});
if (authModal) authModal.addEventListener("click", event => {
  if (event.target === authModal) closeAuthModal();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (authModal && authModal.classList.contains("open")) closeAuthModal();
    closeGame();
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  }
});

const authForm = document.getElementById("auth-form");
if (authForm) authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (authView !== "credentials") return;
  if (!backendClient) {
    document.getElementById("form-error").textContent = translatedValue("The account service is unavailable. Check your connection and try again.");
    return;
  }
  const username = document.getElementById("auth-username").value.trim();
  const password = document.getElementById("auth-password").value;
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username) || password.length < 8 || password.length > 72) {
    document.getElementById("form-error").textContent = translatedValue("Enter a valid username and a password between 8 and 72 characters.");
    return;
  }
  let result;
  if (authMode === "signup") {
    const { data, error } = await backendClient.functions.invoke("register-account", {
      body: { username, password },
    });
    if (error || !data?.success || typeof data.recoveryCode !== "string"
      || !/^[A-Za-z0-9_-]{43}$/.test(data.recoveryCode)) {
      if (error) console.error("Account registration failed.", error);
      document.getElementById("form-error").textContent = error
        ? await functionErrorMessage(error, "The account could not be created. Please try again.")
        : data?.error || "The account could not be safely initialized. Please try again.";
      return;
    }
    pendingRecovery = { username, code: data.recoveryCode };
    result = await backendClient.auth.signInWithPassword({
      email: usernameAuthEmail(username),
      password,
    });
    if (result.error) {
      console.error("The account was created, but automatic sign-in failed.", result.error);
      pendingRecovery.loginAfterSignup = true;
      document.getElementById("auth-password").value = "";
      document.getElementById("recovery-card-username").textContent = username;
      document.getElementById("recovery-card-code").textContent = pendingRecovery.code;
      document.getElementById("recovery-card-status").textContent =
        "The code is saved securely. Automatic sign-in failed; save this code, then sign in with your username and password.";
      authView = "code";
      setAuthView("code");
      return;
    }
  } else {
    result = await backendClient.auth.signInWithPassword({
      email: usernameAuthEmail(username),
      password,
    });
    if (result.error) {
      result = await backendClient.auth.signInWithPassword({
        email: `${username.toLowerCase()}@accounts.qorum.invalid`,
        password,
      });
    }
  }
  if (result.error) {
    console.error("Authentication failed.", result.error);
    const duplicateUsername = result.error.code === "23505" || result.error.message.includes("profiles_username_lower_idx");
    document.getElementById("form-error").textContent = duplicateUsername
      ? translatedValue("That username is already taken. Please choose another.")
      : authMode === "signup"
        ? result.error.message
        : translatedValue("Username or password is incorrect.");
    return;
  }
  if (authMode === "signup") {
    document.getElementById("auth-password").value = "";
    await updateProfileUI(result.data.user);
    authView = "saving";
    setAuthView("saving");
    await savePendingRecoveryCode();
    return;
  }
  authModal.classList.remove("open");
  await updateProfileUI(result.data.user);
  showToast("You are signed in.");
});

const loginButton = document.getElementById("login-button");
if (loginButton) loginButton.addEventListener("click", () => {
  if (currentUser) window.location.href = "profile.html";
  else openAuth("signin");
});
const notificationsButton = document.getElementById("notifications-button");
if (notificationsButton) notificationsButton.addEventListener("click", () => showToast("You're all caught up."));
const menuButton = document.getElementById("menu-button");
if (menuButton) menuButton.addEventListener("click", () => {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.toggle("open");
});

async function signOutOrOpenLogin() {
  if (!currentUser) {
    openAuth("signin");
    return;
  }
  await finishGameTracking();
  const { error } = await backendClient.auth.signOut();
  if (error) {
    console.error("Could not sign out.", error);
    showToast("Sign out failed. Please try again.");
    return;
  }
  showToast("You have signed out.");
}

async function uploadProfileAvatar(file) {
  const input = document.getElementById("avatar-upload");
  const status = document.getElementById("avatar-upload-status");
  const mimeExtensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!currentUser || !backendClient) {
    showToast("Sign in to upload a profile picture.");
    return;
  }
  if (!file || !mimeExtensions[file.type] || file.size > 3 * 1024 * 1024 || file.size === 0) {
    if (status) status.textContent = translatedValue("Choose a JPG, PNG, or WebP image up to 3 MB.");
    return;
  }

  const ownerId = currentUser.id;
  const oldAvatarPath = currentAvatarPath;
  const extension = mimeExtensions[file.type];
  const newAvatarPath = `${ownerId}/${Date.now()}.${extension}`;
  if (input) input.disabled = true;
  if (status) status.textContent = translatedValue("Uploading your profile picture…");

  const { error: uploadError } = await backendClient.storage
    .from("avatars")
    .upload(newAvatarPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    console.error("Could not upload the profile picture.", uploadError);
    if (status) status.textContent = translatedValue("The picture could not be uploaded. Please try again.");
    if (input) input.disabled = false;
    return;
  }

  const { error: profileError } = await backendClient
    .from("profiles")
    .update({ avatar_path: newAvatarPath })
    .eq("id", ownerId);
  if (profileError) {
    console.error("Could not save the profile picture to your profile.", profileError);
    const { error: cleanupError } = await backendClient.storage.from("avatars").remove([newAvatarPath]);
    if (cleanupError) console.error("Could not remove the unlinked profile picture.", cleanupError);
    if (status) status.textContent = translatedValue("The picture uploaded, but your profile could not be updated.");
    if (input) input.disabled = false;
    return;
  }
  if (currentUser?.id !== ownerId) {
    if (input) input.disabled = false;
    return;
  }

  currentAvatarPath = newAvatarPath;
  document.querySelectorAll(".profile-card .avatar").forEach(element => {
    setAvatar(element, currentUsername, currentAvatarPath);
  });
  setAvatar(document.getElementById("profile-view-avatar"), currentUsername, currentAvatarPath);

  if (oldAvatarPath && oldAvatarPath !== newAvatarPath) {
    const { error: cleanupError } = await backendClient.storage.from("avatars").remove([oldAvatarPath]);
    if (cleanupError) {
      console.error("Could not remove the previous profile picture.", cleanupError);
      if (status) status.textContent = translatedValue("Picture updated. The previous image could not be removed.");
      showToast("Your picture updated, but the previous image could not be removed.");
    }
  }
  if (status && !status.textContent.startsWith("Picture updated.")) {
    status.textContent = translatedValue("Profile picture updated.");
  }
  if (input) {
    input.value = "";
    input.disabled = false;
  }
}

async function updateProfileUI(user) {
  if (!backendClient) {
    currentUser = null;
    currentUsername = "Guest player";
    currentAvatarPath = null;
    const status = document.getElementById("profile-view-status");
    if (status) status.textContent = translatedValue("Account service unavailable.");
  } else {
    if (user === undefined) {
      const { data, error } = await backendClient.auth.getSession();
      if (error) {
        console.error("Could not restore the signed-in session.", error);
        showToast("Your sign-in status could not be restored.");
        return;
      }
      user = data.session?.user ?? null;
    }
    currentUser = user;
    currentUsername = "Guest player";
    currentAvatarPath = null;
    if (currentUser) {
      const { data, error } = await backendClient
        .from("profiles")
        .select("username,avatar_path")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (error) {
        console.error("Could not load your QORUM profile.", error);
        showToast("Your profile details could not be loaded.");
      } else if (data) {
        currentUsername = data.username;
        currentAvatarPath = data.avatar_path;
      }
    }
  }
  const profileName = document.getElementById("profile-name");
  const profileLevel = document.getElementById("profile-level");
  const login = document.getElementById("login-button");
  if (profileName) profileName.textContent = currentUsername;
  if (profileLevel) profileLevel.textContent = currentUser ? "Signed in" : "Not signed in";
  if (login) login.textContent = currentUser ? "My account" : "Sign in";
  const nameHeading = document.getElementById("profile-view-name");
  const signinMethod = document.getElementById("profile-view-signin-method");
  const avatar = document.getElementById("profile-view-avatar");
  const accountStatus = document.getElementById("profile-view-status");
  if (nameHeading) nameHeading.textContent = currentUsername;
  if (signinMethod) signinMethod.textContent = currentUser
    ? "Username sign-in · Save your recovery code privately"
    : "Sign in to save your profile.";
  setAvatar(avatar, currentUser ? currentUsername : "Guest", currentUser ? currentAvatarPath : null);
  document.querySelectorAll(".profile-card .avatar").forEach(element => {
    setAvatar(element, currentUser ? currentUsername : "Guest", currentUser ? currentAvatarPath : null);
  });
  const avatarControls = document.getElementById("avatar-upload-controls");
  if (avatarControls) avatarControls.hidden = !currentUser;
  const publicChatInput = document.getElementById("public-chat-input");
  const publicChatSubmit = document.querySelector("#public-chat-form button[type='submit']");
  if (publicChatInput) publicChatInput.disabled = !currentUser;
  if (publicChatSubmit) publicChatSubmit.disabled = !currentUser;
  if (accountStatus) accountStatus.textContent = currentUser ? "QORUM account · Signed in" : "Guest profile · Sign in to continue";
  const profileSignin = document.getElementById("profile-signin");
  if (profileSignin) profileSignin.textContent = currentUser ? "Sign out" : "Sign in or create account";
  const gameCount = document.getElementById("profile-game-count");
  const bestScore = document.getElementById("profile-best-score");
  if (gameCount) gameCount.textContent = library.length;
  if (bestScore) {
    const scores = games.map(game => Number(localStorage.getItem(`playroom-score-${game.id}`)) || 0);
    bestScore.textContent = Math.max(0, ...scores);
  }
  if (currentUser) {
    await Promise.all([loadPlayers(), loadPersonalPlaytime()]);
  } else {
    if (activeChatChannel) {
      await backendClient.removeChannel(activeChatChannel);
      activeChatChannel = null;
    }
    activeChatUserId = null;
    const list = document.getElementById("friend-list");
    const count = document.getElementById("online-count");
    if (list) list.innerHTML = `<span class="friend-status">${translatedValue("Sign in to find players.")}</span>`;
    if (count) count.textContent = "0";
    const chatTitle = document.getElementById("chat-title");
    const chatStatus = document.getElementById("chat-status");
    const chatAvatar = document.getElementById("chat-avatar");
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatSubmit = document.querySelector("#chat-form button[type='submit']");
    if (chatTitle) chatTitle.textContent = "Choose a player";
    if (chatStatus) chatStatus.textContent = "Sign in to start a conversation.";
    if (chatAvatar) chatAvatar.textContent = "?";
    if (chatMessages) chatMessages.innerHTML = `<div class="empty-state">${translatedValue("Search for a username or select a player from the sidebar.")}</div>`;
    if (chatInput) chatInput.disabled = true;
    if (chatSubmit) chatSubmit.disabled = true;
    const playerResults = document.getElementById("player-results");
    if (playerResults) playerResults.replaceChildren();
    const totalSeconds = Object.values(personalGameSeconds).reduce((a, b) => a + b, 0);
    const totalTime = document.getElementById("profile-session-count");
    if (totalTime) totalTime.textContent = formatDuration(totalSeconds);
    const timeList = document.getElementById("profile-game-times");
    if (timeList) {
      timeList.replaceChildren(...games.map(game => {
        const row = document.createElement("div");
        row.className = "profile-game-time";
        const localSec = personalGameSeconds[game.id] || 0;
        if (localSec > 0) {
          const label = document.createElement("span");
          label.textContent = game.title;
          const duration = document.createElement("strong");
          duration.textContent = formatDuration(localSec);
          row.append(label, duration);
        } else {
          row.textContent = `${translatedValue(game.title)} · ${translatedValue("Sign in to record play time")}`;
        }
        return row;
      }));
      localizeTree(timeList, true);
    }
  }
  window.dispatchEvent(new Event("qorum-auth-ready"));
}

if (backendClient) {
  backendClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => updateProfileUI(session?.user ?? null), 0);
  });
} else {
  console.error("Supabase configuration is missing or the client library did not load.");
  showToast("Account service is not configured.");
}

initGlobalLobby();
initializePublicChat();
updateProfileUI();
loadPublicPlaytime();
renderGames();
