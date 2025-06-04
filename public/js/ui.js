import { SoundSettings } from './soundSettings.js';

export class UI {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.turnIndicator = document.getElementById('turn-indicator');
        this.turnText = document.getElementById('turn-text');
        this.playerAvatarElement = document.getElementById('player-avatar');
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

        this.setupTurnIndicatorClick();
        this.setupDifficultySelector();
        this.setupSoundSettings();
    }

    setPlayerName(name) {
        this.playerName = name;
    }
    getPlayerName() {
        return this.playerName;
    }

    setupTurnIndicatorClick() {
        if (this.turnIndicator) {
            this.turnIndicator.addEventListener('click', () => {
                // Play click sound
                if (this.audioManager) {
                    this.audioManager.playSound('click', 0.5);
                }
                
                // Open user statistics page
                this.showUserStatistics();
            });
            
            // Add tooltip on hover
            this.turnIndicator.title = 'Click to view your battle statistics';
        }
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
    }    updateTurnIndicator(text) {
        if (this.turnText) {
            this.turnText.textContent = `${text}`;
        }
        
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
    }updateFuel(current, max) {
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
        // Parse the message to extract victory/defeat and difficulty
        const isVictory = message.includes('Victory');
        const difficultyMatch = message.match(/(\w+) Difficulty/);
        const difficulty = difficultyMatch ? difficultyMatch[1] : 'Unknown';
        
        // Create title based on outcome
        const title = isVictory ? '🏆 VICTORY! 🏆' : '💀 DEFEAT 💀';
        const resultClass = isVictory ? 'victory' : 'defeat';
        
        // Create a stylish game over overlay
        this.messageOverlay.innerHTML = `
            <div class="game-over-container ${resultClass}">
                <h2>${title}</h2>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <div class="game-over-buttons">
                    <button id="restart-game-btn" class="btn">
                        🔄 Play Again
                    </button>
                    <button id="return-menu-btn" class="btn">
                        🏠 Return to Menu
                    </button>
                </div>
            </div>
        `;
        
        // Show with smooth animation
        this.messageOverlay.style.display = 'flex';
        this.messageOverlay.classList.add('show');
        
        // Add event listeners to buttons
        document.getElementById('restart-game-btn').addEventListener('click', (e) => {
            // Play button sound if available
            if (this.audioManager) {
                this.audioManager.playSound('click', 0.7);
            }
            this.hideGameOverMessage();
            // Small delay for sound effect
            setTimeout(() => {
                location.reload();
            }, 200);
        });
        
        document.getElementById('return-menu-btn').addEventListener('click', (e) => {
            // Play button sound if available
            if (this.audioManager) {
                this.audioManager.playSound('click', 0.7);
            }
            setTimeout(() => {
                this.restartGame();
            }, 200);
        });
        
        // Add keyboard support for better accessibility
        const handleKeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                // Default to restart game
                document.getElementById('restart-game-btn').click();
            } else if (e.key === 'Escape') {
                // Return to menu
                document.getElementById('return-menu-btn').click();
            }
        };
        
        document.addEventListener('keydown', handleKeydown);
        
        // Store reference to remove listener later
        this._gameOverKeyHandler = handleKeydown;
    }

    hideGameOverMessage() {
        // Remove keyboard event listener
        if (this._gameOverKeyHandler) {
            document.removeEventListener('keydown', this._gameOverKeyHandler);
            this._gameOverKeyHandler = null;
        }
        
        // Add fade-out animation
        this.messageOverlay.classList.remove('show');
        
        // Hide after animation completes
        setTimeout(() => {
            this.messageOverlay.style.display = 'none';
            this.messageOverlay.innerHTML = ''; // Clean up
        }, 300);
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
    }    updateProfileDisplay(user) {
        if (this.profileName && user) {
            this.profileName.textContent = user.displayName || this.getPlayerName() || 'Guest';
        }
        
        if (this.profileAvatar && user && user.photoURL) {
            this.profileAvatar.src = user.photoURL;
        }
        
        // Update the turn indicator avatar
        if (this.playerAvatarElement && user && user.photoURL) {
            this.playerAvatarElement.src = user.photoURL;
            this.playerAvatarElement.style.display = 'block';
            this.playerAvatarElement.alt = user.displayName || 'Player';
        } else if (this.playerAvatarElement) {
            // Hide avatar if no user photo
            this.playerAvatarElement.style.display = 'none';
        }
    }

    setTurnStatus(isPlayerTurn) {
        if (this.turnStatusLight) {
            this.turnStatusLight.classList.remove('player-turn', 'enemy-turn');
            this.turnStatusLight.classList.add(isPlayerTurn ? 'player-turn' : 'enemy-turn');
        }
    }    // Enhanced User Statistics Page with Modern Design
    showUserStatistics() {
        // Get user data from auth manager
        const authManager = window.mainAppInstance?.authManager;
        const currentUser = authManager?.getCurrentUser();
        
        if (!currentUser) {
            console.warn('No user data available for statistics');
            return;
        }

        // Get user stats from localStorage or Firebase
        let userStats = this.getUserStats(currentUser.uid);

        // Create modal overlay with modern backdrop
        const modal = document.createElement('div');
        modal.id = 'user-stats-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, 
                rgba(15, 15, 25, 0.95) 0%, 
                rgba(25, 25, 40, 0.95) 50%, 
                rgba(35, 35, 55, 0.95) 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(15px);
            opacity: 0;
            transition: all 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            font-family: 'Orbitron', 'Rajdhani', monospace;
        `;

        // Create scrollable container
        const scrollContainer = document.createElement('div');
        scrollContainer.style.cssText = `
            max-height: 95vh;
            max-width: 900px;
            width: 95%;
            overflow-y: auto;
            overflow-x: hidden;
            padding-right: 10px;
            
            /* Custom scrollbar */
            scrollbar-width: thin;
            scrollbar-color: #4285F4 rgba(255,255,255,0.1);
        `;

        // Add custom scrollbar styles for webkit browsers
        const scrollbarStyles = document.createElement('style');
        scrollbarStyles.textContent = `
            #user-stats-modal div::-webkit-scrollbar {
                width: 8px;
            }
            #user-stats-modal div::-webkit-scrollbar-track {
                background: rgba(255,255,255,0.1);
                border-radius: 4px;
            }
            #user-stats-modal div::-webkit-scrollbar-thumb {
                background: linear-gradient(45deg, #4285F4, #34A853);
                border-radius: 4px;
            }
            #user-stats-modal div::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(45deg, #5A95FF, #4CBB17);
            }
        `;
        document.head.appendChild(scrollbarStyles);

        const content = document.createElement('div');
        content.style.cssText = `
            background: linear-gradient(135deg, 
                rgba(30, 35, 45, 0.98) 0%, 
                rgba(45, 50, 65, 0.98) 50%, 
                rgba(35, 40, 55, 0.98) 100%);
            border: 3px solid transparent;
            background-clip: padding-box;
            border-radius: 25px;
            padding: 30px;
            text-align: center;
            box-shadow: 
                0 25px 80px rgba(0, 0, 0, 0.8),
                0 0 50px rgba(66, 133, 244, 0.3),
                inset 0 2px 20px rgba(255, 255, 255, 0.1);
            transform: scale(0.7) rotateX(15deg);
            transition: all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            position: relative;
            overflow: hidden;
        `;

        // Add animated background pattern
        const bgPattern = document.createElement('div');
        bgPattern.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                radial-gradient(circle at 20% 80%, rgba(66, 133, 244, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(52, 168, 83, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 40% 40%, rgba(255, 193, 7, 0.1) 0%, transparent 50%);
            z-index: -1;
            animation: statsBackground 20s ease-in-out infinite;
        `;
        content.appendChild(bgPattern);

        // Add keyframe animation
        const animationStyles = document.createElement('style');
        animationStyles.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;600;700&display=swap');
            
            @keyframes statsBackground {
                0%, 100% { opacity: 0.5; transform: scale(1) rotate(0deg); }
                50% { opacity: 0.8; transform: scale(1.1) rotate(5deg); }
            }
            @keyframes statsCountUp {
                from { transform: scale(0.5); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            @keyframes glow {
                0%, 100% { box-shadow: 0 0 20px rgba(66, 133, 244, 0.5); }
                50% { box-shadow: 0 0 40px rgba(66, 133, 244, 0.8); }
            }
            @keyframes slideInLeft {
                from { transform: translateX(-100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideInRight {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(animationStyles);

        // Enhanced header with rank system
        const header = document.createElement('div');
        const playerRank = this.calculatePlayerRank(userStats);
        header.innerHTML = `
            <div style="
                background: linear-gradient(45deg, rgba(66, 133, 244, 0.2), rgba(52, 168, 83, 0.2));
                border: 2px solid rgba(66, 133, 244, 0.5);
                border-radius: 20px;
                padding: 25px;
                margin-bottom: 25px;
                position: relative;
                overflow: hidden;
            ">
                <h1 style="
                    font-family: 'Orbitron', monospace;
                    font-size: 2.8rem;
                    font-weight: 900;
                    margin: 0 0 15px 0;
                    background: linear-gradient(45deg, #4285F4, #34A853, #FFD700);
                    background-size: 200% 200%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 0 30px rgba(66, 133, 244, 0.5);
                    animation: statsBackground 3s ease-in-out infinite;
                ">⚡ BATTLE STATISTICS ⚡</h1>
                
                <div style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    margin: 20px 0;
                    flex-wrap: wrap;
                ">
                    <div style="
                        position: relative;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    ">
                        <div style="
                            width: 80px;
                            height: 80px;
                            border-radius: 50%;
                            background: linear-gradient(45deg, #4285F4, #34A853);
                            padding: 3px;
                            animation: glow 2s ease-in-out infinite;
                        ">
                            <img src="${currentUser.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRIAE00IDQgMCAwIDAtNCA0djIiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiPjwvY2lyY2xlPjwvc3ZnPg=='}" 
                                 alt="Avatar" 
                                 style="
                                    width: 100%;
                                    height: 100%;
                                    border-radius: 50%;
                                    object-fit: cover;
                                 ">
                        </div>
                        <div style="text-align: left;">
                            <h2 style="
                                color: #FFFFFF; 
                                margin: 0; 
                                font-size: 1.6rem;
                                font-family: 'Rajdhani', monospace;
                                font-weight: 700;
                            ">${currentUser.displayName || 'Commander'}</h2>
                            <div style="
                                display: flex;
                                align-items: center;
                                gap: 10px;
                                margin: 8px 0;
                            ">
                                <span style="
                                    background: ${playerRank.color};
                                    color: white;
                                    padding: 4px 12px;
                                    border-radius: 15px;
                                    font-size: 0.9rem;
                                    font-weight: 600;
                                    box-shadow: 0 2px 10px ${playerRank.color}40;
                                ">${playerRank.icon} ${playerRank.title}</span>
                                <span style="
                                    color: #FFD700;
                                    font-size: 1.1rem;
                                    font-weight: 600;
                                ">Level ${userStats.level || 1}</span>
                            </div>
                            <p style="
                                color: #CCCCCC; 
                                margin: 5px 0 0 0; 
                                font-size: 0.9rem;
                                opacity: 0.8;
                            ">Combat Rating: ${this.calculateCombatRating(userStats)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;        // Enhanced Statistics Grid with Animations
        const statsGrid = document.createElement('div');
        statsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin: 25px 0;
            perspective: 1000px;
        `;

        const stats = [
            { 
                label: '🏆 Victories', 
                value: userStats.victories || 0, 
                color: '#4CAF50',
                gradient: 'linear-gradient(135deg, #4CAF50, #66BB6A)',
                description: 'Battles won'
            },
            { 
                label: '💥 Defeats', 
                value: userStats.defeats || 0, 
                color: '#FF4444',
                gradient: 'linear-gradient(135deg, #FF4444, #FF6B6B)',
                description: 'Learning experiences'
            },
            { 
                label: '🎮 Total Games', 
                value: userStats.gamesPlayed || 0, 
                color: '#2196F3',
                gradient: 'linear-gradient(135deg, #2196F3, #42A5F5)',
                description: 'Battles fought'
            },
            { 
                label: '🎯 Shots Fired', 
                value: userStats.shotsFired || 0, 
                color: '#FF9800',
                gradient: 'linear-gradient(135deg, #FF9800, #FFB74D)',
                description: 'Ammunition used'
            },
            { 
                label: '💀 Kills', 
                value: userStats.tanksDestroyed || 0, 
                color: '#9C27B0',
                gradient: 'linear-gradient(135deg, #9C27B0, #BA68C8)',
                description: 'Enemies eliminated'
            },
            { 
                label: '⭐ Experience', 
                value: this.formatNumber(userStats.experience || 0), 
                color: '#FFD700',
                gradient: 'linear-gradient(135deg, #FFD700, #FFEB3B)',
                description: 'Combat experience'
            },
            { 
                label: '🔥 Win Rate', 
                value: this.calculateWinRate(userStats), 
                color: '#00BCD4',
                gradient: 'linear-gradient(135deg, #00BCD4, #26C6DA)',
                description: 'Success percentage'
            },
            { 
                label: '🎯 Accuracy', 
                value: this.calculateAccuracy(userStats), 
                color: '#795548',
                gradient: 'linear-gradient(135deg, #795548, #8D6E63)',
                description: 'Shot precision'
            }
        ];

        stats.forEach((stat, index) => {
            const statCard = document.createElement('div');
            statCard.style.cssText = `
                background: ${stat.gradient};
                border: 2px solid ${stat.color};
                border-radius: 15px;
                padding: 20px;
                text-align: center;
                cursor: pointer;
                transform: rotateY(0deg) translateZ(0);
                transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                position: relative;
                overflow: hidden;
                box-shadow: 
                    0 10px 30px rgba(0, 0, 0, 0.3),
                    0 0 20px ${stat.color}20;
                animation: slideInLeft 0.6s ease-out ${index * 0.1}s both;
            `;

            // Add animated background
            const cardBg = document.createElement('div');
            cardBg.style.cssText = `
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
                transform: rotate(45deg);
                transition: transform 0.6s ease;
                pointer-events: none;
            `;
            statCard.appendChild(cardBg);

            statCard.innerHTML += `
                <div style="position: relative; z-index: 1;">
                    <div style="
                        font-size: 1.4rem; 
                        margin-bottom: 10px;
                        font-weight: 600;
                        color: rgba(255,255,255,0.9);
                        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${stat.label}</div>
                    <div style="
                        font-size: 2.5rem; 
                        font-weight: 900; 
                        color: white;
                        text-shadow: 0 3px 6px rgba(0,0,0,0.4);
                        margin: 8px 0;
                        font-family: 'Orbitron', monospace;
                    ">${stat.value}</div>
                    <div style="
                        font-size: 0.85rem;
                        color: rgba(255,255,255,0.7);
                        font-style: italic;
                    ">${stat.description}</div>
                </div>
            `;
            
            // Enhanced hover effects
            statCard.addEventListener('mouseenter', () => {
                statCard.style.transform = 'rotateY(10deg) translateZ(20px) scale(1.05)';
                statCard.style.boxShadow = `
                    0 20px 50px rgba(0, 0, 0, 0.4),
                    0 0 40px ${stat.color}40
                `;
                cardBg.style.transform = 'rotate(45deg) translateX(100%)';
            });
            
            statCard.addEventListener('mouseleave', () => {
                statCard.style.transform = 'rotateY(0deg) translateZ(0) scale(1)';
                statCard.style.boxShadow = `
                    0 10px 30px rgba(0, 0, 0, 0.3),
                    0 0 20px ${stat.color}20
                `;
                cardBg.style.transform = 'rotate(45deg) translateX(-100%)';
            });

            // Add click animation
            statCard.addEventListener('click', () => {
                if (this.audioManager) {
                    this.audioManager.playSound('click', 0.3);
                }
                statCard.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    statCard.style.transform = 'scale(1)';
                }, 150);
            });
            
            statsGrid.appendChild(statCard);
        });        // Enhanced Achievements Section with Tiers
        const achievementsSection = document.createElement('div');
        achievementsSection.style.cssText = `
            margin: 35px 0;
            padding: 25px;
            background: linear-gradient(135deg, 
                rgba(0, 0, 0, 0.4) 0%, 
                rgba(30, 30, 30, 0.4) 50%, 
                rgba(0, 0, 0, 0.4) 100%);
            border: 2px solid rgba(255, 215, 0, 0.3);
            border-radius: 15px;
            position: relative;
            overflow: hidden;
        `;

        // Add glowing border animation
        const borderGlow = document.createElement('div');
        borderGlow.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            right: -2px;
            bottom: -2px;
            background: linear-gradient(45deg, #FFD700, #FFA726, #FFD700);
            border-radius: 15px;
            z-index: -1;
            opacity: 0.3;
            animation: glow 3s ease-in-out infinite;
        `;
        achievementsSection.appendChild(borderGlow);

        const allAchievements = this.generateEnhancedAchievements(userStats);
        const unlockedCount = allAchievements.filter(a => a.unlocked).length;
        
        achievementsSection.innerHTML += `
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 10px;
            ">
                <h3 style="
                    color: #FFD700; 
                    margin: 0; 
                    font-size: 1.6rem;
                    font-family: 'Orbitron', monospace;
                    font-weight: 700;
                    text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
                ">🏅 ACHIEVEMENTS</h3>
                <div style="
                    background: rgba(255, 215, 0, 0.2);
                    border: 1px solid #FFD700;
                    border-radius: 20px;
                    padding: 6px 15px;
                    color: #FFD700;
                    font-weight: 600;
                    font-size: 0.9rem;
                ">${unlockedCount}/${allAchievements.length} Unlocked</div>
            </div>
            
            <!-- Achievement Categories -->
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 20px;
                margin-top: 20px;
            ">
                ${this.generateAchievementCategories(allAchievements).map(category => `
                    <div style="
                        background: rgba(${category.color}, 0.1);
                        border: 2px solid rgba(${category.color}, 0.3);
                        border-radius: 12px;
                        padding: 15px;
                        animation: slideInRight 0.6s ease-out both;
                    ">
                        <h4 style="
                            color: rgb(${category.color});
                            margin: 0 0 12px 0;
                            font-size: 1.1rem;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">${category.icon} ${category.name}</h4>
                        <div style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 8px;
                        ">
                            ${category.achievements.map(achievement => `
                                <div style="
                                    background: ${achievement.unlocked ? 
                                        `linear-gradient(135deg, rgba(${category.color}, 0.3), rgba(${category.color}, 0.1))` : 
                                        'rgba(100, 100, 100, 0.2)'};
                                    border: 1px solid ${achievement.unlocked ? `rgb(${category.color})` : '#666666'};
                                    border-radius: 20px;
                                    padding: 6px 12px;
                                    font-size: 0.8rem;
                                    color: ${achievement.unlocked ? `rgb(${category.color})` : '#AAAAAA'};
                                    font-weight: 500;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                    position: relative;
                                    ${achievement.unlocked ? 'box-shadow: 0 0 15px rgba(' + category.color + ', 0.4);' : ''}
                                " 
                                title="${achievement.description}"
                                onmouseenter="this.style.transform='scale(1.1)'"
                                onmouseleave="this.style.transform='scale(1)'">
                                    ${achievement.icon} ${achievement.name}
                                    ${achievement.unlocked && achievement.isNew ? '<span style="position:absolute;top:-5px;right:-5px;background:#FF4444;color:white;border-radius:50%;width:8px;height:8px;font-size:6px;"></span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;        // Enhanced Progress Section with Multiple Progress Bars
        const progressSection = document.createElement('div');
        progressSection.style.cssText = `
            margin: 25px 0;
            padding: 25px;
            background: linear-gradient(135deg, 
                rgba(66, 133, 244, 0.1) 0%, 
                rgba(52, 168, 83, 0.1) 100%);
            border: 2px solid rgba(66, 133, 244, 0.3);
            border-radius: 15px;
            position: relative;
            overflow: hidden;
        `;
        
        const currentLevel = userStats.level || 1;
        const currentExp = userStats.experience || 0;
        const expForNextLevel = this.getExpForLevel(currentLevel + 1);
        const expForCurrentLevel = this.getExpForLevel(currentLevel);
        const expProgress = ((currentExp - expForCurrentLevel) / (expForNextLevel - expForCurrentLevel)) * 100;
        const nextMilestone = this.getNextMilestone(userStats);
        
        progressSection.innerHTML = `
            <h3 style="
                color: #4285F4; 
                margin: 0 0 20px 0;
                font-family: 'Orbitron', monospace;
                font-weight: 700;
                text-shadow: 0 0 10px rgba(66, 133, 244, 0.5);
            ">📈 PROGRESSION TRACKER</h3>
            
            <!-- Level Progress -->
            <div style="margin-bottom: 25px;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    margin-bottom: 8px;
                ">
                    <span style="color: #FFFFFF; font-weight: 600; font-size: 1.1rem;">
                        Level ${currentLevel} → ${currentLevel + 1}
                    </span>
                    <span style="color: #4285F4; font-weight: 600;">
                        ${Math.round(expProgress)}%
                    </span>
                </div>
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 15px;
                    height: 25px;
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
                ">
                    <div style="
                        background: linear-gradient(90deg, #4285F4, #34A853, #4285F4);
                        background-size: 200% 100%;
                        height: 100%;
                        width: ${Math.max(expProgress, 3)}%;
                        transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                        border-radius: 15px;
                        position: relative;
                        animation: statsBackground 2s ease-in-out infinite;
                        box-shadow: 0 0 20px rgba(66, 133, 244, 0.5);
                    ">
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                            animation: slideInLeft 2s ease-in-out infinite;
                        "></div>
                    </div>
                </div>
                <p style="
                    color: #CCCCCC; 
                    margin: 8px 0 0 0; 
                    font-size: 0.9rem;
                    text-align: center;
                ">
                    ${this.formatNumber(currentExp - expForCurrentLevel)} / ${this.formatNumber(expForNextLevel - expForCurrentLevel)} XP
                </p>
            </div>

            <!-- Next Milestone -->
            <div style="margin-bottom: 20px;">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                ">
                    <span style="color: #FFD700; font-weight: 600; font-size: 1rem;">
                        🎯 Next: ${nextMilestone.name}
                    </span>
                    <span style="color: #FFD700; font-weight: 600;">
                        ${nextMilestone.current}/${nextMilestone.target}
                    </span>
                </div>
                <div style="
                    background: rgba(255, 215, 0, 0.1);
                    border-radius: 10px;
                    height: 15px;
                    overflow: hidden;
                    position: relative;
                ">
                    <div style="
                        background: linear-gradient(90deg, #FFD700, #FFA726);
                        height: 100%;
                        width: ${Math.max((nextMilestone.current / nextMilestone.target) * 100, 2)}%;
                        transition: width 1s ease;
                        border-radius: 10px;
                        box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
                    "></div>
                </div>
            </div>

            <!-- Battle Statistics Mini Chart -->
            <div style="
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                gap: 15px;
                margin-top: 20px;
            ">
                ${this.generateMiniStats(userStats).map(stat => `
                    <div style="
                        text-align: center;
                        padding: 10px;
                        background: rgba(0, 0, 0, 0.2);
                        border-radius: 10px;
                        border: 1px solid ${stat.color};
                    ">
                        <div style="color: ${stat.color}; font-size: 1.2rem; margin-bottom: 5px;">
                            ${stat.icon}
                        </div>
                        <div style="color: white; font-weight: 600; font-size: 1.1rem;">
                            ${stat.value}
                        </div>
                        <div style="color: #CCCCCC; font-size: 0.8rem;">
                            ${stat.label}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;        // Enhanced Button Container with More Options
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 30px;
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            padding-top: 20px;
            border-top: 2px solid rgba(66, 133, 244, 0.3);
        `;

        const playAgainBtn = this.createStyledButton('🔄 Play Again', '#4CAF50', () => {
            document.body.removeChild(modal);
            if (animationStyles.parentNode) animationStyles.parentNode.removeChild(animationStyles);
            if (scrollbarStyles.parentNode) scrollbarStyles.parentNode.removeChild(scrollbarStyles);
            // Start a new game
            if (window.mainAppInstance && window.mainAppInstance.game) {
                window.mainAppInstance.game.startGame();
            }
        });

        const backToMenuBtn = this.createStyledButton('🏠 Main Menu', '#2196F3', () => {
            document.body.removeChild(modal);
            if (animationStyles.parentNode) animationStyles.parentNode.removeChild(animationStyles);
            if (scrollbarStyles.parentNode) scrollbarStyles.parentNode.removeChild(scrollbarStyles);
            this.showDifficultySelector();
        });

        const shareBtn = this.createStyledButton('📤 Share Stats', '#9C27B0', () => {
            this.shareUserStats(userStats);
        });

        const resetStatsBtn = this.createStyledButton('🔄 Reset Stats', '#FF5722', () => {
            this.showResetConfirmation(currentUser.uid, modal, animationStyles, scrollbarStyles);
        });

        buttonContainer.appendChild(playAgainBtn);
        buttonContainer.appendChild(backToMenuBtn);
        buttonContainer.appendChild(shareBtn);
        buttonContainer.appendChild(resetStatsBtn);

        // Assemble content
        content.appendChild(header);
        content.appendChild(statsGrid);
        content.appendChild(achievementsSection);
        content.appendChild(progressSection);
        content.appendChild(buttonContainer);
        scrollContainer.appendChild(content);
        modal.appendChild(scrollContainer);
        document.body.appendChild(modal);

        // Animate in with staggered timing
        setTimeout(() => {
            modal.style.opacity = '1';
            content.style.transform = 'scale(1) rotateX(0deg)';
        }, 100);

        // Add keyboard navigation
        const handleKeyPress = (e) => {
            switch(e.key) {
                case 'Escape':
                    backToMenuBtn.click();
                    break;
                case 'Enter':
                    playAgainBtn.click();
                    break;
                case 's':
                case 'S':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        shareBtn.click();
                    }
                    break;
            }
        };
        document.addEventListener('keydown', handleKeyPress);

        // Store cleanup function
        modal._cleanup = () => {
            document.removeEventListener('keydown', handleKeyPress);
            if (animationStyles.parentNode) animationStyles.parentNode.removeChild(animationStyles);
            if (scrollbarStyles.parentNode) scrollbarStyles.parentNode.removeChild(scrollbarStyles);
        };
    }    createStyledButton(text, color, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            background: linear-gradient(135deg, ${color}, ${this.lightenColor(color, 20)});
            border: 2px solid ${color};
            color: white;
            padding: 14px 28px;
            font-size: 1rem;
            font-weight: 700;
            font-family: 'Rajdhani', monospace;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            box-shadow: 
                0 6px 20px rgba(0, 0, 0, 0.3),
                0 0 20px ${color}40;
            min-width: 150px;
            text-transform: uppercase;
            letter-spacing: 1px;
            position: relative;
            overflow: hidden;
        `;
        
        // Add shimmer effect
        const shimmer = document.createElement('div');
        shimmer.style.cssText = `
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
            transition: left 0.6s ease;
        `;
        button.appendChild(shimmer);

        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-3px) scale(1.05)';
            button.style.boxShadow = `
                0 10px 30px rgba(0, 0, 0, 0.4),
                0 0 30px ${color}60
            `;
            shimmer.style.left = '100%';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0) scale(1)';
            button.style.boxShadow = `
                0 6px 20px rgba(0, 0, 0, 0.3),
                0 0 20px ${color}40
            `;
            shimmer.style.left = '-100%';
        });

        button.addEventListener('click', () => {
            if (this.audioManager) {
                this.audioManager.playSound('click', 0.5);
            }
            button.style.transform = 'translateY(-1px) scale(0.98)';
            setTimeout(() => {
                button.style.transform = 'translateY(-3px) scale(1.05)';
                onClick();
            }, 150);
        });
        
        return button;
    }

    // Helper method to lighten colors
    lightenColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Format large numbers with suffixes
    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Calculate player rank based on stats
    calculatePlayerRank(userStats) {
        const totalScore = (userStats.victories || 0) * 10 + 
                          (userStats.tanksDestroyed || 0) * 5 + 
                          (userStats.experience || 0) / 100;
        
        if (totalScore >= 5000) return { title: 'Tank Commander', icon: '⭐⭐⭐', color: '#FFD700' };
        if (totalScore >= 2000) return { title: 'Battle Master', icon: '⭐⭐', color: '#C0C0C0' };
        if (totalScore >= 1000) return { title: 'War Veteran', icon: '⭐', color: '#CD7F32' };
        if (totalScore >= 500) return { title: 'Sergeant', icon: '🎖️', color: '#4CAF50' };
        if (totalScore >= 100) return { title: 'Corporal', icon: '🏅', color: '#2196F3' };
        return { title: 'Recruit', icon: '🎯', color: '#9E9E9E' };
    }

    // Calculate combat rating
    calculateCombatRating(userStats) {
        const winRate = this.calculateWinRate(userStats);
        const accuracy = this.calculateAccuracy(userStats);
        const games = userStats.gamesPlayed || 0;
        
        const winRateNum = parseFloat(winRate) || 0;
        const accuracyNum = parseFloat(accuracy) || 0;
        const gameBonus = Math.min(games * 2, 100);
        
        return Math.round(winRateNum * 0.4 + accuracyNum * 0.4 + gameBonus * 0.2);
    }

    // Enhanced achievements with categories
    generateEnhancedAchievements(userStats) {
        return [
            // Combat Achievements
            { name: 'First Blood', icon: '🥇', unlocked: userStats.victories >= 1, category: 'combat', description: 'Win your first battle' },
            { name: 'Warrior', icon: '⚔️', unlocked: userStats.victories >= 5, category: 'combat', description: 'Win 5 battles' },
            { name: 'Champion', icon: '👑', unlocked: userStats.victories >= 25, category: 'combat', description: 'Win 25 battles' },
            { name: 'Legend', icon: '🏆', unlocked: userStats.victories >= 100, category: 'combat', description: 'Win 100 battles' },
            
            // Skill Achievements
            { name: 'Marksman', icon: '🎯', unlocked: this.calculateAccuracy(userStats) >= '25%', category: 'skill', description: '25% accuracy rate' },
            { name: 'Sharpshooter', icon: '🏹', unlocked: this.calculateAccuracy(userStats) >= '50%', category: 'skill', description: '50% accuracy rate' },
            { name: 'Sniper Elite', icon: '🔭', unlocked: this.calculateAccuracy(userStats) >= '75%', category: 'skill', description: '75% accuracy rate' },
            
            // Experience Achievements
            { name: 'Veteran', icon: '🎖️', unlocked: userStats.gamesPlayed >= 10, category: 'experience', description: 'Play 10 games' },
            { name: 'Seasoned', icon: '⚡', unlocked: userStats.gamesPlayed >= 50, category: 'experience', description: 'Play 50 games' },
            { name: 'Master', icon: '💎', unlocked: userStats.gamesPlayed >= 200, category: 'experience', description: 'Play 200 games' },
            
            // Special Achievements
            { name: 'Destroyer', icon: '💥', unlocked: userStats.tanksDestroyed >= 50, category: 'special', description: 'Destroy 50 tanks' },
            { name: 'Perfectionist', icon: '⭐', unlocked: this.calculateWinRate(userStats) >= '90%' && userStats.gamesPlayed >= 10, category: 'special', description: '90% win rate (10+ games)' },
            { name: 'Persistent', icon: '🔥', unlocked: userStats.gamesPlayed >= 100, category: 'special', description: 'Never give up - 100 games played' }
        ];
    }

    // Group achievements by category
    generateAchievementCategories(achievements) {
        const categories = {
            combat: { name: 'Combat', icon: '⚔️', color: '244, 67, 54', achievements: [] },
            skill: { name: 'Skill', icon: '🎯', color: '255, 152, 0', achievements: [] },
            experience: { name: 'Experience', icon: '📈', color: '33, 150, 243', achievements: [] },
            special: { name: 'Special', icon: '⭐', color: '156, 39, 176', achievements: [] }
        };

        achievements.forEach(achievement => {
            if (categories[achievement.category]) {
                categories[achievement.category].achievements.push(achievement);
            }
        });

        return Object.values(categories);
    }

    // Calculate XP required for specific level
    getExpForLevel(level) {
        // Exponential growth: Level 1=0, Level 2=1000, Level 3=2500, Level 4=4500, etc.
        return level === 1 ? 0 : Math.floor(Math.pow(level - 1, 1.5) * 1000);
    }

    // Get next milestone for player
    getNextMilestone(userStats) {
        const milestones = [
            { name: 'First Victory', target: 1, current: userStats.victories || 0, type: 'victories' },
            { name: '5 Victories', target: 5, current: userStats.victories || 0, type: 'victories' },
            { name: '10 Tank Kills', target: 10, current: userStats.tanksDestroyed || 0, type: 'kills' },
            { name: '25 Games Played', target: 25, current: userStats.gamesPlayed || 0, type: 'games' },
            { name: '50 Tank Kills', target: 50, current: userStats.tanksDestroyed || 0, type: 'kills' },
            { name: '25 Victories', target: 25, current: userStats.victories || 0, type: 'victories' },
            { name: '100 Games Played', target: 100, current: userStats.gamesPlayed || 0, type: 'games' }
        ];

        return milestones.find(m => m.current < m.target) || 
               { name: 'All Milestones Complete!', target: 1, current: 1, type: 'complete' };
    }

    // Generate mini stats for progress section
    generateMiniStats(userStats) {
        return [
            { 
                icon: '🏆', 
                value: `${Math.round(this.calculateWinRate(userStats))}%`, 
                label: 'Win Rate', 
                color: '#4CAF50' 
            },
            { 
                icon: '🎯', 
                value: `${Math.round(this.calculateAccuracy(userStats))}%`, 
                label: 'Accuracy', 
                color: '#FF9800' 
            },
            { 
                icon: '⚡', 
                value: userStats.level || 1, 
                label: 'Level', 
                color: '#2196F3' 
            },
            { 
                icon: '🔥', 
                value: Math.max(userStats.victories - userStats.defeats, 0), 
                label: 'Streak', 
                color: '#9C27B0' 
            }
        ];
    }

    // Reset stats confirmation
    showResetConfirmation(uid, parentModal, animationStyles, scrollbarStyles) {
        const confirmModal = document.createElement('div');
        confirmModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1001;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        confirmModal.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #B71C1C, #D32F2F);
                border: 3px solid #FF5722;
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                transform: scale(0.7);
                transition: transform 0.3s ease;
            ">
                <h2 style="color: white; margin: 0 0 15px 0; font-size: 1.5rem;">⚠️ Reset Statistics</h2>
                <p style="color: #FFCDD2; margin: 0 0 20px 0; line-height: 1.4;">
                    This will permanently delete all your progress, achievements, and statistics. 
                    This action cannot be undone!
                </p>
                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button id="confirm-reset" style="
                        background: #D32F2F;
                        border: 2px solid #FF5722;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Yes, Reset</button>
                    <button id="cancel-reset" style="
                        background: #757575;
                        border: 2px solid #9E9E9E;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);
        
        setTimeout(() => {
            confirmModal.style.opacity = '1';
            confirmModal.querySelector('div').style.transform = 'scale(1)';
        }, 100);

        confirmModal.querySelector('#confirm-reset').addEventListener('click', () => {
            this.resetUserStats(uid);
            document.body.removeChild(confirmModal);
            document.body.removeChild(parentModal);
            if (animationStyles.parentNode) animationStyles.parentNode.removeChild(animationStyles);
            if (scrollbarStyles.parentNode) scrollbarStyles.parentNode.removeChild(scrollbarStyles);
            this.showMessage('Statistics reset successfully! 🔄');
        });

        confirmModal.querySelector('#cancel-reset').addEventListener('click', () => {
            document.body.removeChild(confirmModal);
        });
    }

    // Reset user stats
    resetUserStats(uid) {
        const defaultStats = {
            victories: 0,
            defeats: 0,
            gamesPlayed: 0,
            shotsFired: 0,
            tanksDestroyed: 0,
            experience: 0,
            level: 1
        };

        try {
            const userData = {
                uid: uid,
                resources: defaultStats,
                lastUpdated: Date.now()
            };
            localStorage.setItem('tankGame_userData', JSON.stringify(userData));
        } catch (error) {
            console.error('Failed to reset user stats:', error);
        }
    }    getUserStats(uid) {
        // Try to get from localStorage first, then Firebase if available
        try {
            const userData = localStorage.getItem('tankGame_userData');
            if (userData) {
                const parsed = JSON.parse(userData);
                if (parsed.uid === uid && parsed.resources) {
                    return parsed.resources;
                }
            }
        } catch (error) {
            console.warn('Failed to parse user data from localStorage:', error);
        }

        // Return default stats if no data found
        return {
            victories: 0,
            defeats: 0,
            gamesPlayed: 0,
            shotsFired: 0,
            tanksDestroyed: 0,
            experience: 0,
            level: 1
        };
    }

    calculateWinRate(userStats) {
        if (!userStats.gamesPlayed || userStats.gamesPlayed === 0) return '0%';
        const winRate = (userStats.victories / userStats.gamesPlayed * 100).toFixed(1);
        return `${winRate}%`;
    }

    calculateAccuracy(userStats) {
        if (!userStats.shotsFired || userStats.shotsFired === 0) return '0%';
        const accuracy = (userStats.tanksDestroyed / userStats.shotsFired * 100).toFixed(1);
        return `${accuracy}%`;
    }

    // Legacy method for backward compatibility
    generateAchievements(userStats) {
        const achievements = [
            { name: 'First Victory', icon: '🥇', unlocked: userStats.victories >= 1 },
            { name: 'Sharpshooter', icon: '🎯', unlocked: userStats.tanksDestroyed >= 10 },
            { name: 'Veteran', icon: '🎖️', unlocked: userStats.gamesPlayed >= 25 },
            { name: 'Destroyer', icon: '💥', unlocked: userStats.tanksDestroyed >= 50 },
            { name: 'Experienced', icon: '⭐', unlocked: userStats.experience >= 5000 },
            { name: 'Champion', icon: '👑', unlocked: userStats.victories >= 50 }
        ];

        return achievements;
    }

    shareUserStats(userStats) {
        const playerRank = this.calculatePlayerRank(userStats);
        const combatRating = this.calculateCombatRating(userStats);
        
        const shareText = `🎮 My 3D Scorched Earth Battle Stats! 🎮\n\n` +
            `🏆 Rank: ${playerRank.title} ${playerRank.icon}\n` +
            `⚔️ Combat Rating: ${combatRating}\n` +
            `🥇 Victories: ${userStats.victories || 0}\n` +
            `🎮 Battles: ${userStats.gamesPlayed || 0}\n` +
            `🎯 Win Rate: ${this.calculateWinRate(userStats)}\n` +
            `💀 Tanks Destroyed: ${userStats.tanksDestroyed || 0}\n` +
            `🎯 Accuracy: ${this.calculateAccuracy(userStats)}\n` +
            `⭐ Level: ${userStats.level || 1}\n` +
            `⚡ Experience: ${this.formatNumber(userStats.experience || 0)}\n\n` +
            `Think you can beat my stats? 🚀\n` +
            `Join the battlefield now! 💥`;

        if (navigator.share) {
            navigator.share({
                title: '🎯 3D Scorched Earth Battle Stats',
                text: shareText
            }).then(() => {
                this.showMessage('Stats shared successfully! 📤');
            }).catch((error) => {
                console.log('Share failed:', error);
                this.fallbackShare(shareText);
            });
        } else {
            this.fallbackShare(shareText);
        }
    }

    fallbackShare(shareText) {
        // Try clipboard first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText).then(() => {
                this.showMessage('Stats copied to clipboard! 📋 Paste and share!');
            }).catch(() => {
                // Final fallback - show in alert
                alert('Copy this text to share:\n\n' + shareText);
            });
        } else {
            // Very old browsers - use textarea method
            const textArea = document.createElement('textarea');
            textArea.value = shareText;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            
            try {
                document.execCommand('copy');
                this.showMessage('Stats copied to clipboard! 📋');
            } catch (err) {
                alert('Copy this text to share:\n\n' + shareText);
            }
            
            document.body.removeChild(textArea);
        }
    }
}