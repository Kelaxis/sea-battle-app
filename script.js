class SeaBattleGame {
    constructor() {
        this.api = new SeaBattleAPI();
        this.currentGame = null;
        this.selectedBet = 0;
        this.selectedShip = null;
        this.shipOrientation = 'horizontal';
        this.ships = [];
        this.myBoard = [];
        this.enemyBoard = [];
        this.isMyTurn = false;
        
        this.init();
    }

    async init() {
        try {
            // Инициализация Telegram Web App
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            
            // Загрузка баланса
            await this.loadBalance();
            
            // Показываем главное меню
            this.showScreen('main-menu');
            
            // Проверяем активную игру
            await this.checkActiveGame();
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Ошибка загрузки');
        }
    }

    async loadBalance() {
        try {
            const balanceData = await this.api.getBalance();
            document.getElementById('balance').textContent = `Баланс: ${balanceData.balance} FilmCoin`;
        } catch (error) {
            console.error('Balance loading error:', error);
        }
    }

    async checkActiveGame() {
        // Проверка активной игры (реализуйте по необходимости)
    }

    showScreen(screenId) {
        // Скрыть все экраны
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Показать нужный экран
        document.getElementById(screenId).classList.remove('hidden');
    }

    async selectBet(bet) {
        this.selectedBet = bet;
        
        // Проверка баланса
        const balanceData = await this.api.getBalance();
        if (bet > 0 && balanceData.balance < bet) {
            alert('Недостаточно FilmCoin');
            return;
        }

        // Загрузка списка игроков
        try {
            const players = await this.api.getPlayers();
            this.showOpponentsList(players);
        } catch (error) {
            console.error('Error loading players:', error);
            this.showError('Ошибка загрузки игроков');
        }
    }

    showOpponentsList(players) {
        const opponentsList = document.getElementById('opponents-list');
        opponentsList.innerHTML = '';
        
        players.forEach(player => {
            const button = document.createElement('button');
            button.className = 'opponent-btn';
            button.innerHTML = `
                <strong>${player.name}</strong>
                <br>
                <small>Уровень: ${player.level} | Баланс: ${player.balance}</small>
            `;
            button.onclick = () => this.selectOpponent(player.id);
            opponentsList.appendChild(button);
        });
        
        this.showScreen('opponent-select');
    }

    async selectOpponent(opponentId) {
        try {
            const game = await this.api.createGame(this.selectedBet, opponentId);
            this.currentGame = game;
            
            this.showScreen('waiting');
            this.startWaitingForOpponent();
            
        } catch (error) {
            console.error('Error creating game:', error);
            this.showError('Ошибка создания игры');
        }
    }

    async startWaitingForOpponent() {
        // Опрос статуса игры
        const checkInterval = setInterval(async () => {
            try {
                const status = await this.api.getGameStatus(this.currentGame.id);
                
                if (status.status === 'accepted') {
                    clearInterval(checkInterval);
                    this.startShipPlacement();
                } else if (status.status === 'cancelled') {
                    clearInterval(checkInterval);
                    alert('Игра отменена');
                    this.showScreen('main-menu');
                }
                
            } catch (error) {
                console.error('Error checking game status:', error);
            }
        }, 3000);
    }

    async cancelGame() {
        if (this.currentGame) {
            try {
                await this.api.cancelGame(this.currentGame.id);
                this.currentGame = null;
                this.showScreen('main-menu');
            } catch (error) {
                console.error('Error cancelling game:', error);
            }
        }
    }

    startShipPlacement() {
        this.initializeBoard();
        this.createPlacementBoard();
        this.showScreen('ship-placement');
    }

    initializeBoard() {
        this.myBoard = Array(10).fill().map(() => Array(10).fill(0));
        this.enemyBoard = Array(10).fill().map(() => Array(10).fill(0));
        this.ships = [
            { size: 4, count: 1, placed: 0 },
            { size: 3, count: 2, placed: 0 },
            { size: 2, count: 3, placed: 0 },
            { size: 1, count: 4, placed: 0 }
        ];
    }

    createPlacementBoard() {
        const board = document.getElementById('placement-board');
        board.innerHTML = '';
        
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                cell.addEventListener('click', () => this.placeShip(x, y));
                cell.addEventListener('mouseover', (e) => this.previewShip(x, y, e));
                
                board.appendChild(cell);
            }
        }
        
        this.updateShipsInfo();
    }

    placeShip(x, y) {
        if (!this.selectedShip) return;
        
        const shipSize = this.selectedShip;
        const positions = this.getShipPositions(x, y, shipSize, this.shipOrientation);
        
        if (!this.canPlaceShip(positions)) return;
        
        // Размещаем корабль
        positions.forEach(([px, py]) => {
            this.myBoard[py][px] = 2; // 2 = корабль
            const cell = document.querySelector(`.cell[data-x="${px}"][data-y="${py}"]`);
            cell.classList.add('ship');
        });
        
        // Обновляем счетчики кораблей
        const shipType = this.ships.find(s => s.size === shipSize);
        shipType.placed++;
        this.updateShipsInfo();
        
        this.selectedShip = null;
        this.checkReadyStatus();
    }

    canPlaceShip(positions) {
        return positions.every(([x, y]) => {
            if (x < 0 || x >= 10 || y < 0 || y >= 10) return false;
            if (this.myBoard[y][x] !== 0) return false;
            
            // Проверяем соседние клетки
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10) {
                        if (this.myBoard[ny][nx] === 2) return false;
                    }
                }
            }
            
            return true;
        });
    }

    getShipPositions(x, y, size, orientation) {
        const positions = [];
        for (let i = 0; i < size; i++) {
            if (orientation === 'horizontal') {
                positions.push([x + i, y]);
            } else {
                positions.push([x, y + i]);
            }
        }
        return positions;
    }

    rotateShip() {
        this.shipOrientation = this.shipOrientation === 'horizontal' ? 'vertical' : 'horizontal';
    }

    randomPlacement() {
        this.initializeBoard();
        
        const shipSizes = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
        
        shipSizes.forEach(size => {
            let placed = false;
            while (!placed) {
                const x = Math.floor(Math.random() * 10);
                const y = Math.floor(Math.random() * 10);
                const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';
                
                const positions = this.getShipPositions(x, y, size, orientation);
                
                if (this.canPlaceShip(positions)) {
                    positions.forEach(([px, py]) => {
                        this.myBoard[py][px] = 2;
                    });
                    placed = true;
                }
            }
        });
        
        this.createPlacementBoard();
        this.checkReadyStatus();
    }

    updateShipsInfo() {
        document.getElementById('ship4').textContent = this.ships[0].count - this.ships[0].placed;
        document.getElementById('ship3').textContent = this.ships[1].count - this.ships[1].placed;
        document.getElementById('ship2').textContent = this.ships[2].count - this.ships[2].placed;
        document.getElementById('ship1').textContent = this.ships[3].count - this.ships[3].placed;
    }

    checkReadyStatus() {
        const allShipsPlaced = this.ships.every(ship => ship.placed === ship.count);
        document.getElementById('ready-btn').disabled = !allShipsPlaced;
    }

    async readyForBattle() {
        try {
            // Отправляем расстановку кораблей
            await this.api.sendShips(this.currentGame.id, this.myBoard);
            
            // Ждем готовности противника
            this.waitForOpponentReady();
            
        } catch (error) {
            console.error('Error sending ships:', error);
            this.showError('Ошибка отправки данных');
        }
    }

    async waitForOpponentReady() {
        const checkInterval = setInterval(async () => {
            try {
                const status = await this.api.getGameStatus(this.currentGame.id);
                
                if (status.status === 'battle') {
                    clearInterval(checkInterval);
                    this.startBattle(status);
                }
                
            } catch (error) {
                console.error('Error checking battle status:', error);
            }
        }, 2000);
    }

    startBattle(gameStatus) {
        this.isMyTurn = gameStatus.current_turn === this.userId;
        this.createBattleBoards();
        this.showScreen('battle');
        this.updateBattleStatus();
    }

    createBattleBoards() {
        this.createBoard('my-board', this.myBoard, false);
        this.createBoard('enemy-board', this.enemyBoard, true);
    }

    createBoard(boardId, boardData, clickable) {
        const board = document.getElementById(boardId);
        board.innerHTML = '';
        
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                
                if (boardData[y][x] === 2) { // Корабль
                    cell.classList.add('ship');
                } else if (boardData[y][x] === 3) { // Попадание
                    cell.classList.add('hit');
                    cell.textContent = '💥';
                } else if (boardData[y][x] === 4) { // Промах
                    cell.classList.add('miss');
                    cell.textContent = '●';
                }
                
                if (clickable && this.isMyTurn && boardData[y][x] < 3) {
                    cell.addEventListener('click', () => this.makeMove(x, y));
                }
                
                board.appendChild(cell);
            }
        }
    }

    async makeMove(x, y) {
        if (!this.isMyTurn) return;
        
        try {
            const result = await this.api.makeMove(this.currentGame.id, x, y);
            
            if (result.hit) {
                this.enemyBoard[y][x] = 3; // Попадание
                if (result.sunk) {
                    // Помечаем потопленный корабль
                    this.markSunkShip(x, y);
                }
            } else {
                this.enemyBoard[y][x] = 4; // Промах
                this.isMyTurn = false;
            }
            
            this.createBattleBoards();
            this.updateBattleStatus();
            
            if (result.game_over) {
                this.endGame(true, result.prize);
            }
            
        } catch (error) {
            console.error('Error making move:', error);
            this.showError('Ошибка хода');
        }
    }

    updateBattleStatus() {
        const statusElement = document.getElementById('battle-status');
        const endTurnBtn = document.getElementById('end-turn-btn');
        
        if (this.isMyTurn) {
            statusElement.textContent = 'Ваш ход!';
            endTurnBtn.classList.remove('hidden');
        } else {
            statusElement.textContent = 'Ход противника...';
            endTurnBtn.classList.add('hidden');
            
            // Опрашиваем статус игры для получения хода противника
            this.waitForOpponentMove();
        }
    }

    async waitForOpponentMove() {
        const checkInterval = setInterval(async () => {
            if (this.isMyTurn) {
                clearInterval(checkInterval);
                return;
            }
            
            try {
                const status = await this.api.getGameStatus(this.currentGame.id);
                
                if (status.status === 'battle' && status.current_turn === this.userId) {
                    clearInterval(checkInterval);
                    this.processOpponentMove(status.last_move);
                } else if (status.status === 'finished') {
                    clearInterval(checkInterval);
                    this.endGame(false, 0);
                }
                
            } catch (error) {
                console.error('Error waiting for opponent:', error);
            }
        }, 3000);
    }

    processOpponentMove(move) {
        if (move && move.x !== undefined && move.y !== undefined) {
            if (move.hit) {
                this.myBoard[move.y][move.x] = 3; // Попадание
                if (move.sunk) {
                    this.markSunkShip(move.x, move.y, true);
                }
            } else {
                this.myBoard[move.y][move.x] = 4; // Промах
            }
            
            this.isMyTurn = true;
            this.createBattleBoards();
            this.updateBattleStatus();
            
            if (move.game_over) {
                this.endGame(false, 0);
            }
        }
    }

    endTurn() {
        this.isMyTurn = false;
        this.updateBattleStatus();
    }

    endGame(victory, prize) {
        const resultScreen = document.getElementById('game-over');
        const title = document.getElementById('result-title');
        const message = document.getElementById('result-message');
        const prizeInfo = document.getElementById('prize-info');
        
        if (victory) {
            title.textContent = '🎉 Победа!';
            message.textContent = 'Вы уничтожили все корабли противника!';
            prizeInfo.textContent = `Вы выиграли ${prize} FilmCoin!`;
        } else {
            title.textContent = '💥 Поражение';
            message.textContent = 'Все ваши корабли потоплены';
            prizeInfo.textContent = '';
        }
        
        this.showScreen('game-over');
    }

    backToMenu() {
        this.currentGame = null;
        this.showScreen('main-menu');
        this.loadBalance();
    }

    showError(message) {
        alert(message);
    }
}

// Инициализация игры при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.seaBattleGame = new SeaBattleGame();
});