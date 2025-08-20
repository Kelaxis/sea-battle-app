class SeaBattleAPI {
    constructor() {
        this.userId = new URLSearchParams(window.location.search).get('user_id');
        this.baseURL = 'https://your-bot-domain.com/api';
    }

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': this.userId,
                    ...options.headers
                },
                ...options
            });
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Получить список игроков
    async getPlayers() {
        return this.request('/sea-battle/players');
    }

    // Создать игру
    async createGame(bet, opponentId) {
        return this.request('/sea-battle/create', {
            method: 'POST',
            body: JSON.stringify({ bet, opponent_id: opponentId })
        });
    }

    // Отменить игру
    async cancelGame(gameId) {
        return this.request('/sea-battle/cancel', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId })
        });
    }

    // Отправить расстановку кораблей
    async sendShips(gameId, ships) {
        return this.request('/sea-battle/ships', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId, ships })
        });
    }

    // Сделать ход
    async makeMove(gameId, x, y) {
        return this.request('/sea-battle/move', {
            method: 'POST',
            body: JSON.stringify({ game_id: gameId, x, y })
        });
    }

    // Получить статус игры
    async getGameStatus(gameId) {
        return this.request(`/sea-battle/status/${gameId}`);
    }

    // Получить баланс пользователя
    async getBalance() {
        return this.request('/balance');
    }
}