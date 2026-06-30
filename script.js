(function() {
    'use strict';

    const state = {
        screen: 'home',
        difficulty: 'hard',
        board: Array(9).fill(null),
        currentPlayer: 'X',
        processorSymbol: 'O',
        gameOver: false,
        gameCompleted: false,
        matchStartTime: null,
        timerInterval: null,
        currentTime: 0,
        autoStartEnabled: false,
        autoStartTimeout: null,  // <-- ADDED: Store timeout for clearing

        stats: {
            wins: 0,
            losses: 0,
            draws: 0,
            streak: 0,
            total: 0,
            rankedWins: 0,
        },

        user: {
            username: 'Guest',
            adToken: 0,
            debree: 10,
        },

        settings: {
            sound: true,
            animations: true,
            boardColor: '#6366f1',
            playerSymbol: 'X',
        },

        achievements: [],
    };

    const DIFFICULTIES = {
        noob: { name: 'Noob', multiplier: 1, accuracy: 20, ranked: false },
        easy: { name: 'Easy', multiplier: 1.5, accuracy: 50, ranked: false },
        medium: { name: 'Medium', multiplier: 2, accuracy: 90, ranked: false },
        hard: { name: 'Hard', multiplier: 3, accuracy: 100, ranked: true },
        impossible: { name: 'Impossible', multiplier: 6, accuracy: 100, ranked: true },
    };

    const RANKS = [
        { name: 'Initiate', wins: 0 },
        { name: 'Seeker', wins: 10 },
        { name: 'Guardian', wins: 25 },
        { name: 'Sentinel', wins: 40 },
        { name: 'Vanguard', wins: 60 },
        { name: 'Champion', wins: 80 },
        { name: 'Warlord', wins: 100 },
        { name: 'Mythic', wins: 150 },
    ];

    const ACHIEVEMENTS = [
        { id: 'first_win', name: 'First Victory', desc: 'Win your first game' },
        { id: 'win_5', name: 'On a Roll', desc: 'Win 5 games' },
        { id: 'win_10', name: 'Tic Tac Pro', desc: 'Win 10 games' },
        { id: 'win_25', name: 'Legendary', desc: 'Win 25 games' },
        { id: 'win_50', name: 'Master', desc: 'Win 50 games' },
        { id: 'streak_3', name: 'Three-peat', desc: 'Win 3 in a row' },
        { id: 'streak_5', name: 'Unstoppable', desc: 'Win 5 in a row' },
        { id: 'first_draw', name: 'Stalemate', desc: 'Draw your first game' },
        { id: 'impossible_win', name: 'Impossible Conqueror', desc: 'Beat Impossible difficulty' },
    ];

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    const homeScreen = $('#homeScreen');
    const difficultyScreen = $('#difficultyScreen');
    const gameScreen = $('#gameScreen');

    const singleplayerBtn = $('#singleplayerBtn');
    const multiplayerBtn = $('#multiplayerBtn');
    const earnBtnHome = $('#earnBtnHome');
    const profileBtnHome = $('#profileBtnHome');
    const shopBtnHome = $('#shopBtnHome');
    const achievementsBtnHome = $('#achievementsBtnHome');
    const settingsBtnHome = $('#settingsBtnHome');
    const homeRankDisplay = $('#homeRankDisplay');
    const homeAdToken = $('#homeAdToken');
    const homeDebree = $('#homeDebree');

    const diffCards = $$('.diff-card');
    const diffBackBtn = $('#diffBackBtn');

    const cells = $$('.cell');
    const statusText = $('#statusText');
    const timerDisplay = $('#timerDisplay');
    const timerReward = $('#timerReward');
    const gameDiffDisplay = $('#gameDiffDisplay');
    const gameRankDisplay = $('#gameRankDisplay');
    const newGameBtn = $('#newGameBtn');
    const gameHomeBtn = $('#gameHomeBtn');
    const earnBtnGame = $('#earnBtnGame');
    const profileBtnGame = $('#profileBtnGame');
    const shopBtnGame = $('#shopBtnGame');
    const achievementsBtnGame = $('#achievementsBtnGame');
    const settingsBtnGame = $('#settingsBtnGame');
    const symbolX = $('#symbolX');
    const symbolO = $('#symbolO');

    const winsDisplay = $('#winsDisplay');
    const lossesDisplay = $('#lossesDisplay');
    const drawsDisplay = $('#drawsDisplay');
    const streakDisplay = $('#streakDisplay');
    const totalDisplay = $('#totalDisplay');
    const rankDisplay = $('#rankDisplay');

    const gameAdToken = $('#gameAdToken');
    const gameDebree = $('#gameDebree');

    const profileModal = $('#profileModal');
    const shopModal = $('#shopModal');
    const settingsModal = $('#settingsModal');
    const achieveModal = $('#achieveModal');
    const multiModal = $('#multiModal');

    function saveState() {
        try {
            const data = {
                stats: state.stats,
                user: state.user,
                settings: state.settings,
                achievements: state.achievements,
                autoStartEnabled: state.autoStartEnabled,
            };
            localStorage.setItem('tictactoe_pro_data', JSON.stringify(data));
        } catch (_) {}
    }

    function loadState() {
        try {
            const raw = localStorage.getItem('tictactoe_pro_data');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.stats) Object.assign(state.stats, data.stats);
            if (data.user) Object.assign(state.user, data.user);
            if (data.settings) Object.assign(state.settings, data.settings);
            if (data.achievements) state.achievements = data.achievements;
            if (data.autoStartEnabled !== undefined) {
                state.autoStartEnabled = data.autoStartEnabled;
            }
            return true;
        } catch (_) { return false; }
    }

    function getRank() {
        const w = state.stats.rankedWins;
        let rank = RANKS[0];
        for (const r of RANKS) {
            if (w >= r.wins) rank = r;
        }
        return rank.name;
    }

    function getRankDisplay() {
        if (state.stats.rankedWins === 0) return '—';
        return getRank();
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function getDebreeReward(result, timeSeconds, difficulty) {
        const diff = DIFFICULTIES[difficulty];
        let base = 0;

        if (result === 'win') {
            if (timeSeconds < 45) base = 5;
            else if (timeSeconds <= 80) base = 3;
            else base = 1;
            base = Math.floor(base * diff.multiplier);
        } else if (result === 'draw') {
            base = 1;
        } else if (result === 'loss') {
            base = -1;
        }
        return base;
    }

    function getPotentialReward(timeSeconds, difficulty) {
        if (state.gameOver) return 0;
        const diff = DIFFICULTIES[difficulty];
        let base = 0;
        if (timeSeconds < 45) base = 5;
        else if (timeSeconds <= 80) base = 3;
        else base = 1;
        return Math.floor(base * diff.multiplier);
    }

    function isRankedDifficulty(diff) {
        return DIFFICULTIES[diff]?.ranked || false;
    }

    function showToast(msg) {
        const old = document.querySelector('.toast-msg');
        if (old) old.remove();
        const div = document.createElement('div');
        div.className = 'toast-msg';
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => { div.style.opacity = '0';
            div.style.transition = 'opacity 0.5s'; }, 3000);
        setTimeout(() => div.remove(), 3800);
    }

    function playSound(type) {
        if (!state.settings.sound) return;
        try {
            const ctx = new(window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);

            if (type === 'click') {
                osc.frequency.setValueAtTime(600, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
            } else if (type === 'win') {
                osc.frequency.setValueAtTime(523, ctx.currentTime);
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
            } else if (type === 'lose') {
                osc.frequency.setValueAtTime(400, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.25);
            } else if (type === 'draw') {
                osc.frequency.setValueAtTime(500, ctx.currentTime);
                osc.frequency.setValueAtTime(400, ctx.currentTime + 0.08);
                osc.frequency.setValueAtTime(500, ctx.currentTime + 0.16);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.22);
            }
        } catch (_) {}
    }

    function updateUI() {
        const s = state.stats;

        homeRankDisplay.innerHTML =
            `Rank: <span class="${state.stats.rankedWins === 0 ? 'dash' : ''}">${getRankDisplay()}</span>`;
        homeAdToken.textContent = state.user.adToken;
        homeDebree.textContent = state.user.debree;

        gameAdToken.textContent = state.user.adToken;
        gameDebree.textContent = state.user.debree;

        winsDisplay.textContent = s.wins;
        lossesDisplay.textContent = s.losses;
        drawsDisplay.textContent = s.draws;
        streakDisplay.textContent = s.streak;
        totalDisplay.textContent = s.total;
        rankDisplay.textContent = getRankDisplay();
        gameRankDisplay.innerHTML =
            `Rank: <span class="${state.stats.rankedWins === 0 ? 'dash' : ''}">${getRankDisplay()}</span>`;

        const diff = DIFFICULTIES[state.difficulty];
        gameDiffDisplay.textContent = `${diff.name} - ${diff.multiplier}x`;

        document.documentElement.style.setProperty('--accent', state.settings.boardColor);
        document.documentElement.style.setProperty('--accent-glow', state.settings.boardColor + '55');
        document.documentElement.style.setProperty('--accent-light', state.settings.boardColor + 'bb');

        saveState();
    }

    function toggleAutoStart() {
        state.autoStartEnabled = !state.autoStartEnabled;
        const btn = document.getElementById('autoStartToggle');
        if (btn) {
            btn.textContent = state.autoStartEnabled ? 'Auto-Start: ON' : 'Auto-Start: OFF';
            btn.classList.toggle('active', state.autoStartEnabled);
        }
        saveState();
    }

    function startTimer() {
        if (state.timerInterval) return;
        state.matchStartTime = Date.now();
        state.currentTime = 0;
        state.timerInterval = setInterval(() => {
            state.currentTime = (Date.now() - state.matchStartTime) / 1000;
            timerDisplay.textContent = formatTime(state.currentTime);
            if (!state.gameOver) {
                const potential = getPotentialReward(state.currentTime, state.difficulty);
                timerReward.innerHTML =
                    `Potential Reward: <span class="highlight">+${potential} Debree</span>`;
            }
        }, 100);
    }

    function stopTimer() {
        if (state.timerInterval) {
            clearInterval(state.timerInterval);
            state.timerInterval = null;
        }
    }

    function resetTimer() {
        stopTimer();
        state.matchStartTime = null;
        state.currentTime = 0;
        timerDisplay.textContent = '00:00';
        timerReward.innerHTML = `Potential Reward: <span class="highlight">+0 Debree</span>`;
    }

    function checkWinner(board) {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        for (const [a, b, c] of lines) {
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line: [a, b, c] };
            }
        }
        if (board.every(c => c !== null)) return { winner: 'draw', line: null };
        return { winner: null, line: null };
    }

    function getEmptyCells(board) {
        return board.map((v, i) => v === null ? i : null).filter(v => v !== null);
    }

    function minimax(board, depth, isMaximizing, aiSymbol, difficulty) {
        const humanSymbol = aiSymbol === 'X' ? 'O' : 'X';
        const result = checkWinner(board);

        if (result.winner === aiSymbol) {
            if (difficulty === 'impossible') return 1000 - depth;
            return 100 - depth;
        }
        if (result.winner === humanSymbol) return depth - 100;
        if (result.winner === 'draw') {
            if (difficulty === 'impossible') return -10;
            return 0;
        }

        const empty = getEmptyCells(board);
        if (isMaximizing) {
            let best = -Infinity;
            for (const idx of empty) {
                board[idx] = aiSymbol;
                const score = minimax(board, depth + 1, false, aiSymbol, difficulty);
                board[idx] = null;
                best = Math.max(best, score);
            }
            return best;
        } else {
            let best = Infinity;
            for (const idx of empty) {
                board[idx] = humanSymbol;
                const score = minimax(board, depth + 1, true, aiSymbol, difficulty);
                board[idx] = null;
                best = Math.min(best, score);
            }
            return best;
        }
    }

    function getBestMove(board, aiSymbol, difficulty) {
        const empty = getEmptyCells(board);
        if (empty.length === 0) return null;

        const diff = DIFFICULTIES[difficulty];
        const accuracy = diff.accuracy;

        if (Math.random() * 100 > accuracy) {
            return empty[Math.floor(Math.random() * empty.length)];
        }

        let bestScore = -Infinity;
        let bestMove = empty[0];
        for (const idx of empty) {
            board[idx] = aiSymbol;
            const score = minimax(board, 0, false, aiSymbol, difficulty);
            board[idx] = null;
            if (score > bestScore) {
                bestScore = score;
                bestMove = idx;
            }
        }
        return bestMove;
    }

    function renderBoard() {
        for (let i = 0; i < 9; i++) {
            const cell = cells[i];
            const val = state.board[i];
            cell.textContent = val || '';
            cell.className = 'cell';
            if (val) {
                cell.classList.add('taken');
                if (val === 'X') {
                    cell.innerHTML = `<span class="x-marker">X</span>`;
                } else {
                    cell.innerHTML = `<span class="o-marker">O</span>`;
                }
                if (state.settings.animations) {
                    cell.classList.add('pop-in');
                }
            } else {
                cell.textContent = '';
                cell.innerHTML = '';
            }
        }
    }

    function updateStatus() {
        if (state.gameOver) return;
        const player = state.currentPlayer;
        const symbol = player;
        const label = player === state.settings.playerSymbol ? 'Your' : 'Your Processor\'s';
        const color = player === state.settings.playerSymbol ? 'highlight' : 'highlight';
        statusText.innerHTML = `${label} turn <span class="${color}">(${symbol})</span>`;
    }

    function aiTurn() {
        if (state.gameOver) return;
        if (state.currentPlayer !== state.processorSymbol) return;

        const aiSymbol = state.processorSymbol;
        const idx = getBestMove(state.board, aiSymbol, state.difficulty);
        if (idx === null) return;

        state.board[idx] = aiSymbol;
        renderBoard();

        const result = checkWinner(state.board);
        if (result.winner) {
            state.gameOver = true;
            state.gameCompleted = true;
            handleGameEnd(result, aiSymbol);
            return;
        }

        state.currentPlayer = state.settings.playerSymbol;
        updateStatus();
        saveState();
    }

    function handleGameEnd(result, lastPlayer) {
        stopTimer();

        const s = state.stats;
        const isWin = result.winner === state.settings.playerSymbol;
        const isLoss = result.winner === state.processorSymbol;
        const isDraw = result.winner === 'draw';

        if (result.line) {
            for (const idx of result.line) {
                const cell = cells[idx];
                if (isWin) cell.classList.add('win-cell');
                else if (isLoss) cell.classList.add('lose-cell');
            }
        } else if (isDraw) {
            for (const cell of cells) {
                if (cell.textContent) cell.classList.add('draw-cell');
            }
        }

        const timeSeconds = state.currentTime;
        let resultType = isWin ? 'win' : (isLoss ? 'loss' : 'draw');
        let debreeEarned = getDebreeReward(resultType, timeSeconds, state.difficulty);

        if (state.user.debree + debreeEarned < 0) {
            debreeEarned = -state.user.debree;
        }

        state.user.debree += debreeEarned;

        s.total += 1;
        if (isWin) {
            s.wins += 1;
            s.streak += 1;
            if (isRankedDifficulty(state.difficulty)) {
                s.rankedWins += 1;
            }
            playSound('win');
            if (state.difficulty === 'impossible') {
                if (!state.achievements.includes('impossible_win')) {
                    state.achievements.push('impossible_win');
                    showToast('Achievement unlocked: Impossible Conqueror');
                }
            }
        } else if (isLoss) {
            s.losses += 1;
            s.streak = 0;
            playSound('lose');
        } else if (isDraw) {
            s.draws += 1;
            playSound('draw');
        }

        checkAchievements();

        let statusMsg = '';
        if (isWin) {
            statusMsg = `You win! +${debreeEarned} Debree`;
        } else if (isLoss) {
            statusMsg = `Your Processor wins! ${debreeEarned < 0 ? debreeEarned : '+0'} Debree`;
        } else if (isDraw) {
            statusMsg = `Draw! +${debreeEarned} Debree`;
        }
        statusText.innerHTML = statusMsg;
        timerReward.innerHTML =
            `Earned: <span class="highlight">${debreeEarned >= 0 ? '+' : ''}${debreeEarned} Debree</span>`;

        updateUI();
        saveState();

        // Clear any existing auto-start timeout
        if (state.autoStartTimeout) {
            clearTimeout(state.autoStartTimeout);
            state.autoStartTimeout = null;
        }

        // AUTO START - Now stored so it can be cleared
        if (state.autoStartEnabled) {
            state.autoStartTimeout = setTimeout(() => {
                if (!state.gameOver && !state.gameCompleted) return;
                resetBoard();
                playSound('click');
                showToast('Auto-starting new game...');
            }, 70);
        }
    }

    function resetBoard() {
        state.board = Array(9).fill(null);
        state.gameOver = false;
        state.gameCompleted = false;
        state.currentPlayer = state.settings.playerSymbol;
        state.processorSymbol = state.settings.playerSymbol === 'X' ? 'O' : 'X';
        resetTimer();
        renderBoard();
        for (const cell of cells) {
            cell.className = 'cell';
            cell.textContent = '';
            cell.innerHTML = '';
        }
        updateStatus();
        timerReward.innerHTML = `Potential Reward: <span class="highlight">+0 Debree</span>`;
        updateSymbolSelector();
        saveState();
    }

    function startGame(difficulty) {
        state.difficulty = difficulty;
        state.currentPlayer = state.settings.playerSymbol;
        state.processorSymbol = state.settings.playerSymbol === 'X' ? 'O' : 'X';
        state.gameOver = false;
        state.gameCompleted = false;
        resetBoard();
        showScreen('game');
        updateUI();
    }

    function updateSymbolSelector() {
        const symbol = state.settings.playerSymbol;
        symbolX.classList.toggle('active', symbol === 'X');
        symbolO.classList.toggle('active', symbol === 'O');
    }

    function setPlayerSymbol(symbol) {
        state.settings.playerSymbol = symbol;
        state.currentPlayer = symbol;
        state.processorSymbol = symbol === 'X' ? 'O' : 'X';
        updateSymbolSelector();
        updateUI();
        saveState();
        if (state.screen === 'game') {
            resetBoard();
        }
    }

    function checkAchievements() {
        let unlocked = [];
        for (const ach of ACHIEVEMENTS) {
            if (state.achievements.includes(ach.id)) continue;
            let condition = false;
            switch (ach.id) {
                case 'first_win':
                    condition = state.stats.wins >= 1;
                    break;
                case 'win_5':
                    condition = state.stats.wins >= 5;
                    break;
                case 'win_10':
                    condition = state.stats.wins >= 10;
                    break;
                case 'win_25':
                    condition = state.stats.wins >= 25;
                    break;
                case 'win_50':
                    condition = state.stats.wins >= 50;
                    break;
                case 'streak_3':
                    condition = state.stats.streak >= 3;
                    break;
                case 'streak_5':
                    condition = state.stats.streak >= 5;
                    break;
                case 'first_draw':
                    condition = state.stats.draws >= 1;
                    break;
                case 'impossible_win':
                    break;
            }
            if (condition) {
                state.achievements.push(ach.id);
                unlocked.push(ach);
            }
        }
        if (unlocked.length > 0) {
            const names = unlocked.map(a => a.name).join(', ');
            showToast(`Achievement unlocked: ${names}`);
            playSound('win');
        }
        return unlocked;
    }

    function showScreen(screen) {
        homeScreen.classList.remove('active');
        difficultyScreen.classList.remove('active');
        gameScreen.classList.remove('active');

        if (screen === 'home') {
            homeScreen.classList.add('active');
            state.screen = 'home';
            updateUI();
        } else if (screen === 'difficulty') {
            difficultyScreen.classList.add('active');
            state.screen = 'difficulty';
            updateDifficultyUI();
        } else if (screen === 'game') {
            gameScreen.classList.add('active');
            state.screen = 'game';
            updateUI();
            resetBoard();
        }
    }

    function updateDifficultyUI() {
        const debree = state.user.debree;
        diffCards.forEach(card => {
            const diff = card.dataset.diff;
            const isLocked = debree === 0 && diff !== 'hard' && diff !== 'impossible';
            card.classList.toggle('locked', isLocked);

            const oldLocked = card.querySelector('.diff-locked-text');
            if (oldLocked) oldLocked.remove();

            if (isLocked) {
                const lockedText = document.createElement('span');
                lockedText.className = 'diff-locked-text';
                lockedText.textContent = 'Locked (0 Debree)';
                card.querySelector('.diff-right').appendChild(lockedText);
            }
        });
    }

    function goHome() {
        // Clear auto-start timeout if active
        if (state.autoStartTimeout) {
            clearTimeout(state.autoStartTimeout);
            state.autoStartTimeout = null;
        }

        if (state.screen === 'game' && !state.gameCompleted && state.matchStartTime) {
            showToast('Game incomplete - no reward earned');
            resetBoard();
        }
        if (state.timerInterval) stopTimer();
        showScreen('home');
    }

    // EVENT LISTENERS
    singleplayerBtn.addEventListener('click', () => {
        if (state.user.debree === 0) {
            state.difficulty = 'hard';
            startGame('hard');
            showToast('Hard mode auto-selected (0 Debree)');
        } else {
            showScreen('difficulty');
        }
    });

    multiplayerBtn.addEventListener('click', () => {
        multiModal.classList.add('open');
    });

    // ===== GOOGLE ADMOB REWARDED AD SETUP =====
    const ADMOB_AD_UNIT_ID = 'ca-app-pub-2255556353397828/2342090869';
    let rewardedAd = null;

    // Function to load AdMob rewarded ad
    function loadAdMobRewardedAd() {
        if (typeof google !== 'undefined' && google.ima && google.ima.AdDisplayContainer) {
            showToast('Loading rewarded ad...');
            return true;
        }
        return false;
    }

    // Grant reward to user
    function grantAdReward() {
        state.user.adToken += 1;
        updateUI();
        saveState();
        showToast('+1 Ad Token earned!');
        playSound('click');
    }

    // Main reward button click handler
    [earnBtnHome, earnBtnGame].forEach(btn => {
        btn.addEventListener('click', () => {
            const adMobLoaded = loadAdMobRewardedAd();
            setTimeout(() => {
                grantAdReward();
            }, 15000);
        });
    });

    [profileBtnHome, profileBtnGame].forEach(btn => {
        btn.addEventListener('click', openProfile);
    });

    function openProfile() {
        document.getElementById('profileUsername').value = state.user.username || 'Guest';
        document.getElementById('pWins').textContent = state.stats.wins;
        document.getElementById('pLosses').textContent = state.stats.losses;
        document.getElementById('pDraws').textContent = state.stats.draws;
        document.getElementById('pStreak').textContent = state.stats.streak;
        document.getElementById('pTotal').textContent = state.stats.total;
        document.getElementById('pRank').textContent = getRankDisplay();
        document.getElementById('pAdToken').textContent = state.user.adToken;
        document.getElementById('pDebree').textContent = state.user.debree;
        profileModal.classList.add('open');
    }

    document.getElementById('profileSaveBtn').addEventListener('click', () => {
        const input = document.getElementById('profileUsername');
        const name = input.value.trim() || 'Guest';
        state.user.username = name;
        updateUI();
        saveState();
        profileModal.classList.remove('open');
        showToast(`Profile updated: ${name}`);
    });

    document.getElementById('profileGuestBtn').addEventListener('click', () => {
        state.user.username = 'Guest';
        updateUI();
        saveState();
        profileModal.classList.remove('open');
        showToast('Playing as Guest');
    });

    [shopBtnHome, shopBtnGame].forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('shopAdToken').textContent = state.user.adToken;
            shopModal.classList.add('open');
        });
    });

    document.getElementById('shopBuy1').addEventListener('click', () => {
        if (state.user.adToken >= 5) {
            state.user.adToken -= 5;
            state.user.debree += 20;
            updateUI();
            saveState();
            document.getElementById('shopAdToken').textContent = state.user.adToken;
            showToast('Purchased 20 Debree for 5 Ad Tokens');
            playSound('click');
        } else {
            showToast('Not enough Ad Tokens');
        }
    });

    document.getElementById('shopBuy2').addEventListener('click', () => {
        if (state.user.adToken >= 10) {
            state.user.adToken -= 10;
            state.user.debree += 40;
            updateUI();
            saveState();
            document.getElementById('shopAdToken').textContent = state.user.adToken;
            showToast('Purchased 40 Debree for 10 Ad Tokens');
            playSound('click');
        } else {
            showToast('Not enough Ad Tokens');
        }
    });

    [achievementsBtnHome, achievementsBtnGame].forEach(btn => {
        btn.addEventListener('click', openAchievements);
    });

    function openAchievements() {
        const list = document.getElementById('achievementList');
        list.innerHTML = '';
        for (const ach of ACHIEVEMENTS) {
            const unlocked = state.achievements.includes(ach.id);
            const div = document.createElement('div');
            div.className = `achieve-item ${unlocked ? 'unlocked' : ''}`;
            div.innerHTML = `
                <div>
                    <div class="name">${ach.name}</div>
                    <div class="desc">${ach.desc}</div>
                </div>
                <div class="status ${unlocked ? 'unlocked' : 'locked'}">${unlocked ? 'Unlocked' : 'Locked'}</div>
            `;
            list.appendChild(div);
        }
        achieveModal.classList.add('open');
    }

    [settingsBtnHome, settingsBtnGame].forEach(btn => {
        btn.addEventListener('click', openSettings);
    });

    function openSettings() {
        const soundToggle = document.getElementById('soundToggle');
        soundToggle.classList.toggle('active', state.settings.sound);
        const animToggle = document.getElementById('animToggle');
        animToggle.classList.toggle('active', state.settings.animations);
        document.getElementById('boardColorPicker').value = state.settings.boardColor;

        const settingX = document.getElementById('settingSymbolX');
        const settingO = document.getElementById('settingSymbolO');
        settingX.classList.toggle('active', state.settings.playerSymbol === 'X');
        settingO.classList.toggle('active', state.settings.playerSymbol === 'O');

        settingsModal.classList.add('open');
    }

    document.getElementById('soundToggle').addEventListener('click', function() {
        state.settings.sound = !state.settings.sound;
        this.classList.toggle('active', state.settings.sound);
        saveState();
    });

    document.getElementById('animToggle').addEventListener('click', function() {
        state.settings.animations = !state.settings.animations;
        this.classList.toggle('active', state.settings.animations);
        saveState();
    });

    document.getElementById('boardColorPicker').addEventListener('input', function() {
        state.settings.boardColor = this.value;
        saveState();
        updateUI();
    });

    document.getElementById('settingSymbolX').addEventListener('click', function() {
        setPlayerSymbol('X');
        document.getElementById('settingSymbolX').classList.add('active');
        document.getElementById('settingSymbolO').classList.remove('active');
    });

    document.getElementById('settingSymbolO').addEventListener('click', function() {
        setPlayerSymbol('O');
        document.getElementById('settingSymbolO').classList.add('active');
        document.getElementById('settingSymbolX').classList.remove('active');
    });

    symbolX.addEventListener('click', function() {
        setPlayerSymbol('X');
    });

    symbolO.addEventListener('click', function() {
        setPlayerSymbol('O');
    });

    document.getElementById('resetAllDataBtn').addEventListener('click', () => {
        if (!confirm('Reset ALL data? This includes stats, currency, and settings.')) return;
        localStorage.removeItem('tictactoe_pro_data');
        state.stats = { wins: 0, losses: 0, draws: 0, streak: 0, total: 0, rankedWins: 0 };
        state.user = { username: 'Guest', adToken: 0, debree: 10 };
        state.settings = { sound: true, animations: true, boardColor: '#6366f1', playerSymbol: 'X' };
        state.achievements = [];
        state.board = Array(9).fill(null);
        state.gameOver = false;
        state.gameCompleted = false;
        state.currentPlayer = 'X';
        state.difficulty = 'hard';
        // Clear auto-start timeout
        if (state.autoStartTimeout) {
            clearTimeout(state.autoStartTimeout);
            state.autoStartTimeout = null;
        }
        resetTimer();
        renderBoard();
        updateStatus();
        updateUI();
        saveState();
        showToast('All data reset.');
        settingsModal.classList.remove('open');
        showScreen('home');
    });

    diffCards.forEach(card => {
        card.addEventListener('click', function() {
            if (this.classList.contains('locked')) return;
            const diff = this.dataset.diff;
            startGame(diff);
        });
    });

    diffBackBtn.addEventListener('click', () => showScreen('home'));
    gameHomeBtn.addEventListener('click', goHome);

    newGameBtn.addEventListener('click', () => {
        // Clear auto-start timeout if active
        if (state.autoStartTimeout) {
            clearTimeout(state.autoStartTimeout);
            state.autoStartTimeout = null;
        }

        if (!state.gameCompleted && state.matchStartTime) {
            showToast('Game incomplete - no reward');
        }
        resetBoard();
        playSound('click');
    });

    // Cell click handler
    cells.forEach(cell => {
        cell.addEventListener('click', function() {
            if (state.screen !== 'game') return;
            if (state.gameOver) return;
            if (state.currentPlayer !== state.settings.playerSymbol) return;
            const idx = parseInt(this.dataset.index);
            if (state.board[idx] !== null) return;

            const playerSymbol = state.settings.playerSymbol;
            state.board[idx] = playerSymbol;
            renderBoard();

            if (!state.matchStartTime) {
                startTimer();
            }

            const result = checkWinner(state.board);
            if (result.winner) {
                state.gameOver = true;
                state.gameCompleted = true;
                handleGameEnd(result, playerSymbol);
                playSound('click');
                return;
            }

            state.currentPlayer = state.processorSymbol;
            updateStatus();
            playSound('click');

            if (!state.gameOver && state.currentPlayer === state.processorSymbol) {
                setTimeout(() => {
                    aiTurn();
                }, 400);
            }

            saveState();
        });
    });

    $$('[data-close]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.dataset.close;
            document.getElementById(id).classList.remove('open');
        });
    });

    $$('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === this) this.classList.remove('open');
        });
    });

    function initParticles() {
        const canvas = document.getElementById('particles-canvas');
        const ctx = canvas.getContext('2d');
        let w, h;
        const particles = [];
        const count = 50;

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() { this.reset(); }
            reset() {
                this.x = Math.random() * w;
                this.y = Math.random() * h;
                this.size = Math.random() * 1.5 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.2;
                this.speedY = (Math.random() - 0.5) * 0.2;
                this.opacity = Math.random() * 0.3 + 0.05;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(99,102,241,${this.opacity})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < count; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, w, h);
            for (const p of particles) {
                p.update();
                p.draw();
            }
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(99,102,241,${0.04 * (1 - dist / 100)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    function init() {
        loadState();

        const autoBtn = document.getElementById('autoStartToggle');
        if (autoBtn) {
            autoBtn.textContent = state.autoStartEnabled ? 'Auto-Start: ON' : 'Auto-Start: OFF';
            autoBtn.classList.toggle('active', state.autoStartEnabled);
            autoBtn.addEventListener('click', toggleAutoStart);
        }

        if (!state.user.debree && state.user.debree !== 0) state.user.debree = 10;
        if (!state.user.adToken && state.user.adToken !== 0) state.user.adToken = 0;
        if (!state.difficulty) state.difficulty = 'hard';
        if (!state.settings.playerSymbol) state.settings.playerSymbol = 'X';

        state.currentPlayer = state.settings.playerSymbol;
        state.processorSymbol = state.settings.playerSymbol === 'X' ? 'O' : 'X';

        updateUI();
        resetBoard();
        showScreen('home');
        initParticles();

        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                if (state.screen === 'game' && !document.querySelector('.modal-overlay.open')) {
                    if (!state.gameCompleted && state.matchStartTime) {
                        showToast('Game incomplete - no reward');
                    }
                    resetBoard();
                }
            }
        });

        console.log('Tic Tac Toe Pro v1.0 loaded!');
        console.log(`User: ${state.user.username}`);
        console.log(`Ad Token: ${state.user.adToken}, Debree: ${state.user.debree}`);
        console.log(`Difficulty: ${state.difficulty}`);
        console.log(`Player Symbol: ${state.settings.playerSymbol}`);
        console.log(`Processor Symbol: ${state.processorSymbol}`);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
