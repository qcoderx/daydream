document.addEventListener('DOMContentLoaded', () => {
    const BOARD_SIZE = 11;
    const gameBoard = document.getElementById('game-board');
    const lifebloodEl = document.getElementById('lifeblood');
    const hopeEl = document.getElementById('hope');
    const roundEl = document.getElementById('round');

    const modal = document.getElementById('modal-container');
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    const sacrificeInfo = document.getElementById('sacrifice-info');
    const gainLifebloodEl = document.getElementById('gain-lifeblood');
    const loseHopeEl = document.getElementById('lose-hope');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    const gameOverModal = document.getElementById('game-over-modal');
    const gameOverTitle = document.getElementById('game-over-title');
    const gameOverText = document.getElementById('game-over-text');
    
    const purifyBtn = document.getElementById('action-purify');
    const bindBtn = document.getElementById('action-bind');
    const endTurnBtn = document.getElementById('end-turn-btn');
    const restartBtn = document.getElementById('restart-btn');

    let gameState;
    let purifyMode = false;
    let selectedBuildingForSacrifice = null;

    const buildingTypes = {
        house: { name: 'House', lifeblood: 15, hopeCost: 10 },
        granary: { name: 'Granary', lifeblood: 25, hopeCost: 15 },
        watchtower: { name: 'Watchtower', lifeblood: 40, hopeCost: 25 }
    };
    
    function initGame() {
        gameState = {
            lifeblood: 20,
            hope: 100,
            round: 1,
            isBindingActive: false,
            grid: [],
            buildings: new Map()
        };
        purifyMode = false;
        document.body.classList.remove('purify-mode');
        gameOverModal.classList.add('hidden');
        setupBoard();
        updateUI();
    }

    function setupBoard() {
        gameBoard.innerHTML = '';
        gameState.grid = [];
        const center = Math.floor(BOARD_SIZE / 2);

        for (let r = 0; r < BOARD_SIZE; r++) {
            gameState.grid[r] = [];
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.classList.add('grid-cell');
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                const id = `${r}-${c}`;
                let cellState = { id, r, c, isCorrupted: false, building: null };

                if (r === center && c === center) {
                    cell.classList.add('heartwood');
                    cellState.isHeartwood = true;
                } else {
                    const isEdge = r === 0 || r === BOARD_SIZE - 1 || c === 0 || c === BOARD_SIZE - 1;
                    if (isEdge) {
                        cell.classList.add('corrupted');
                        cellState.isCorrupted = true;
                    }
                }
                
                gameState.grid[r][c] = cellState;
                gameBoard.appendChild(cell);
            }
        }
        placeInitialBuildings();
        addCellListeners();
    }

    function placeInitialBuildings() {
        const center = Math.floor(BOARD_SIZE / 2);
        const buildingPositions = [
            { r: center - 1, c: center, type: 'house' },
            { r: center + 1, c: center, type: 'house' },
            { r: center, c: center - 1, type: 'house' },
            { r: center, c: center + 1, type: 'granary' },
            { r: center - 2, c: center - 2, type: 'watchtower' }
        ];

        buildingPositions.forEach(pos => {
            addBuilding(pos.r, pos.c, pos.type);
        });
    }

    function addBuilding(r, c, type) {
        if (gameState.grid[r][c] && !gameState.grid[r][c].building) {
            const building = { type, ...buildingTypes[type] };
            const id = `${r}-${c}`;
            gameState.grid[r][c].building = building;
            gameState.buildings.set(id, building);
            
            const cellEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);
            cellEl.classList.add('building', type);
        }
    }
    
    function updateUI() {
        lifebloodEl.textContent = gameState.lifeblood;
        hopeEl.textContent = gameState.hope;
        roundEl.textContent = `${gameState.round} / 10`;

        purifyBtn.disabled = gameState.lifeblood < 10 || purifyMode;
        bindBtn.disabled = gameState.lifeblood < 30 || gameState.isBindingActive;
        endTurnBtn.disabled = purifyMode;

        if (gameState.isBindingActive) {
            bindBtn.textContent = 'Binding Active';
        } else {
            bindBtn.textContent = `Roots of Binding (30 Lifeblood)`;
        }
        if (purifyMode) {
            purifyBtn.textContent = 'Select a tile to purify...';
        } else {
            purifyBtn.textContent = `Purifying Light (10 Lifeblood)`;
        }
    }
    
    function handleCellClick(e) {
        const cellEl = e.target;
        const { r, c } = cellEl.dataset;
        const rNum = parseInt(r);
        const cNum = parseInt(c);
        const cellState = gameState.grid[rNum][cNum];

        if (purifyMode) {
            if (cellState.isCorrupted) {
                purifyTile(rNum, cNum);
            }
        } else {
            if (cellState.building) {
                promptSacrifice(rNum, cNum, cellState.building);
            }
        }
    }
    
    function promptSacrifice(r, c, building) {
        selectedBuildingForSacrifice = { r, c, building };
        modal.classList.remove('hidden');
        sacrificeInfo.classList.remove('hidden');
        modalTitle.textContent = `Sacrifice the ${building.name}?`;
        modalText.textContent = "This action is permanent. The building will be destroyed to fuel the Heartwood's power.";
        gainLifebloodEl.textContent = building.lifeblood;
        loseHopeEl.textContent = building.hopeCost;
        confirmBtn.textContent = "Sacrifice";
    }

    function executeSacrifice() {
        const { r, c, building } = selectedBuildingForSacrifice;
        
        gameState.lifeblood += building.lifeblood;
        gameState.hope -= building.hopeCost;
        
        const id = `${r}-${c}`;
        gameState.grid[r][c].building = null;
        gameState.buildings.delete(id);
        
        const cellEl = document.querySelector(`[data-r='${r}'][data-c='${c}']`);
        cellEl.classList.remove('building', building.type);
        
        closeModal();
        updateUI();
        checkLossConditions();
    }
    
    function closeModal() {
        modal.classList.add('hidden');
        selectedBuildingForSacrifice = null;
    }

    function startNextRound() {
        gameState.round++;
        spreadCorruption();
        
        if (gameState.round > 10) {
            endGame(true, "The Corruption recedes. You have protected the Heartwood and saved what remains of your village!");
            return;
        }

        if(gameState.round > 3 && gameState.buildings.size < 5) {
            // Add a new small building if player is low
            placeRandomBuilding('house');
        }

        gameState.isBindingActive = false; // Binding only lasts one round
        gameState.hope = Math.min(100, gameState.hope + 5); // Small hope recovery
        updateUI();
        checkLossConditions();
    }
    
    function placeRandomBuilding(type) {
        const emptyCells = [];
        for (let r = 1; r < BOARD_SIZE - 1; r++) {
            for (let c = 1; c < BOARD_SIZE - 1; c++) {
                const cell = gameState.grid[r][c];
                if (!cell.building && !cell.isCorrupted && !cell.isHeartwood) {
                    emptyCells.push({r, c});
                }
            }
        }
        if(emptyCells.length > 0) {
            const {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            addBuilding(r, c, type);
        }
    }

    function spreadCorruption() {
        if (gameState.isBindingActive) {
            return; // Skip spread this round
        }
        const newCorrupted = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (gameState.grid[r][c].isCorrupted) {
                    const neighbors = getNeighbors(r, c);
                    neighbors.forEach(n => {
                        if (!gameState.grid[n.r][n.c].isCorrupted) {
                            newCorrupted.push(n);
                        }
                    });
                }
            }
        }
        newCorrupted.forEach(n => {
            gameState.grid[n.r][n.c].isCorrupted = true;
            document.querySelector(`[data-r='${n.r}'][data-c='${n.c}']`).classList.add('corrupted');
        });
    }

    function getNeighbors(r, c) {
        const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
                    neighbors.push({ r: nr, c: nc });
                }
            }
        }
        return neighbors;
    }

    function togglePurifyMode() {
        if (gameState.lifeblood >= 10) {
            purifyMode = !purifyMode;
            document.body.classList.toggle('purify-mode');
            updateUI();
        }
    }

    function purifyTile(r, c) {
        gameState.lifeblood -= 10;
        gameState.grid[r][c].isCorrupted = false;
        document.querySelector(`[data-r='${r}'][data-c='${c}']`).classList.remove('corrupted');
        
        purifyMode = false;
        document.body.classList.remove('purify-mode');
        updateUI();
    }
    
    function useBinding() {
        if (gameState.lifeblood >= 30 && !gameState.isBindingActive) {
            gameState.lifeblood -= 30;
            gameState.isBindingActive = true;
            updateUI();
        }
    }
    
    function checkLossConditions() {
        if (gameState.hope <= 0) {
            endGame(false, "The villagers lost all hope. The will to fight is gone, and the Corruption consumes all.");
            return true;
        }
        const center = Math.floor(BOARD_SIZE / 2);
        if (gameState.grid[center][center].isCorrupted) {
            endGame(false, "The Corruption has reached the Heartwood. Its light is extinguished forever.");
            return true;
        }
        return false;
    }
    
    function endGame(isWin, message) {
        gameOverModal.classList.remove('hidden');
        gameOverTitle.textContent = isWin ? "Victory!" : "Game Over";
        gameOverText.textContent = message;
    }

    function addCellListeners() {
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', handleCellClick);
        });
    }

    // Event Listeners
    confirmBtn.addEventListener('click', executeSacrifice);
    cancelBtn.addEventListener('click', closeModal);
    endTurnBtn.addEventListener('click', startNextRound);
    purifyBtn.addEventListener('click', togglePurifyMode);
    bindBtn.addEventListener('click', useBinding);
    restartBtn.addEventListener('click', initGame);

    // Start the game
    initGame();
});