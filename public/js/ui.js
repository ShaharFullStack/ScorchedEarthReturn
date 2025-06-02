import { SoundSettings } from './soundSettings.js';

export class UI {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.turnIndicator = document.getElementById('turn-indicator');
        this.fuelIndicator = document.getElementById('fuel-indicator');
        this.healthIndicator = document.getElementById('health-indicator');
        this.actionIndicator = document.getElementById('action-indicator'); 
        this.powerIndicator = document.getElementById('power-indicator');
        this.endTurnButton = document.getElementById('end-turn-button');
        this.messageOverlay = document.getElementById('message-overlay');

        // References to profile UI elements
        this.profileAvatar = document.getElementById('profile-avatar');
        this.profileName = document.getElementById('profile-name');
        this.turnStatusLight = document.getElementById('turn-status-light');

        this.playerName = '';

        this.setupDifficultySelector();
        this.setupSoundSettings();
    }

    setPlayerName(name) {
        this.playerName = name;
    }
    getPlayerName() {
        return this.playerName;
    }

    setupDifficultySelector() {
        // Create difficulty selection overlay
        this.difficultyOverlay = document.createElement('div');
        this.difficultyOverlay.id = 'difficulty-overlay';
        this.difficultyOverlay.innerHTML = `
            <div class="difficulty-content">
                <h2>Select Difficulty Level</h2>
                <div class="difficulty-options">
                    <button class="difficulty-btn" data-difficulty="sargent">
                        <h3>🟢 Sargent</h3>
                        <p>• Slower enemy reactions</p>
                        <p>• Less accurate shooting</p>
                        <p>• More forgiving mechanics</p>
                        <p>• Perfect for learning!</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="lieutenant">
                        <h3>🟡 Lieutenant</h3>
                        <p>• Balanced challenge</p>
                        <p>• Smart enemy tactics</p>
                        <p>• Strategic positioning</p>
                        <p>• Standard experience</p>
                    </button>
                    <button class="difficulty-btn" data-difficulty="colonel">
                        <h3>🔴 Colonel</h3>
                        <p>• Lightning-fast AI</p>
                        <p>• Deadly accurate shots</p>
                        <p>• Advanced battle tactics</p>
                        <p>• Maximum challenge!</p>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.difficultyOverlay);

        // Initially hide it
        this.difficultyOverlay.style.display = 'none';
        // Add event listeners
        this.difficultyOverlay.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const difficulty = e.currentTarget.dataset.difficulty;

                // Play button click sound
                if (this.audioManager) {
                    this.audioManager.playSound('enterTank', 0.5);
                }

                this.onDifficultySelected(difficulty);
            });
        });
    }

    onDifficultySelected(difficulty) {
        this.selectedDifficulty = difficulty;

        // Add exit animation
        this.difficultyOverlay.style.transform = 'scale(0.95)';
        this.difficultyOverlay.style.opacity = '0';
        this.difficultyOverlay.style.transition = 'all 0.5s ease';

        setTimeout(() => {
            this.difficultyOverlay.style.display = 'none';

            // Trigger game start with selected difficulty
            if (this.onDifficultyChange) {
                this.onDifficultyChange(difficulty);
            }
        }, 500);
    }

    showDifficultySelector() {
        this.difficultyOverlay.style.display = 'flex';
        this.difficultyOverlay.style.transform = 'scale(1)';
        this.difficultyOverlay.style.opacity = '1';        
        this.difficultyOverlay.style.transition = 'all 0.5s ease';
    }

    setupSoundSettings() {
        // Create the sound settings instance
        this.soundSettings = new SoundSettings(this.audioManager);

        // Create settings button
        this.settingsButton = document.createElement('button');
        this.settingsButton.id = 'settings-button';
        this.settingsButton.innerHTML = '⚙️';
        this.settingsButton.className = 'ui-button settings-btn';
        this.settingsButton.title = 'Sound Settings';

        // Add settings button to the UI
        const gameContainer = document.getElementById('game-container') || document.body;
        gameContainer.appendChild(this.settingsButton);

        // Add click event listener
        this.settingsButton.addEventListener('click', () => {
            if (this.audioManager) {
                this.audioManager.playSound('enterTank', 0.3);
            }
            this.soundSettings.show();
        });
    }

    updateTurnIndicator(text) {
        this.turnIndicator.textContent = `${text}`;
        
        // Update the status light based on whose turn it is
        const statusLight = document.getElementById('turn-status-light');
        if (statusLight) {
            // Remove existing classes
            statusLight.classList.remove('player-turn', 'enemy-turn');
            
            // Determine if it's player turn or enemy turn
            const isPlayerTurn = text.toLowerCase().includes('player') || 
                                text.toLowerCase().includes(this.getPlayerName().toLowerCase());
            
            if (isPlayerTurn) {
                statusLight.classList.add('player-turn');
            } else {
                statusLight.classList.add('enemy-turn');
            }
        }
    } updateFuel(current, max) {
        // Use shorter format for mobile - just show current value
        this.fuelIndicator.textContent = `Fuel: ${Math.floor(current)}`;
    } updateHealth(tankId, current, max) {
        // Simplified format for mobile - just show HP value
        this.healthIndicator.textContent = `HP: ${current}`;
    }

    updateActionIndicator(text) {
        this.actionIndicator.textContent = `Actions: ${text}`;
    }
    updatePowerIndicator(current, min, max) {
        // Simplified format for mobile - just show current power
        this.powerIndicator.textContent = `Power: ${current}%`;
    }
    updateBarrelElevation(elevationRadians) {
        // Convert radians to degrees for display
        const elevationDegrees = Math.round(elevationRadians * 180 / Math.PI);

        // Find or create barrel elevation indicator
        let barrelIndicator = document.getElementById('barrel-indicator');
        if (!barrelIndicator) {
            barrelIndicator = document.createElement('p');
            barrelIndicator.id = 'barrel-indicator';
            barrelIndicator.style.margin = '5px 0';
            barrelIndicator.className = 'mobile-hidden'; // Hide on mobile for space
            // Insert after power indicator
            this.powerIndicator.parentNode.insertBefore(barrelIndicator, this.powerIndicator.nextSibling);
        }

        // Compact format for mobile - just show angle
        barrelIndicator.textContent = `Barrel: ${elevationDegrees}°`;
    }

    toggleEndTurnButton(enabled) {
        this.endTurnButton.disabled = !enabled;
    }

    showGameOverMessage(message) {
        // Create a stylish game over overlay
        this.messageOverlay.innerHTML = `
            <div class="game-over-container">
                <h2>Game Over</h2>
                <p>${message.replace('\n', '<br>')}</p>
                <div class="game-over-buttons">
                    <button id="restart-game-btn" class="btn">Play Again</button>
                    <button id="return-menu-btn" class="btn">Return to Menu</button>
                </div>
            </div>
        `;
        
        this.messageOverlay.style.display = 'flex';
        
        // Add event listeners to buttons
        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.hideGameOverMessage();
            // Reload the page to restart the game
            location.reload();
        });
        
        document.getElementById('return-menu-btn').addEventListener('click', () => {
            this.restartGame();
        });
    }

    hideGameOverMessage() {
        this.messageOverlay.style.display = 'none';
    }
    
    showMessage(message, duration = 3000) {
        // Create a temporary message that will auto-hide
        const tempMessage = document.createElement('div');
        tempMessage.className = 'temp-message';
        tempMessage.textContent = message;
        document.body.appendChild(tempMessage);
        
        // Show with animation
        setTimeout(() => {
            tempMessage.classList.add('visible');
        }, 10);
        
        // Auto-hide after duration
        setTimeout(() => {
            tempMessage.classList.remove('visible');
            setTimeout(() => {
                document.body.removeChild(tempMessage);
            }, 500); // Wait for fade-out animation
        }, duration);
    }
    
    restartGame() {
        // Hide any overlays
        this.hideGameOverMessage();
        
        // Show difficulty selector again to restart the game
        this.showDifficultySelector();
    }

    updateProfileDisplay(user) {
        if (this.profileName && user) {
            this.profileName.textContent = user.displayName || this.getPlayerName() || 'Guest';
        }
        
        if (this.profileAvatar && user && user.photoURL) {
            this.profileAvatar.src = user.photoURL;
        }
    }

    setTurnStatus(isPlayerTurn) {
        if (this.turnStatusLight) {
            this.turnStatusLight.classList.remove('player-turn', 'enemy-turn');
            this.turnStatusLight.classList.add(isPlayerTurn ? 'player-turn' : 'enemy-turn');
        }
    }
}