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

    // User Statistics Page
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

        // Create modal overlay
        const modal = document.createElement('div');
        modal.id = 'user-stats-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
            backdrop-filter: blur(5px);
            opacity: 0;
            transition: opacity 0.5s ease-in-out;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(40, 40, 50, 0.95));
            border: 2px solid #4285F4;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            transform: scale(0.8);
            transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        `;

        // Title and user info
        const header = document.createElement('div');
        header.innerHTML = `
            <h1 style="
                font-family: 'Arial Black', Arial, sans-serif;
                font-size: 2.5rem;
                margin: 0 0 10px 0;
                color: #4285F4;
                text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
            ">📊 Player Statistics</h1>
            <div style="
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
                margin: 20px 0 30px 0;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
            ">
                <img src="${currentUser.photoURL || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRINGE0IDQgMCAwIDAtNCA0djIiPjwvcGF0aD48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiPjwvY2lyY2xlPjwvc3ZnPg=='}" 
                     alt="Avatar" 
                     style="
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        border: 2px solid #4285F4;
                     ">
                <div>
                    <h3 style="color: #FFFFFF; margin: 0; font-size: 1.3rem;">${currentUser.displayName || 'Player'}</h3>
                    <p style="color: #CCCCCC; margin: 5px 0 0 0; font-size: 0.9rem;">Level ${userStats.level || 1}</p>
                </div>
            </div>
        `;

        // Statistics grid
        const statsGrid = document.createElement('div');
        statsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin: 20px 0;
        `;

        const stats = [
            { label: '🏆 Victories', value: userStats.victories || 0, color: '#4CAF50' },
            { label: '💥 Defeats', value: userStats.defeats || 0, color: '#FF4444' },
            { label: '🎮 Games Played', value: userStats.gamesPlayed || 0, color: '#2196F3' },
            { label: '🎯 Shots Fired', value: userStats.shotsFired || 0, color: '#FF9800' },
            { label: '💀 Tanks Destroyed', value: userStats.tanksDestroyed || 0, color: '#9C27B0' },
            { label: '⭐ Experience', value: userStats.experience || 0, color: '#FFD700' },
            { label: '🔥 Win Rate', value: this.calculateWinRate(userStats), color: '#00BCD4' },
            { label: '🎯 Accuracy', value: this.calculateAccuracy(userStats), color: '#795548' }
        ];

        stats.forEach(stat => {
            const statCard = document.createElement('div');
            statCard.style.cssText = `
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid ${stat.color};
                border-radius: 10px;
                padding: 15px;
                text-align: center;
                transition: transform 0.3s ease;
            `;
            statCard.innerHTML = `
                <div style="font-size: 1.5rem; margin-bottom: 5px;">${stat.label}</div>
                <div style="font-size: 1.8rem; font-weight: bold; color: ${stat.color};">${stat.value}</div>
            `;
            
            // Add hover effect
            statCard.addEventListener('mouseenter', () => {
                statCard.style.transform = 'translateY(-5px)';
            });
            statCard.addEventListener('mouseleave', () => {
                statCard.style.transform = 'translateY(0)';
            });
            
            statsGrid.appendChild(statCard);
        });

        // Achievements section
        const achievementsSection = document.createElement('div');
        achievementsSection.style.cssText = `
            margin: 30px 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
        `;
        achievementsSection.innerHTML = `
            <h3 style="color: #FFD700; margin: 0 0 15px 0; font-size: 1.4rem;">🏅 Recent Achievements</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
                ${this.generateAchievements(userStats).map(achievement => `
                    <div style="
                        background: ${achievement.unlocked ? 'rgba(255, 215, 0, 0.2)' : 'rgba(100, 100, 100, 0.2)'};
                        border: 1px solid ${achievement.unlocked ? '#FFD700' : '#666666'};
                        border-radius: 8px;
                        padding: 8px 12px;
                        font-size: 0.9rem;
                        color: ${achievement.unlocked ? '#FFD700' : '#AAAAAA'};
                    ">
                        ${achievement.icon} ${achievement.name}
                    </div>
                `).join('')}
            </div>
        `;

        // Progress bars for next level
        const progressSection = document.createElement('div');
        progressSection.style.cssText = `
            margin: 20px 0;
            padding: 20px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
        `;
        
        const currentLevel = userStats.level || 1;
        const currentExp = userStats.experience || 0;
        const expForNextLevel = currentLevel * 1000; // 1000 exp per level
        const expProgress = (currentExp % 1000) / 1000 * 100;
        
        progressSection.innerHTML = `
            <h3 style="color: #4285F4; margin: 0 0 15px 0;">📈 Progress to Level ${currentLevel + 1}</h3>
            <div style="
                background: rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                height: 20px;
                overflow: hidden;
                margin: 10px 0;
            ">
                <div style="
                    background: linear-gradient(90deg, #4285F4, #34A853);
                    height: 100%;
                    width: ${expProgress}%;
                    transition: width 0.3s ease;
                "></div>
            </div>
            <p style="color: #CCCCCC; margin: 5px 0 0 0; font-size: 0.9rem;">
                ${currentExp % 1000} / 1000 XP (${Math.round(expProgress)}%)
            </p>
        `;

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            margin-top: 30px;
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        `;

        const playAgainBtn = this.createStyledButton('🔄 Play Again', '#4CAF50', () => {
            document.body.removeChild(modal);
            // Start a new game
            if (window.mainAppInstance && window.mainAppInstance.game) {
                window.mainAppInstance.game.startGame();
            }
        });

        const backToMenuBtn = this.createStyledButton('🏠 Main Menu', '#2196F3', () => {
            document.body.removeChild(modal);
            this.showDifficultySelector();
        });

        const shareBtn = this.createStyledButton('📤 Share Stats', '#9C27B0', () => {
            this.shareUserStats(userStats);
        });

        buttonContainer.appendChild(playAgainBtn);
        buttonContainer.appendChild(backToMenuBtn);
        buttonContainer.appendChild(shareBtn);

        // Assemble content
        content.appendChild(header);
        content.appendChild(statsGrid);
        content.appendChild(achievementsSection);
        content.appendChild(progressSection);
        content.appendChild(buttonContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Animate in
        setTimeout(() => {
            modal.style.opacity = '1';
            content.style.transform = 'scale(1)';
        }, 100);
    }

    createStyledButton(text, color, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            background: ${color};
            border: none;
            color: white;
            padding: 12px 24px;
            font-size: 1rem;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            min-width: 140px;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
        });
        
        button.addEventListener('click', onClick);
        return button;
    }

    getUserStats(uid) {
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
        const shareText = `🎮 My 3D Scorched Earth Stats!\n\n` +
            `🏆 Victories: ${userStats.victories}\n` +
            `🎮 Games Played: ${userStats.gamesPlayed}\n` +
            `🎯 Win Rate: ${this.calculateWinRate(userStats)}\n` +
            `💀 Tanks Destroyed: ${userStats.tanksDestroyed}\n` +
            `⭐ Level: ${userStats.level}\n\n` +
            `Play now and beat my score! 🚀`;

        if (navigator.share) {
            navigator.share({
                title: '3D Scorched Earth Stats',
                text: shareText
            }).catch(console.error);
        } else {
            // Fallback to clipboard
            navigator.clipboard.writeText(shareText).then(() => {
                this.showMessage('Stats copied to clipboard! 📋');
            }).catch(() => {
                // Final fallback - show in alert
                alert(shareText);
            });
        }
    }
}