
    const config = window.QORUM_CONFIG;
    const backendClient = window.supabase && config && config.supabaseUrl && config.supabasePublishableKey
      ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey)
      : null;
    const games = [
      { id: "snake", title: "Snake", genre: "Arcade · Classic", symbol: "🐍", cover: "cover-snake", badge: "A CLASSIC", instructions: "Collect the little apples. Don't bump into the walls or your own tail.", controls: "Arrow keys or WASD · use the buttons on mobile", kind: "snake" },
      { id: "sky-hop", title: "Sky Hopper", genre: "Arcade · One-button", symbol: "🐦", cover: "cover-sky", badge: "ONE BUTTON", instructions: "Tap to flap between the gates. How far can you glide?", controls: "Space, ↑ or tap the game to flap", kind: "sky" },
      { id: "pocket-pong", title: "Pocket Pong", genre: "Arcade · Solo", symbol: "🏓", cover: "cover-pong", badge: "VS COMPUTER", instructions: "Keep the ball in play and score five points against the computer.", controls: "W / S or ↑ / ↓ · move your paddle with the mouse", kind: "pong" },
      { id: "memory-garden", title: "Memory Garden", genre: "Puzzle · Relaxing", symbol: "🌼", cover: "cover-memory", badge: "TAKE IT SLOW", instructions: "Turn over two cards at a time and find all eight matching pairs.", controls: "Tap or click two cards to reveal a pair", kind: "memory" }
    ];
    const defaultLibrary = games.map(game => game.id);
    let library = [...defaultLibrary];
    try {
      const savedLibrary = JSON.parse(localStorage.getItem("playroom-library") || "null");
      if (Array.isArray(savedLibrary)) {
        const validGames = savedLibrary.filter(id => games.some(game => game.id === id));
        if (validGames.length) library = [...new Set(validGames)];
      }
    } catch (error) {
      console.warn("Could not read the saved game library.", error);
    }
    localStorage.setItem("playroom-library", JSON.stringify(library));
    let authMode = "signin";
    let toastTimer;
    let activeGameCleanup = null;
    let currentUser = null;
    let currentUsername = "Guest player";
    let activeChatUserId = null;
    let activeChatChannel = null;
    let activeTrackingSessionId = null;
    let trackingHeartbeat = null;
    const personalGameSeconds = Object.fromEntries(games.map(game => [game.id, 0]));

    const featuredGames = document.getElementById("featured-games");
    const libraryGames = document.getElementById("library-games");
    const searchInput = document.getElementById("game-search");
    const toast = document.getElementById("toast");
    const authModal = document.getElementById("auth-modal");

    function formatDuration(seconds) {
      const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
    }

    function renderGameCard(game) {
      const bestScore = Number(localStorage.getItem(`playroom-score-${game.id}`)) || 0;
      const scoreLabel = bestScore ? `Best ${bestScore}${game.id === "memory-garden" ? " moves" : ""}` : "Ready to play";
      return `<article class="game-card">
        <div class="game-cover ${game.cover}"><span class="cover-symbol" aria-hidden="true">${game.symbol}</span><span class="cover-label">${game.badge}</span></div>
        <div class="game-info">
          <div class="game-title-line"><h3 class="game-title">${game.title}</h3><span class="game-rating">FREE</span></div>
          <div class="game-meta"><span>${game.genre}</span><span class="price">${scoreLabel}</span></div>
          <div class="game-playtime">Your play time · ${formatDuration(personalGameSeconds[game.id])}</div>
          <div class="game-actions"><span class="library-status">✓ In your games</span><button class="primary-button" type="button" data-play="${game.id}">Play now</button></div>
        </div>
      </article>`;
    }

    function renderGames() {
      const query = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const matched = games.filter(game => {
        const searchMatches = `${game.title} ${game.genre}`.toLowerCase().includes(query);
        return searchMatches;
      });
      const ownedGames = games.filter(game => library.includes(game.id) && `${game.title} ${game.genre}`.toLowerCase().includes(query));
      if (featuredGames) {
        featuredGames.innerHTML = matched.map(game => renderGameCard(game)).join("")
          || '<div class="empty-state">No games match that search. Try another title or genre.</div>';
      }
      if (libraryGames) {
        libraryGames.innerHTML = ownedGames.map(game => renderGameCard(game)).join("")
          || '<div class="empty-state">No games match that search. Try another title or genre.</div>';
      }
      const libraryCount = document.getElementById("library-count");
      const libraryTotal = document.getElementById("library-total");
      if (libraryCount) libraryCount.textContent = library.length;
      if (libraryTotal) libraryTotal.textContent = library.length;
    }

    function showToast(message) {
      if (!toast) return;
      toast.textContent = message;
      toast.classList.add("visible");
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
    }

    function openAuth(mode) {
      if (!authModal) return;
      authMode = mode;
      let usernameField = document.getElementById("username-field");
      if (!usernameField) {
        usernameField = document.createElement("label");
        usernameField.className = "form-field";
        usernameField.id = "username-field";
        usernameField.textContent = "Username";
        const usernameInput = document.createElement("input");
        usernameInput.id = "auth-username";
        usernameInput.type = "text";
        usernameInput.minLength = 3;
        usernameInput.maxLength = 24;
        usernameInput.pattern = "[A-Za-z0-9_]{3,24}";
        usernameInput.autocomplete = "username";
        usernameInput.placeholder = "3-24 letters, numbers, or _";
        usernameField.append(usernameInput);
        document.getElementById("auth-email").parentElement.before(usernameField);
      }
      const usernameInput = document.getElementById("auth-username");
      usernameField.hidden = mode !== "signup";
      usernameInput.required = mode === "signup";
      document.getElementById("modal-title").textContent = mode === "signin" ? "Welcome back" : "Join QORUM";
      document.getElementById("modal-description").textContent = mode === "signin" ? "Sign in to pick up where you left off." : "Create your player profile and find your people.";
      document.getElementById("auth-submit").textContent = mode === "signin" ? "Sign in" : "Create account";
      document.getElementById("modal-switch").textContent = mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in";
      const passwordInput = document.getElementById("auth-password");
      passwordInput.minLength = 8;
      passwordInput.placeholder = "At least 8 characters";
      passwordInput.autocomplete = mode === "signin" ? "current-password" : "new-password";
      const demoNote = authModal.querySelector(".demo-note");
      if (demoNote) demoNote.textContent = "Sign up with a valid email address. Email confirmation may be required.";
      document.getElementById("form-error").textContent = "";
      authModal.classList.add("open");
      document.getElementById("auth-email").focus();
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

    function drawCanvasMessage(context, canvas, title, subtitle) {
      context.fillStyle = "rgba(18, 20, 21, .72)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.textAlign = "center";
      context.fillStyle = "#e9e7e1";
      context.font = "600 25px system-ui, sans-serif";
      context.fillText(title, canvas.width / 2, canvas.height / 2 - 7);
      context.fillStyle = "#c1c0bb";
      context.font = "13px system-ui, sans-serif";
      context.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
    }

    function makeCanvasStage(instruction, scoreMarkup = "") {
      gameStage.innerHTML = `<div class="game-instructions"><span>${instruction}</span><span class="game-score">${scoreMarkup}</span></div><canvas class="arcade-canvas" width="720" height="360" aria-label="Playable mini game"></canvas><div class="game-stage-footer" id="game-touch-controls"></div><p class="game-end-message" id="game-end-message" aria-live="polite"></p>`;
      return gameStage.querySelector("canvas");
    }

    function startSnake(game) {
      const canvas = makeCanvasStage(game.controls, "Score <span id=\"live-score\">0</span>");
      const context = canvas.getContext("2d");
      const cell = 24;
      const columns = canvas.width / cell;
      const rows = canvas.height / cell;
      let snake = [{ x: 8, y: 7 }, { x: 7, y: 7 }, { x: 6, y: 7 }];
      let direction = { x: 1, y: 0 };
      let nextDirection = direction;
      let score = 0;
      let fruit = { x: 19, y: 7 };
      let stopped = false;
      const endMessage = document.getElementById("game-end-message");

      function placeFruit() {
        do {
          fruit = { x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) };
        } while (snake.some(part => part.x === fruit.x && part.y === fruit.y));
      }

      function draw() {
        context.fillStyle = "#1b201d";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = "rgba(205, 211, 195, .045)";
        context.lineWidth = 1;
        for (let x = 0; x <= canvas.width; x += cell) {
          context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
        }
        for (let y = 0; y <= canvas.height; y += cell) {
          context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
        }
        context.fillStyle = "#c49b78";
        context.beginPath();
        context.arc(fruit.x * cell + cell / 2, fruit.y * cell + cell / 2, cell * .34, 0, Math.PI * 2);
        context.fill();
        snake.forEach((part, index) => {
          context.fillStyle = index === 0 ? "#bac6aa" : "#899785";
          context.beginPath();
          context.roundRect(part.x * cell + 2, part.y * cell + 2, cell - 4, cell - 4, 7);
          context.fill();
        });
      }

      function endGame() {
        stopped = true;
        window.clearInterval(timer);
        endMessage.textContent = `Game over · Final score ${score}. Press ↻ to try again.`;
        rememberScore("snake", score);
      }

      function tick() {
        direction = nextDirection;
        const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
        const eating = head.x === fruit.x && head.y === fruit.y;
        const body = eating ? snake : snake.slice(0, -1);
        if (head.x < 0 || head.x >= columns || head.y < 0 || head.y >= rows || body.some(part => part.x === head.x && part.y === head.y)) {
          endGame();
          draw();
          drawCanvasMessage(context, canvas, "Nice try!", `Your score: ${score} · Press ↻ to play again`);
          return;
        }
        snake.unshift(head);
        if (eating) {
          score += 1;
          document.getElementById("live-score").textContent = score;
          if (snake.length === columns * rows) {
            stopped = true;
            window.clearInterval(timer);
            endMessage.textContent = "You filled the whole garden! A perfect game.";
            rememberScore("snake", score);
          } else {
            placeFruit();
          }
        } else {
          snake.pop();
        }
        draw();
      }

      function turn(x, y) {
        if (x !== -direction.x || y !== -direction.y) nextDirection = { x, y };
      }

      function onKeyDown(event) {
        const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
        const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
        if (keys[key]) {
          event.preventDefault();
          turn(...keys[key]);
        }
      }

      document.addEventListener("keydown", onKeyDown);
      document.getElementById("game-touch-controls").innerHTML = '<button class="game-control" data-direction="up" aria-label="Move up">↑</button><button class="game-control" data-direction="left" aria-label="Move left">←</button><button class="game-control" data-direction="down" aria-label="Move down">↓</button><button class="game-control" data-direction="right" aria-label="Move right">→</button>';
      document.getElementById("game-touch-controls").addEventListener("click", event => {
        const button = event.target.closest("[data-direction]");
        if (!button) return;
        const directions = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
        turn(...directions[button.dataset.direction]);
      });
      const timer = window.setInterval(() => { if (!stopped) tick(); }, 115);
      draw();
      return () => { stopped = true; window.clearInterval(timer); document.removeEventListener("keydown", onKeyDown); };
    }

    function startSkyHop(game) {
      const canvas = makeCanvasStage(game.controls, "Distance <span id=\"live-score\">0</span>");
      const context = canvas.getContext("2d");
      const player = { x: 150, y: 180, velocity: 0, radius: 13 };
      const obstacles = [];
      let score = 0;
      let started = false;
      let stopped = false;
      let frameId = 0;
      let lastTime = 0;
      const gap = 135;
      const endMessage = document.getElementById("game-end-message");

      function createObstacle(x) {
        const margin = 52;
        const gapY = margin + Math.random() * (canvas.height - gap - margin * 2);
        obstacles.push({ x, gapY, scored: false });
      }

      function flap() {
        if (stopped) return;
        started = true;
        player.velocity = -7.2;
        endMessage.textContent = "";
      }

      function draw() {
        const sky = context.createLinearGradient(0, 0, 0, canvas.height);
        sky.addColorStop(0, "#303a3d");
        sky.addColorStop(1, "#222a2c");
        context.fillStyle = sky;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(193, 178, 146, .12)";
        context.beginPath(); context.arc(560, 74, 35, 0, Math.PI * 2); context.fill();
        obstacles.forEach(obstacle => {
          context.fillStyle = "#829087";
          context.fillRect(obstacle.x, 0, 54, obstacle.gapY);
          context.fillRect(obstacle.x, obstacle.gapY + gap, 54, canvas.height - obstacle.gapY - gap);
          context.fillStyle = "#9ca99d";
          context.fillRect(obstacle.x - 4, obstacle.gapY - 13, 62, 13);
          context.fillRect(obstacle.x - 4, obstacle.gapY + gap, 62, 13);
        });
        context.save();
        context.translate(player.x, player.y);
        context.fillStyle = "#c5b28f";
        context.beginPath(); context.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#e8e1d2";
        context.beginPath(); context.arc(6, -4, 3.2, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#363a37";
        context.beginPath(); context.arc(7, -4, 1.4, 0, Math.PI * 2); context.fill();
        context.fillStyle = "#b4896d";
        context.beginPath(); context.moveTo(12, 1); context.lineTo(22, 4); context.lineTo(12, 7); context.fill();
        context.restore();
      }

      function finish() {
        if (stopped) return;
        stopped = true;
        endMessage.textContent = `Run over · You passed ${score} ${score === 1 ? "gate" : "gates"}. Press ↻ to fly again.`;
        rememberScore("sky-hop", score);
        drawCanvasMessage(context, canvas, "Lovely flight!", `You passed ${score} ${score === 1 ? "gate" : "gates"} · Press ↻ to try again`);
      }

      function loop(timestamp) {
        if (stopped) return;
        const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
        lastTime = timestamp;
        if (started) {
          player.velocity += .39 * delta;
          player.y += player.velocity * delta;
          obstacles.forEach(obstacle => {
            obstacle.x -= 2.45 * delta;
            if (!obstacle.scored && obstacle.x + 54 < player.x) {
              obstacle.scored = true;
              score += 1;
              document.getElementById("live-score").textContent = score;
            }
            const overlapsX = player.x + player.radius > obstacle.x && player.x - player.radius < obstacle.x + 54;
            const outsideGap = player.y - player.radius < obstacle.gapY || player.y + player.radius > obstacle.gapY + gap;
            if (overlapsX && outsideGap) finish();
          });
          while (obstacles.length && obstacles[0].x < -65) obstacles.shift();
          if (!obstacles.length || obstacles[obstacles.length - 1].x < canvas.width - 215) createObstacle(canvas.width + 10);
          if (player.y - player.radius < 0 || player.y + player.radius > canvas.height) finish();
        } else if (!obstacles.length) {
          createObstacle(canvas.width - 40);
        }
        draw();
        if (stopped) drawCanvasMessage(context, canvas, "Lovely flight!", `You passed ${score} ${score === 1 ? "gate" : "gates"} · Press ↻ to try again`);
        else if (!started && timestamp > 0) drawCanvasMessage(context, canvas, "Sky Hopper", "Press space or tap to take off");
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
      return () => { stopped = true; cancelAnimationFrame(frameId); document.removeEventListener("keydown", onKeyDown); canvas.removeEventListener("pointerdown", flap); };
    }

    function startPong(game) {
      const canvas = makeCanvasStage(game.controls, "You <span id=\"player-score\">0</span> : <span id=\"opponent-score\">0</span> Computer");
      const context = canvas.getContext("2d");
      const paddleHeight = 82;
      const player = { y: canvas.height / 2 - paddleHeight / 2, score: 0 };
      const opponent = { y: canvas.height / 2 - paddleHeight / 2, score: 0 };
      const ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 4, vy: 2 };
      let stopped = false;
      let frameId = 0;
      let lastTime = 0;
      const endMessage = document.getElementById("game-end-message");

      function draw() {
        context.fillStyle = "#1d2022";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.setLineDash([7, 9]);
        context.strokeStyle = "rgba(232, 230, 222, .19)";
        context.beginPath(); context.moveTo(canvas.width / 2, 12); context.lineTo(canvas.width / 2, canvas.height - 12); context.stroke();
        context.setLineDash([]);
        context.fillStyle = "#aeb9a3";
        context.beginPath(); context.roundRect(24, player.y, 11, paddleHeight, 5); context.fill();
        context.fillStyle = "#aab1b0";
        context.beginPath(); context.roundRect(canvas.width - 35, opponent.y, 11, paddleHeight, 5); context.fill();
        context.fillStyle = "#d1c5a9";
        context.beginPath(); context.arc(ball.x, ball.y, 8, 0, Math.PI * 2); context.fill();
      }

      function updateScore() {
        document.getElementById("player-score").textContent = player.score;
        document.getElementById("opponent-score").textContent = opponent.score;
      }

      function point(scoredByPlayer) {
        if (scoredByPlayer) player.score += 1;
        else opponent.score += 1;
        updateScore();
        if (player.score >= 5 || opponent.score >= 5) {
          stopped = true;
          endMessage.textContent = player.score >= 5 ? "You win! Press ↻ for a rematch." : "Good game! Press ↻ for another round.";
          rememberScore("pocket-pong", player.score);
          drawCanvasMessage(context, canvas, player.score >= 5 ? "You win!" : "Good game!", `Final score ${player.score}–${opponent.score} · Press ↻ to play again`);
          return;
        }
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.vx = scoredByPlayer ? 4 : -4;
        ball.vy = Math.random() * 4 - 2;
      }

      function loop(timestamp) {
        if (stopped) return;
        const delta = Math.min((timestamp - (lastTime || timestamp)) / 16.67, 2);
        lastTime = timestamp;
        ball.x += ball.vx * delta;
        ball.y += ball.vy * delta;
        if (ball.y < 8 || ball.y > canvas.height - 8) ball.vy *= -1;
        const opponentCenter = opponent.y + paddleHeight / 2;
        opponent.y += Math.max(-3.1 * delta, Math.min(3.1 * delta, ball.y - opponentCenter)) * .88;
        opponent.y = Math.max(0, Math.min(canvas.height - paddleHeight, opponent.y));
        if (ball.vx < 0 && ball.x - 8 < 35 && ball.y > player.y && ball.y < player.y + paddleHeight) {
          ball.x = 43;
          ball.vx = Math.min(Math.abs(ball.vx) * 1.04, 9);
          ball.vy += (ball.y - (player.y + paddleHeight / 2)) * .055;
        }
        if (ball.vx > 0 && ball.x + 8 > canvas.width - 35 && ball.y > opponent.y && ball.y < opponent.y + paddleHeight) {
          ball.x = canvas.width - 43;
          ball.vx = -Math.min(Math.abs(ball.vx) * 1.04, 9);
          ball.vy += (ball.y - (opponent.y + paddleHeight / 2)) * .045;
        }
        if (ball.x < 0) point(false);
        if (ball.x > canvas.width) point(true);
        if (!stopped) draw();
        frameId = requestAnimationFrame(loop);
      }

      function movePlayer(y) {
        player.y = Math.max(0, Math.min(canvas.height - paddleHeight, y));
      }
      function onKeyDown(event) {
        if (["ArrowUp", "ArrowDown", "w", "W", "s", "S"].includes(event.key)) event.preventDefault();
        if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") movePlayer(player.y - 27);
        if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") movePlayer(player.y + 27);
      }
      function onPointerMove(event) {
        const bounds = canvas.getBoundingClientRect();
        movePlayer((event.clientY - bounds.top) * canvas.height / bounds.height - paddleHeight / 2);
      }
      document.addEventListener("keydown", onKeyDown);
      canvas.addEventListener("pointermove", onPointerMove);
      draw();
      frameId = requestAnimationFrame(loop);
      return () => { stopped = true; cancelAnimationFrame(frameId); document.removeEventListener("keydown", onKeyDown); canvas.removeEventListener("pointermove", onPointerMove); };
    }

    function startMemoryGarden(game) {
      gameStage.innerHTML = `<div class="game-instructions"><span>${game.controls}</span><span class="game-score">Moves <span id="memory-moves">0</span></span></div><div class="memory-grid" id="memory-grid"></div><p class="game-end-message" id="game-end-message" aria-live="polite"></p>`;
      const symbols = ["🍐", "🍄", "🌿", "🌻", "🍋", "🐞", "🪻", "🌙"];
      const cards = [...symbols, ...symbols];
      for (let index = cards.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
      }
      const grid = document.getElementById("memory-grid");
      let selected = [];
      let moves = 0;
      let matched = 0;
      let locked = false;
      let mismatchTimer = 0;
      const endMessage = document.getElementById("game-end-message");
      grid.innerHTML = cards.map((symbol, index) => `<button class="memory-card" type="button" data-index="${index}" aria-label="Hidden garden card">✿</button>`).join("");
      grid.addEventListener("click", event => {
        const card = event.target.closest(".memory-card");
        if (!card || locked || card.classList.contains("revealed") || card.classList.contains("matched")) return;
        const index = Number(card.dataset.index);
        card.textContent = cards[index];
        card.classList.add("revealed");
        card.setAttribute("aria-label", `Garden card ${cards[index]}`);
        selected.push(card);
        if (selected.length !== 2) return;
        moves += 1;
        document.getElementById("memory-moves").textContent = moves;
        if (cards[Number(selected[0].dataset.index)] === cards[Number(selected[1].dataset.index)]) {
          selected.forEach(item => item.classList.replace("revealed", "matched"));
          selected = [];
          matched += 1;
          if (matched === symbols.length) {
            endMessage.textContent = `A lovely match · All pairs found in ${moves} moves!`;
            const key = "playroom-score-memory-garden";
            const best = Number(localStorage.getItem(key)) || 0;
            if (!best || moves < best) localStorage.setItem(key, String(moves));
            renderGames();
          }
          return;
        }
        locked = true;
        mismatchTimer = window.setTimeout(() => {
          selected.forEach(item => {
            item.classList.remove("revealed");
            item.textContent = "✿";
            item.setAttribute("aria-label", "Hidden garden card");
          });
          selected = [];
          locked = false;
        }, 720);
      });
      return () => window.clearTimeout(mismatchTimer);
    }

    let trackingAttempt = 0;

    async function finishGameTracking(cancelPending = true) {
      if (cancelPending) trackingAttempt += 1;
      window.clearInterval(trackingHeartbeat);
      trackingHeartbeat = null;
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
      if (backendClient && !currentUser) showToast("Sign in to record your play time.");
      if (!backendClient || !currentUser || activeGameId !== gameId || attempt !== trackingAttempt) return;
      const { data: sessionId, error } = await backendClient.rpc("start_game_session", { p_game_id: gameId });
      if (error) {
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
      item.className = `message${message.sender_id === currentUser.id ? " mine" : ""}`;
      item.dataset.messageId = message.id;
      item.textContent = message.content;
      const time = document.createElement("span");
      time.className = "message-time";
      time.textContent = new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at));
      item.append(time);
      messages.append(item);
      messages.scrollTop = messages.scrollHeight;
    }

    async function loadConversation(userId, username) {
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
      if (status) status.textContent = "Direct messages";
      if (avatar) avatar.textContent = username.slice(0, 1).toUpperCase();
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
      if (!data.length) messages.innerHTML = '<div class="empty-state">Start the conversation with a message.</div>';
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

    function createPlayerButton(player) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "friend";
      button.dataset.userId = player.id;
      button.dataset.username = player.username;
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = player.username.slice(0, 1).toUpperCase();
      const info = document.createElement("span");
      info.className = "friend-info";
      const name = document.createElement("span");
      name.className = "friend-name";
      name.textContent = player.username;
      const subtitle = document.createElement("span");
      subtitle.className = "friend-status";
      subtitle.textContent = "QORUM player";
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
        .select("id,username")
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
      if (!data.length) list.innerHTML = '<span class="friend-status">No other players yet.</span>';
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
        results.textContent = "Enter at least 3 characters to search.";
        return;
      }
      const { data, error } = await backendClient
        .from("profiles")
        .select("id,username")
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
        results.textContent = "No players found. Check the username and try again.";
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
      for (const game of games) personalGameSeconds[game.id] = 0;
      const now = Date.now();
      for (const session of data) {
        const seconds = session.ended_at
          ? session.duration_seconds
          : Math.max(0, Math.floor((Math.min(now, new Date(session.last_heartbeat_at).getTime() + 45_000) - new Date(session.started_at).getTime()) / 1000));
        personalGameSeconds[session.game_id] += seconds;
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
      }
      renderGames();
    }

    async function loadPublicPlaytime() {
      const table = document.getElementById("public-stats");
      if (!table) return;
      if (!backendClient) {
        table.innerHTML = '<tr><td colspan="3">Statistics are unavailable until the account service is configured.</td></tr>';
        return;
      }
      const { data, error } = await backendClient.rpc("get_public_game_stats");
      if (error) {
        console.error("Could not load public game statistics.", error);
        table.innerHTML = '<tr><td colspan="3">Statistics could not be loaded. Please try again later.</td></tr>';
        return;
      }
      table.replaceChildren();
      const totals = new Map(data.map(row => [row.game_id, row]));
      for (const game of games) {
        const row = totals.get(game.id);
        const tr = document.createElement("tr");
        const title = document.createElement("td");
        title.textContent = game.title;
        const time = document.createElement("td");
        time.textContent = formatDuration(row ? row.total_seconds : 0);
        const players = document.createElement("td");
        players.textContent = row ? row.player_count : "0";
        tr.append(title, time, players);
        table.append(tr);
      }
    }

    function launchGame(gameId) {
      const game = games.find(item => item.id === gameId);
      if (!game || !gameModal || !gameStage) return;
      if (activeGameCleanup) activeGameCleanup();
      activeGameId = gameId;
      startGameTracking(gameId);
      document.getElementById("game-title").textContent = game.title;
      document.getElementById("game-description").textContent = game.instructions;
      gameModal.classList.add("open");
      if (game.kind === "snake") activeGameCleanup = startSnake(game);
      if (game.kind === "sky") activeGameCleanup = startSkyHop(game);
      if (game.kind === "pong") activeGameCleanup = startPong(game);
      if (game.kind === "memory") activeGameCleanup = startMemoryGarden(game);
    }

    function closeGame() {
      if (activeGameCleanup) activeGameCleanup();
      activeGameCleanup = null;
      activeGameId = null;
      finishGameTracking();
      if (gameModal) gameModal.classList.remove("open");
      if (gameStage) gameStage.replaceChildren();
    }

    document.addEventListener("click", event => {
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.play) launchGame(target.dataset.play);
    });

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
        loadConversation(userId, username);
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

    const requestedUser = new URLSearchParams(window.location.search).get("user");
    if (requestedUser && /^[0-9a-f-]{36}$/i.test(requestedUser)) {
      window.addEventListener("qorum-auth-ready", async () => {
        if (!currentUser) return;
        const { data, error } = await backendClient
          .from("profiles")
          .select("id,username")
          .eq("id", requestedUser)
          .maybeSingle();
        if (error) {
          console.error("Could not open the selected player's profile.", error);
          showToast("That player could not be found.");
          return;
        }
        if (data) loadConversation(data.id, data.username);
      }, { once: true });
    }

    if (searchInput) {
      const initialSearch = new URLSearchParams(window.location.search).get("search");
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
    const profileSignin = document.getElementById("profile-signin");
    if (profileSignin) profileSignin.addEventListener("click", signOutOrOpenLogin);
    const modalSwitch = document.getElementById("modal-switch");
    if (modalSwitch) modalSwitch.addEventListener("click", () => openAuth(authMode === "signin" ? "signup" : "signin"));
    const closeModal = document.getElementById("close-modal");
    if (closeModal) closeModal.addEventListener("click", () => authModal.classList.remove("open"));
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
      if (event.target === authModal) authModal.classList.remove("open");
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (authModal) authModal.classList.remove("open");
        closeGame();
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.remove("open");
      }
    });
    const authForm = document.getElementById("auth-form");
    if (authForm) authForm.addEventListener("submit", async event => {
      event.preventDefault();
      if (!backendClient) {
        document.getElementById("form-error").textContent = "The account service is unavailable. Check your connection and try again.";
        return;
      }
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value;
      const username = document.getElementById("auth-username").value.trim();
      if (!email || password.length < 8 || (authMode === "signup" && !/^[A-Za-z0-9_]{3,24}$/.test(username))) {
        document.getElementById("form-error").textContent = "Enter a valid email, an 8-character password, and a valid username.";
        return;
      }
      const signupOptions = { data: { username } };
      if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        signupOptions.emailRedirectTo = window.location.href.split(/[?#]/)[0];
      }
      const result = authMode === "signup"
        ? await backendClient.auth.signUp({ email, password, options: signupOptions })
        : await backendClient.auth.signInWithPassword({ email, password });
      if (result.error) {
        console.error("Authentication failed.", result.error);
        const duplicateUsername = result.error.code === "23505" || result.error.message.includes("profiles_username_lower_idx");
        document.getElementById("form-error").textContent = duplicateUsername
          ? "That username is already taken. Please choose another."
          : result.error.message;
        return;
      }
      authModal.classList.remove("open");
      if (authMode === "signup" && !result.data.session) {
        showToast("Check your email to confirm your new account.");
      } else {
        await updateProfileUI(result.data.user);
        showToast(authMode === "signin" ? "You are signed in." : "Your QORUM account is ready.");
      }
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

    async function updateProfileUI(user) {
      if (!backendClient) {
        currentUser = null;
        currentUsername = "Guest player";
        const status = document.getElementById("profile-view-status");
        if (status) status.textContent = "Account service unavailable.";
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
        if (currentUser) {
          const { data, error } = await backendClient
            .from("profiles")
            .select("username")
            .eq("id", currentUser.id)
            .maybeSingle();
          if (error) {
            console.error("Could not load your QORUM profile.", error);
            showToast("Your profile details could not be loaded.");
          } else if (data) {
            currentUsername = data.username;
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
      const emailHeading = document.getElementById("profile-view-email");
      const avatar = document.getElementById("profile-view-avatar");
      const accountStatus = document.getElementById("profile-view-status");
      if (nameHeading) nameHeading.textContent = currentUsername;
      if (emailHeading) emailHeading.textContent = currentUser?.email || "Sign in to save your profile.";
      if (avatar) avatar.textContent = currentUser ? currentUsername.slice(0, 1).toUpperCase() : "G";
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
        if (list) list.innerHTML = '<span class="friend-status">Sign in to find players.</span>';
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
        if (chatMessages) chatMessages.innerHTML = '<div class="empty-state">Search for a username or select a player from the sidebar.</div>';
        if (chatInput) chatInput.disabled = true;
        if (chatSubmit) chatSubmit.disabled = true;
        const playerResults = document.getElementById("player-results");
        if (playerResults) playerResults.replaceChildren();
        const totalTime = document.getElementById("profile-session-count");
        if (totalTime) totalTime.textContent = formatDuration(0);
        const timeList = document.getElementById("profile-game-times");
        if (timeList) timeList.replaceChildren(...games.map(game => {
          const row = document.createElement("div");
          row.className = "profile-game-time";
          row.textContent = `${game.title} · Sign in to record play time`;
          return row;
        }));
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
    updateProfileUI();
    loadPublicPlaytime();
    renderGames();
  