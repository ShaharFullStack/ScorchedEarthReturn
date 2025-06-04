import * as THREE from 'three';
import { Tank } from './tank.js';
import { Projectile } from './projectile.js';
import { generateTrees, generateBuildings } from './sceneSetup.js';
import { ParticleSystem } from './particleSystem.js';
import { MobileControls } from './mobileControls.js';
import { CollisionSystem } from './collisionSystem.js'; // Import the new collision system
import { UI } from './ui.js';
import { AudioManager } from './audioManager.js';


const PLAYER_ID = 'player';
const ENEMY_ID_PREFIX = 'enemy_';

// Difficulty configurations
const DIFFICULTY_SETTINGS = {
    sargent: {
        name: "Sargent",
        aiReactionTime: 600,  // Slowest - gives player more time to think
        aimAccuracy: 0.3,
        strategicThinking: 0.2,
        aggressiveness: 0.3,
        fuelEfficiency: 0.6,
        coverUsage: 0.3,
        playerHealthBonus: 50,
        playerFuelBonus: 50
    },
    lieutenant: {
        name: "Lieutenant",
        aiReactionTime: 1200,  // Medium speed
        aimAccuracy: 0.7,
        strategicThinking: 0.6,
        aggressiveness: 0.6,
        fuelEfficiency: 0.8,
        coverUsage: 0.7,
        playerHealthBonus: 0,
        playerFuelBonus: 0
    },
    colonel: {
        name: "Colonel",
        aiReactionTime: 2000,   // Fastest - creates pressure and challenge
        aimAccuracy: 0.95,
        strategicThinking: 0.9,
        aggressiveness: 1.0,  // Maximum aggressiveness
        fuelEfficiency: 0.95,
        coverUsage: 0.9,      
        playerHealthBonus: -15, // Even more challenging for player
        playerFuelBonus: -15
    }
};

// Make mobile controls accessible globally for testing
window.forceMobileControls = function () {
    if (window.gameInstance && window.gameInstance.mobileControls) {
        window.gameInstance.mobileControls.forceEnable();
        console.log('Mobile controls force-enabled! You should now see D-pad and action buttons.');
    } else {
        console.log('Game instance or mobile controls not available. Try again after the game loads.');
    }
};

export class Game {
    constructor(scene, camera, renderer, ui, audioManager) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.ui = ui;
        this.audioManager = audioManager;

        this.playerTank = null;
        this.enemyTanks = [];
        this.projectiles = [];
        this.buildings = [];
        this.trees = []; this.currentPlayerIndex = -1;
        this.activeTank = null;
        this.cameraController = null;
        this.difficulty = 'lieutenant'; // Default to medium if not set properly
        this.difficultyConfig = DIFFICULTY_SETTINGS[this.difficulty];
        this.gameState = 'LOADING'; // Initial game state

        this.gameState = 'DIFFICULTY_SELECTION';        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.scene);

        // Initialize collision system (WILL BE SET AFTER SCENE SETUP)
        this.collisionSystem = null;

        // Game statistics tracking
        this.gameStats = {
            shotsFired: 0,
            tanksDestroyed: 0,
            gameStartTime: null
        };

        this.inputStates = {
            moveForward: false,
            moveBackward: false,
            rotateLeft: false,
            rotateRight: false,
            turretLeft: false,
            turretRight: false,
            fire: false,
            increasePower: false,
            decreasePower: false,
            barrelUp: false,
            barrelDown: false
        };

        // Initialize mobile controls
        this.mobileControls = new MobileControls(this);

        this.setupInputListeners();

        this.ui.endTurnButton.addEventListener('click', () => {
            this.endPlayerTurn();
        });

        this.ui.onDifficultyChange = (difficulty) => this.setDifficulty(difficulty);
        this.setupControlsInfo();
    }

    setCameraController(controller) {
        this.cameraController = controller;
    } setDifficulty(difficulty) {
        console.log(`Game: Setting difficulty to: ${difficulty}`);
        if (!DIFFICULTY_SETTINGS[difficulty]) {
            console.error(`Invalid difficulty: ${difficulty}. Using default.`);
            difficulty = 'lieutenant'; // Fallback to medium difficulty
        }

        this.difficulty = difficulty;
        this.difficultyConfig = DIFFICULTY_SETTINGS[difficulty];
        console.log(`Game: Difficulty set to: ${this.difficultyConfig.name}`);
        this.startGameInitialization();
    }

    async startGameInitialization() {
        this.gameState = 'INITIALIZING';
        await this.initGame();
        this.startGame();
    }    async initGame() {
        // Perform comprehensive cleanup before generating new map
        this.cleanupExistingGame();

        // Generate buildings first
        this.buildings = generateBuildings(this.scene, [], 15);

        // Generate trees after buildings
        this.trees = generateTrees(this.scene, this.buildings, 30);

        // INITIALIZE COLLISION SYSTEM AFTER SCENE SETUP
        this.collisionSystem = new CollisionSystem(this);
        console.log('Collision system initialized with', this.buildings.length, 'buildings and', this.trees.length, 'trees');

        const terrainSize = this.scene.userData.terrain ? this.scene.userData.terrain.size : 150;
        const padding = 25;
        const minTankDistance = 12;
        const minTankBuildingDistance = 8;
        const minTankTreeDistance = 6;
        const occupiedPositions = [];

        const tankCollisionRadius = 1.5;

        const getRandomPosition = () => {
            let position;
            let tooClose;
            let attempts = 0;
            do {
                tooClose = false;
                const x = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
                const z = THREE.MathUtils.randFloat(-terrainSize / 2 + padding, terrainSize / 2 - padding);
                position = new THREE.Vector3(x, 0, z);

                // Check against other tanks
                for (const occupied of occupiedPositions) {
                    if (position.distanceTo(occupied) < minTankDistance) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) {
                    attempts++;
                    continue;
                }                // Use enhanced collision system to check tank spawn suitability
                if (this.collisionSystem) {
                    const spawnCheck = this.collisionSystem.checkSpawnSuitability(position, tankCollisionRadius, 3.0);
                    if (!spawnCheck.suitable) {
                        tooClose = true;
                        attempts++;
                        // Debug logging for spawn conflicts
                        if (attempts % 50 === 0) {
                            console.log(`Spawn attempt ${attempts}: ${spawnCheck.reason}`, spawnCheck.conflictingObject?.type || 'unknown');
                        }
                        continue;
                    }
                }

                attempts++;
            } while (tooClose && attempts < 200);

            if (attempts >= 200) {
                console.warn("Could not find a sufficiently spaced random position for a tank after 200 attempts.");
            }

            occupiedPositions.push(position.clone());
            return position;
        };

        // Create player tank with difficulty bonuses
        const playerInitialPosition = getRandomPosition();
        this.playerTank = new Tank(PLAYER_ID, true, this.scene, playerInitialPosition, 0x00ff00, this);

        // Apply difficulty modifiers to player
        const originalPlayerHealth = this.playerTank.currentHealth;
        this.playerTank.maxHealth += this.difficultyConfig.playerHealthBonus;

        // Only reset health if it's at full health (initial state)
        if (originalPlayerHealth === this.playerTank.maxHealth - this.difficultyConfig.playerHealthBonus) {
            this.playerTank.currentHealth = this.playerTank.maxHealth;
        } else {
            // Health was already modified, adjust proportionally
            const healthRatio = originalPlayerHealth / (this.playerTank.maxHealth - this.difficultyConfig.playerHealthBonus);
            this.playerTank.currentHealth = Math.floor(this.playerTank.maxHealth * healthRatio);
        }

        this.playerTank.maxFuel += this.difficultyConfig.playerFuelBonus;
        this.playerTank.currentFuel = this.playerTank.maxFuel;

        // Update health bar after applying bonuses
        if (this.camera) {
            this.playerTank.updateHealthBar(this.camera);
        }

        this.scene.add(this.playerTank.mesh);

        // Create enemy tanks
        const numEnemies = 3;
        for (let i = 0; i < numEnemies; i++) {
            const enemyInitialPosition = getRandomPosition();
            const enemy = new Tank(ENEMY_ID_PREFIX + i, false, this.scene, enemyInitialPosition, 0xff0000, this);

            // Set AI difficulty properties
            enemy.aiDifficulty = this.difficultyConfig;
            enemy.lastKnownPlayerPosition = null;
            enemy.strategicState = 'seeking';
            enemy.coverPosition = null;
            enemy.turnsSinceLastShot = 0;
            this.enemyTanks.push(enemy);
            this.scene.add(enemy.mesh);
        }
    } startGame() {
        this.gameState = 'PLAYER_TURN';
        this.currentPlayerIndex = -1;
        this.activeTank = this.playerTank;
        this.activeTank.resetTurnStats();
        const playerName = this.ui.getPlayerName() || 'Player';
        this.ui.updateTurnIndicator(`${this.difficultyConfig.name} ${playerName}'s Turn`);
        this.ui.setTurnStatus(true); // Player turn = green light
        this.ui.updateFuel(this.activeTank.currentFuel, this.activeTank.maxFuel);
        this.ui.updateHealth(this.activeTank.id, this.activeTank.currentHealth, this.activeTank.maxHealth);
        this.ui.toggleEndTurnButton(true); this.ui.updateActionIndicator("Fire / Adjust Power");
        this.ui.updatePowerIndicator(this.playerTank.currentPower, this.playerTank.minPower, this.playerTank.maxPower);

        // Initialize game statistics
        this.gameStats = {
            shotsFired: 0,
            tanksDestroyed: 0,
            gameStartTime: Date.now()
        };

        // Play enter tank sound
        if (this.audioManager) {
            this.audioManager.playEnterTankSound();
        }

        // Start gameplay background music (only if not already playing the same tune)
        if (this.audioManager) {
            // Since openingScreen and gameplayBg now use the same audio object,
            // check if music is already playing before switching
            const currentMusic = this.audioManager.currentMusic;
            const gameplayBgMusic = this.audioManager.sounds['gameplayBg'];

            if (currentMusic !== gameplayBgMusic || !currentMusic || currentMusic.paused) {
                this.audioManager.stopAllMusic();
                this.audioManager.playMusic('gameplayBg', true);
            } else {
                console.log('Music already playing with shared audio object - ensuring correct volume');
                // Make sure volume is correct even if using shared object
                if (currentMusic) {
                    currentMusic.volume = this.audioManager.musicVolume;
                }
            }
        }
    }

    nextTurn() {
        this.activeTank.hasFired = false;

        if (this.gameState === 'GAME_OVER') return;

        // Stop any continuous sounds when turn changes
        if (this.audioManager) {
            this.audioManager.stopAllContinuousSounds();
        }

        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.enemyTanks.length) {
            this.currentPlayerIndex = -1;
        } if (this.currentPlayerIndex === -1) {
            this.activeTank = this.playerTank;
            if (this.activeTank.isDestroyed) {
                // Player loses - pass current game statistics
                const gameStats = {
                    shotsFired: this.gameStats?.shotsFired || 0,
                    tanksDestroyed: this.gameStats?.tanksDestroyed || 0,
                    gameStartTime: this.gameStats?.gameStartTime || null
                };
                this.gameOver(false, gameStats);
                return;
            }
            this.gameState = 'PLAYER_TURN';
            this.activeTank.resetTurnStats();
            const playerName = this.ui.getPlayerName() || 'Player';
            this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - ${playerName} Turn`);
            this.ui.setTurnStatus(true); // Player turn = green light
            this.ui.toggleEndTurnButton(true);
        } else {
            this.activeTank = this.enemyTanks[this.currentPlayerIndex];
            if (this.activeTank.isDestroyed) {
                this.nextTurn();
                return;
            }
            this.gameState = 'ENEMY_TURN';
            this.activeTank.resetTurnStats();
            this.ui.updateTurnIndicator(`Enemy ${this.currentPlayerIndex + 1}'s Turn`);
            this.ui.setTurnStatus(false); // Enemy turn = red light            
            this.ui.updateActionIndicator("Enemy is analyzing battlefield...");
            this.ui.toggleEndTurnButton(false);

            // AI reaction time based on difficulty
            setTimeout(() => this.executeEnemyTurn(this.activeTank), this.difficultyConfig.aiReactionTime);
        }
        this.ui.updateFuel(this.activeTank.currentFuel, this.activeTank.maxFuel);
        this.ui.updateHealth(this.activeTank.id, this.activeTank.currentHealth, this.activeTank.maxHealth);
    }

    executeEnemyTurn(enemy) {
        if (enemy.isDestroyed || this.gameState === 'GAME_OVER') {
            this.nextTurn();
            return;
        }

        console.log(`${this.difficultyConfig.name} AI: Enemy ${enemy.id} executing turn`);

        const playerPos = this.playerTank.mesh.position.clone();
        const enemyPos = enemy.mesh.position.clone();
        const distanceToPlayer = enemyPos.distanceTo(playerPos);

        // Update AI knowledge
        enemy.lastKnownPlayerPosition = playerPos.clone();
        enemy.turnsSinceLastShot++;

        // Advanced AI decision making
        const aiDecision = this.makeAIDecision(enemy, playerPos, distanceToPlayer);

        this.ui.updateActionIndicator(`Enemy is ${aiDecision.action}...`);        // Execute AI decision
        this.executeAIDecision(enemy, aiDecision);

        // End turn with appropriate delay - aggressive AI acts faster
        const baseDelay = Math.max(800, 2000 - (this.difficultyConfig.strategicThinking * 1200));
        const aggressivenessSpeedup = this.difficultyConfig.aggressiveness >= 1.0 ? 0.4 : 
                                     (this.difficultyConfig.aggressiveness > 0.7 ? 0.7 : 1.0);
        const turnDelay = Math.max(400, baseDelay * aggressivenessSpeedup);
        setTimeout(() => {
            // Check for win condition before proceeding to next turn
            this.checkWinCondition();
            if (this.gameState !== 'GAME_OVER') {
                this.nextTurn();
            }
        }, turnDelay);
    }    // AI decision making using collision system for line of sight checks
    makeAIDecision(enemy, playerPos, distanceToPlayer) {
        const config = enemy.aiDifficulty;
        const enemyPos = enemy.mesh.position.clone();

        // Use collision system for more accurate line of sight
        const lineOfSight = this.hasLineOfSight(enemyPos, playerPos);
        const inCover = this.isInCover(enemyPos);
        const playerInRange = distanceToPlayer <= 60;
        const hasAmmo = !enemy.hasFiredThisTurn;
        const lowHealth = enemy.currentHealth < enemy.maxHealth * 0.4;
        const lowFuel = enemy.currentFuel < enemy.maxFuel * 0.3;

        // Aggressiveness affects decision making
        const isAggressive = config.aggressiveness > 0.7;
        const isVeryAggressive = config.aggressiveness >= 1.0;        // Strategic decision matrix based on difficulty
        let decision = { action: 'thinking', priority: 0 };

        // HIGHEST PRIORITY: Always shoot at player if ammo is available
        if (hasAmmo) {
            // Tanks will always attempt to shoot at the player every turn
            const baseAccuracy = Math.max(0.2, config.aimAccuracy * 0.8);
            decision = {
                action: 'engaging target',
                type: 'shoot',
                accuracy: baseAccuracy,
                priority: 10
            };
        }        // Emergency retreat if low health (only if already fired this turn)
        if (!hasAmmo && lowHealth && config.strategicThinking > 0.5 && decision.priority < 8) {
            const retreatChance = isVeryAggressive ? 0.3 : (isAggressive ? 0.6 : 1.0);
            
            if (Math.random() < retreatChance) {
                const coverPosition = this.findBestCover(enemyPos, playerPos);
                if (coverPosition && !inCover) {
                    decision = {
                        action: 'retreating to cover',
                        type: 'move',
                        target: coverPosition,
                        priority: 8
                    };
                }
            }
        }

        // AGGRESSIVE PURSUIT: Very aggressive AI pursues player more actively (only if already fired)
        if (!hasAmmo && isVeryAggressive && distanceToPlayer > 20 && decision.priority < 8) {
            const pursuitPosition = this.getAggressivePosition(enemyPos, playerPos, distanceToPlayer);
            if (pursuitPosition) {
                decision = {
                    action: 'pursuing target aggressively',
                    type: 'move',
                    target: pursuitPosition,
                    priority: 8
                };
            }
        }        // Medium priority: Tactical positioning (only if already fired)
        if (!hasAmmo && config.strategicThinking > 0.6 && decision.priority < 7) {
            const seekCoverChance = Math.max(0.2, config.coverUsage - (config.aggressiveness * 0.5));
            
            if (!inCover && seekCoverChance > Math.random()) {
                const coverPosition = this.findBestCover(enemyPos, playerPos);
                if (coverPosition) {
                    decision = {
                        action: 'seeking tactical position',
                        type: 'move',
                        target: coverPosition,
                        priority: 7
                    };
                }
            } else if (distanceToPlayer > 40 && !lineOfSight) {
                const flankPosition = this.findFlankingPosition(enemyPos, playerPos);
                if (flankPosition) {
                    decision = {
                        action: 'flanking target',
                        type: 'move',
                        target: flankPosition,
                        priority: 6
                    };
                }
            }
        }

        // Aggressive movement: Get closer for better shots (only if already fired)
        if (!hasAmmo && isAggressive && decision.priority < 6) {
            const aggressiveDistance = isVeryAggressive ? 15 : 20; // Closer engagement distance
            
            if (distanceToPlayer > aggressiveDistance + 10) {
                decision = {
                    action: 'closing distance aggressively',
                    type: 'move',
                    target: this.getPositionTowards(enemyPos, playerPos, aggressiveDistance),
                    priority: 6
                };
            }
        }        // Low priority: Basic movement (only if already fired)
        if (!hasAmmo && decision.priority < 5) {
            const idealDistance = isAggressive ? 20 : 25; // Aggressive AI prefers closer combat
            
            if (distanceToPlayer > idealDistance + 15) {
                decision = {
                    action: 'advancing on target',
                    type: 'move',
                    target: this.getPositionTowards(enemyPos, playerPos, idealDistance),
                    priority: 4
                };
            } else if (distanceToPlayer < idealDistance - 5 && !isVeryAggressive) {
                // Very aggressive AI doesn't back away
                decision = {
                    action: 'maintaining distance',
                    type: 'move',
                    target: this.getPositionAway(enemyPos, playerPos, idealDistance),
                    priority: 3
                };
            }
        }

        // Fallback: Wait and aim (only if already fired)
        if (!hasAmmo && decision.priority < 3) {
            decision = {
                action: isAggressive ? 'preparing to strike' : 'aiming',
                type: 'aim',
                priority: 1
            };
        }

        return decision;
    }    executeAIDecision(enemy, decision) {
        const config = enemy.aiDifficulty;

        switch (decision.type) {
            case 'shoot':
                this.executeAIShoot(enemy, decision.accuracy);
                break;

            case 'move':
                this.executeAIMove(enemy, decision.target);
                break;

            case 'aim':
                this.executeAIAim(enemy);
                break;

            default:
                console.log(`AI ${enemy.id}: No valid decision type, defaulting to aim`);
                this.executeAIAim(enemy);
                break;
        }
    }executeAIShoot(enemy, baseAccuracy) {
        const playerPos = this.playerTank.mesh.position.clone();
        const enemyPos = enemy.mesh.position.clone();
        const config = enemy.aiDifficulty;

        // Aim at target horizontally
        enemy.aimTowards(playerPos);

        // Calculate proper ballistics
        const distance = enemyPos.distanceTo(playerPos);
        const heightDiff = playerPos.y - enemyPos.y;

        // Aggressive AI uses higher power for more devastating shots
        const powerMultiplier = config.aggressiveness >= 1.0 ? 1.2 : 1.0;
        
        // Start with a reasonable power estimate based on distance
        let estimatedPower = Math.min(enemy.maxPower, Math.max(enemy.minPower, distance * 1.5 * powerMultiplier + 20));
        enemy.currentPower = estimatedPower;

        // Calculate physics-based elevation with current power
        const optimalElevation = this.calculatePhysicsBasedElevation(distance, heightDiff, enemy);

        // Now recalculate optimal power for this elevation and distance
        const optimalPower = this.calculateOptimalPower(distance, optimalElevation, enemy);
        enemy.currentPower = optimalPower;

        // Apply accuracy scatter based on difficulty
        const accuracyFactor = baseAccuracy;
        const maxScatter = (1 - accuracyFactor) * 0.15;

        // Add scatter to elevation
        const elevationScatter = (Math.random() - 0.5) * maxScatter;
        const finalElevation = optimalElevation + elevationScatter;

        // Set barrel elevation
        const targetElevation = Math.max(
            enemy.minBarrelElevation,
            Math.min(enemy.maxBarrelElevation, finalElevation)
        );

        const elevationDifference = targetElevation - enemy.barrelElevation;
        enemy.elevateBarrel(elevationDifference);

        // Add horizontal scatter for turret aiming
        if (accuracyFactor < 1.0) {
            const horizontalScatter = (Math.random() - 0.5) * maxScatter * 0.3;
            enemy.rotateTurret(horizontalScatter);
        }

        // Add small power variation for realism
        const powerVariation = (Math.random() - 0.5) * maxScatter * 10;
        enemy.currentPower = Math.max(enemy.minPower, Math.min(enemy.maxPower, enemy.currentPower + powerVariation));

        // Shoot
        enemy.shoot();
        enemy.turnsSinceLastShot = 0;

        console.log(`AI ${enemy.id}: Distance ${distance.toFixed(1)}m, Elevation ${(targetElevation * 180 / Math.PI).toFixed(1)}°, Power ${enemy.currentPower.toFixed(1)}, Accuracy ${(accuracyFactor * 100).toFixed(1)}%`);
    }    // Enhanced Physics-based ballistics calculation
    calculatePhysicsBasedElevation(distance, heightDiff, tank) {
        const g = 9.81 * 2; // Match projectile gravity
        const v0 = this.calculateProjectileSpeed(tank.currentPower || 50, tank);

        // Account for air resistance in calculations
        const effectiveV0 = v0 * 0.95; // Reduce effective velocity due to air resistance

        const horizontalDistance = Math.sqrt(Math.max(1, distance * distance - heightDiff * heightDiff));

        // Enhanced ballistic equation accounting for air resistance and wind
        const a = g * horizontalDistance * horizontalDistance;
        const b = -2 * effectiveV0 * effectiveV0 * horizontalDistance;
        const c = g * horizontalDistance * horizontalDistance + 2 * effectiveV0 * effectiveV0 * heightDiff;

        const discriminant = b * b - 4 * a * c;

        if (discriminant < 0) {
            // Fallback to empirical elevation based on distance
            return this.getEmpiricalElevation(distance, heightDiff);
        }

        const tan1 = (-b + Math.sqrt(discriminant)) / (2 * a);
        const tan2 = (-b - Math.sqrt(discriminant)) / (2 * a);

        const angle1 = Math.atan(tan1);
        const angle2 = Math.atan(tan2);

        // Choose the lower trajectory for better accuracy
        let preferredAngle = (Math.abs(angle1) < Math.abs(angle2)) ? angle1 : angle2;

        // Apply range-based adjustments
        if (distance > 40) {
            preferredAngle += Math.PI / 36; // Add slight elevation for long range
        }

        // Terrain consideration - add elevation if shooting uphill
        if (heightDiff > 2) {
            preferredAngle += heightDiff * 0.01;
        }

        // Clamp to realistic limits
        preferredAngle = Math.max(-Math.PI / 12, Math.min(Math.PI / 3, preferredAngle));

        return preferredAngle;
    }

    getEmpiricalElevation(distance, heightDiff) {
        // Improved empirical elevation table
        let baseElevation;

        if (distance < 8) baseElevation = Math.PI / 72;      // 2.5°
        else if (distance < 15) baseElevation = Math.PI / 36; // 5°
        else if (distance < 25) baseElevation = Math.PI / 24; // 7.5°
        else if (distance < 35) baseElevation = Math.PI / 18; // 10°
        else if (distance < 45) baseElevation = Math.PI / 15; // 12°
        else if (distance < 55) baseElevation = Math.PI / 12; // 15°
        else baseElevation = Math.PI / 9;                     // 20°

        // Height difference adjustment
        const heightAdjustment = Math.atan2(heightDiff, distance);

        return baseElevation + heightAdjustment;
    }

    calculateProjectileSpeed(power, tank) {
        const powerRatio = (power - tank.minPower) / (tank.maxPower - tank.minPower);
        return tank.minProjectileSpeed + powerRatio * (tank.maxProjectileSpeed - tank.minProjectileSpeed);
    } calculateOptimalPower(distance, elevation, tank) {
        const g = 9.81 * 2; // Match projectile gravity
        const airResistanceFactor = 0.95; // Account for air resistance

        // Enhanced power calculation considering air resistance and terrain
        const horizontalDistance = distance * Math.cos(Math.atan2(Math.abs(elevation * distance * 0.1), distance));

        let requiredV0;

        if (Math.abs(elevation) < 0.1) {
            // Flat trajectory calculation
            const effectiveAngle = Math.max(0.05, Math.abs(elevation));
            requiredV0 = Math.sqrt((g * horizontalDistance) / Math.sin(2 * effectiveAngle));
        } else {
            // Angled trajectory calculation with enhanced physics
            const cosElevation = Math.cos(elevation);
            const sinElevation = Math.sin(elevation);

            // Improved ballistic formula
            const term1 = g * horizontalDistance / (cosElevation * cosElevation);
            const term2 = 2 * (sinElevation + Math.sqrt(sinElevation * sinElevation + (g * horizontalDistance) / (2 * cosElevation * cosElevation)));

            requiredV0 = Math.sqrt(term1 / term2);
        }

        // Adjust for air resistance - projectiles need more initial speed
        requiredV0 = requiredV0 / airResistanceFactor;

        // Distance-based power boost for long range shots
        if (distance > 40) {
            requiredV0 *= 1.1;
        }

        // Clamp to tank's velocity limits
        requiredV0 = Math.max(tank.minProjectileSpeed, Math.min(tank.maxProjectileSpeed * 1.15, requiredV0));

        // Convert velocity back to power percentage
        const powerRange = tank.maxPower - tank.minPower;
        const velocityRange = tank.maxProjectileSpeed - tank.minProjectileSpeed;
        const powerRatio = (requiredV0 - tank.minProjectileSpeed) / velocityRange;
        const calculatedPower = tank.minPower + powerRatio * powerRange;

        // Ensure minimum power for the distance
        const minPowerForDistance = Math.min(tank.maxPower, Math.max(tank.minPower, distance * 1.0 + 10));
        const finalPower = Math.max(minPowerForDistance, calculatedPower);

        return Math.max(tank.minPower, Math.min(tank.maxPower, finalPower));
    }    executeAIMove(enemy, targetPosition) {
        if (!targetPosition || enemy.currentFuel <= 0) return;

        const enemyPos = enemy.mesh.position.clone();
        const direction = targetPosition.clone().sub(enemyPos).normalize();
        const config = enemy.aiDifficulty;
        
        // Aggressive AI moves further and more boldly
        const aggressivenessBonus = config.aggressiveness >= 1.0 ? 1.3 : (config.aggressiveness > 0.7 ? 1.15 : 1.0);
        
        const moveDistance = Math.min(
            (enemy.currentFuel / 20) * aggressivenessBonus,
            enemyPos.distanceTo(targetPosition)
        );

        const fuelEfficiency = enemy.aiDifficulty.fuelEfficiency;
        const actualMoveDistance = moveDistance * fuelEfficiency;

        for (let i = 0; i < 5 && enemy.currentFuel > 0; i++) {
            enemy.move(direction, actualMoveDistance / 5);
        }
    }    executeAIAim(enemy) {
        const playerPos = this.playerTank.mesh.position.clone();
        const config = enemy.aiDifficulty;
        
        // Aggressive AI aims with predictive targeting
        let targetPos = playerPos.clone();
        
        // Predictive aiming for aggressive AI - tries to anticipate player movement
        if (config.aggressiveness >= 1.0) {
            // Predict player movement based on recent position changes
            if (enemy.lastKnownPlayerPosition) {
                const playerMovement = playerPos.clone().sub(enemy.lastKnownPlayerPosition);
                const movementMagnitude = playerMovement.length();
                
                // If player is moving, lead the target
                if (movementMagnitude > 1) {
                    const leadFactor = Math.min(2, movementMagnitude * 0.5);
                    targetPos.add(playerMovement.normalize().multiplyScalar(leadFactor));
                }
            }
        }
        
        enemy.aimTowards(targetPos);

        const distance = enemy.mesh.position.distanceTo(targetPos);
        const heightDiff = targetPos.y - enemy.mesh.position.y;

        // Aggressive AI uses higher power multipliers for more devastating shots
        const powerMultiplier = config.aggressiveness >= 1.0 ? 1.2 : (config.aggressiveness > 0.7 ? 1.1 : 1.0);
        const estimatedPower = Math.min(enemy.maxPower, Math.max(enemy.minPower, distance * 1.5 * powerMultiplier + 20));
        enemy.currentPower = estimatedPower;

        const optimalElevation = this.calculatePhysicsBasedElevation(distance, heightDiff, enemy);

        const targetElevation = Math.max(
            enemy.minBarrelElevation,
            Math.min(enemy.maxBarrelElevation, optimalElevation)
        );

        const elevationDiff = targetElevation - enemy.barrelElevation;
        
        // Aggressive AI aims faster and more decisively
        const aimSpeed = config.aggressiveness >= 1.0 ? 0.35 : (config.aggressiveness > 0.7 ? 0.25 : 0.2);
        const elevationStep = Math.sign(elevationDiff) * Math.min(Math.abs(elevationDiff), enemy.barrelElevateSpeed * aimSpeed);
        enemy.elevateBarrel(elevationStep);
        
        // Store current player position for predictive aiming next turn
        enemy.lastKnownPlayerPosition = playerPos.clone();
    }

    // AI Helper Functions - Updated to use collision system
    hasLineOfSight(fromPos, toPos) {
        if (!this.collisionSystem) {
            // Fallback to old method if collision system not available
            const direction = toPos.clone().sub(fromPos).normalize();
            const distance = fromPos.distanceTo(toPos);

            const raycaster = new THREE.Raycaster(fromPos, direction, 0, distance);
            const obstacles = [
                ...this.buildings.filter(b => !b.userData.isDestroyed),
                ...this.trees.filter(t => !t.userData.isDestroyed)
            ];

            const intersects = raycaster.intersectObjects(obstacles, true);
            return intersects.length === 0;
        }

        // Use collision system for more accurate line of sight
        const direction = toPos.clone().sub(fromPos).normalize();
        const distance = fromPos.distanceTo(toPos);
        const steps = Math.ceil(distance / 2); // Check every 2 units

        for (let i = 1; i < steps; i++) {
            const checkPos = fromPos.clone().add(direction.clone().multiplyScalar((distance / steps) * i));
            const collision = this.collisionSystem.checkStaticCollisions(checkPos, 0.5);
            if (collision.hasCollision) {
                return false;
            }
        }

        return true;
    }

    isInCover(position) {
        if (!this.collisionSystem) {
            // Fallback
            const coverDistance = 3;
            for (const building of this.buildings) {
                if (building.userData.isDestroyed) continue;
                if (position.distanceTo(building.position) < coverDistance) {
                    return true;
                }
            }
            return false;
        }

        // Use collision system
        const collision = this.collisionSystem.checkStaticCollisions(position, 3);
        return collision.hasCollision;
    }

    findBestCover(fromPos, threatPos) {
        let bestCover = null;
        let bestScore = 0;

        for (const building of this.buildings) {
            if (building.userData.isDestroyed) continue;

            const coverPos = building.position.clone();
            const distanceToThreat = coverPos.distanceTo(threatPos);
            const distanceToSelf = coverPos.distanceTo(fromPos);

            const score = (distanceToThreat / 10) - (distanceToSelf / 20);

            if (score > bestScore && distanceToSelf > 3) {
                bestScore = score;
                bestCover = coverPos;
            }
        }

        return bestCover;
    }

    findFlankingPosition(fromPos, targetPos) {
        const perpendicular = new THREE.Vector3(
            -(targetPos.z - fromPos.z),
            0,
            targetPos.x - fromPos.x
        ).normalize();

        const flankDistance = 15;
        const leftFlank = fromPos.clone().add(perpendicular.clone().multiplyScalar(flankDistance));
        const rightFlank = fromPos.clone().add(perpendicular.clone().multiplyScalar(-flankDistance));

        if (this.hasLineOfSight(leftFlank, targetPos)) {
            return leftFlank;
        } else if (this.hasLineOfSight(rightFlank, targetPos)) {
            return rightFlank;
        }

        return null;
    }

    getPositionTowards(fromPos, targetPos, desiredDistance) {
        const direction = targetPos.clone().sub(fromPos).normalize();
        return fromPos.clone().add(direction.multiplyScalar(desiredDistance * 0.3));
    }

    getPositionAway(fromPos, targetPos, desiredDistance) {
        const direction = fromPos.clone().sub(targetPos).normalize();
        return fromPos.clone().add(direction.multiplyScalar(desiredDistance * 0.2));
    }

    calculateOptimalElevation(distance, heightDiff) {
        if (Math.abs(heightDiff) < 3) {
            if (distance < 10) return 0;
            if (distance < 20) return Math.PI / 36;
            if (distance < 30) return Math.PI / 18;
            if (distance < 40) return Math.PI / 12;
            if (distance < 50) return Math.PI / 9;
            return Math.PI / 6;
        }

        const horizontalDistance = Math.sqrt(Math.max(0, distance * distance - heightDiff * heightDiff));

        let baseElevation = Math.atan2(heightDiff, Math.max(horizontalDistance, 1));

        const arcAdjustment = (horizontalDistance / 60) * (Math.PI / 12);

        const calculatedElevation = baseElevation + arcAdjustment;

        return Math.max(-Math.PI / 24, Math.min(Math.PI / 4, calculatedElevation));
    }    calculateShootingAccuracy(enemy, targetPos, distance) {
        const config = enemy.aiDifficulty;
        let accuracy = 0.9;

        // Distance penalty (reduced for aggressive AI)
        const distancePenalty = config.aggressiveness >= 1.0 ? 
            Math.min(0.15, distance / 250) : // Colonel AI has less distance penalty
            Math.min(0.2, distance / 200);
        accuracy -= distancePenalty;

        // Fuel penalty (aggressive AI fights even when low on fuel)
        if (enemy.currentFuel < enemy.maxFuel * 0.8) {
            const fuelPenalty = config.aggressiveness >= 1.0 ? 0.02 : 0.05;
            accuracy -= fuelPenalty;
        }

        // Line of sight bonus (aggressive AI gets bigger bonus)
        if (this.hasLineOfSight(enemy.mesh.position, targetPos)) {
            const losBonus = config.aggressiveness >= 1.0 ? 0.15 : 0.1;
            accuracy += losBonus;
        }

        // Close range bonus (aggressive AI excels at close combat)
        if (distance < 20) {
            const closeBonus = config.aggressiveness >= 1.0 ? 0.25 : 0.15;
            accuracy += closeBonus;
        }

        // Aggressiveness bonus for taking risky shots
        if (config.aggressiveness >= 1.0) {
            accuracy += 0.1; // Colonel AI gets overall accuracy boost
        }

        // Set minimum accuracy based on aggressiveness
        const minAccuracy = config.aggressiveness >= 1.0 ? 0.4 : 0.3;
        return Math.max(minAccuracy, Math.min(1, accuracy));
    }endPlayerTurn() {
        if (this.gameState === 'PLAYER_TURN') {
            // Exit any active scope mode before ending turn
            // Exit desktop barrel scope if active
            if (window.mainApp && window.mainApp.exitBarrelScope) {
                window.mainApp.exitBarrelScope();
            }

            // Exit mobile scope if active
            if (this.mobileControls && this.mobileControls.exitMobileScope) {
                this.mobileControls.exitMobileScope();
            }

            this.nextTurn();
        }
    }

    handlePlayerInput(deltaTime) {
        // Check if we have any turret rotation input for audio handling
        const isRotatingTurret = this.inputStates.turretLeft || this.inputStates.turretRight;

        // Handle turret rotation sounds
        if (isRotatingTurret) {
            if (!this.audioManager.isContinuousSoundPlaying('turretRotate')) {
                console.log('DEBUG: Starting turretRotate sound');
                this.audioManager.playContinuousSound('turretRotate', 0.4);
            }
        } else {
            if (this.audioManager.isContinuousSoundPlaying('turretRotate')) {
                console.log('DEBUG: Stopping turretRotate sound');
                this.audioManager.stopContinuousSound('turretRotate');
            }
        }

        // Movement input handling
        if (this.inputStates.moveForward) {
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(this.playerTank.mesh.quaternion);
            this.playerTank.move(forward, deltaTime);
        }
        if (this.inputStates.moveBackward) {
            const backward = new THREE.Vector3(0, 0, -1);
            backward.applyQuaternion(this.playerTank.mesh.quaternion);
            this.playerTank.move(backward, deltaTime);
        }
        if (this.inputStates.rotateLeft) this.playerTank.rotateBody(this.playerTank.rotateSpeed * deltaTime);
        if (this.inputStates.rotateRight) this.playerTank.rotateBody(-this.playerTank.rotateSpeed * deltaTime);
        if (this.inputStates.turretLeft) this.playerTank.rotateTurret(this.playerTank.turretRotateSpeed * deltaTime);
        if (this.inputStates.turretRight) this.playerTank.rotateTurret(-this.playerTank.turretRotateSpeed * deltaTime);

        if (this.inputStates.fire) {
            this.playerTank.shoot();
            this.inputStates.fire = false;
        }
        if (this.inputStates.increasePower) {
            this.playerTank.adjustPower(this.playerTank.powerIncrement);
        }
        if (this.inputStates.decreasePower) {
            this.playerTank.adjustPower(-this.playerTank.powerIncrement);
        }
        if (this.inputStates.barrelUp) {
            const angleChange = this.playerTank.barrelElevateSpeed * deltaTime;
            console.log(`BARREL UP pressed: angleChange = ${(angleChange * 180 / Math.PI).toFixed(3)}°, deltaTime = ${deltaTime.toFixed(4)}`);
            this.playerTank.elevateBarrel(angleChange);
        }
        if (this.inputStates.barrelDown) {
            const angleChange = -this.playerTank.barrelElevateSpeed * deltaTime;
            console.log(`BARREL DOWN pressed: angleChange = ${(angleChange * 180 / Math.PI).toFixed(3)}°, deltaTime = ${deltaTime.toFixed(4)}`);
            this.playerTank.elevateBarrel(angleChange);
        }
    }

    update(deltaTime) {
        if (this.gameState === 'GAME_OVER' || this.gameState === 'DIFFICULTY_SELECTION') return;

        // Update collision system
        if (this.collisionSystem) {
            this.collisionSystem.update();
        }

        // Update mobile controls
        if (this.mobileControls) {
            this.mobileControls.update(deltaTime);
        }

        // Update projectiles using collision system
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            if (p.shouldBeRemoved) {
                this.scene.remove(p.mesh);
                this.projectiles.splice(i, 1);
            } else {
                // USE COLLISION SYSTEM INSTEAD OF OLD METHOD
                if (this.collisionSystem) {
                    const collisionResult = this.collisionSystem.checkProjectileCollisions(p); if (collisionResult.hasCollision) {
                        this.collisionSystem.applyCollisionEffects(collisionResult, p);
                        this.scene.remove(p.mesh);
                        this.projectiles.splice(i, 1);

                        // Update UI if tank was hit
                        if (collisionResult.type === 'tank') {
                            this.ui.updateHealth(collisionResult.tank.id, collisionResult.tank.currentHealth, collisionResult.tank.maxHealth);

                            // Check if this hit caused a tank to be destroyed
                            if (collisionResult.tank.isDestroyed) {
                                // Delay the check to let destruction animations play
                                setTimeout(() => {
                                    this.checkWinCondition();
                                }, 1000);
                            }
                        }
                    }
                } else {
                    // Fallback to old collision detection if collision system not available
                    this.checkProjectileCollision(p);
                }
            }
        }

        if (this.gameState === 'PLAYER_TURN' && this.activeTank === this.playerTank && !this.playerTank.isDestroyed) {
            this.handlePlayerInput(deltaTime);
            this.ui.updateFuel(this.playerTank.currentFuel, this.playerTank.maxFuel);
        }
        // Update all tanks
        this.playerTank.update(deltaTime, this.camera);
        this.enemyTanks.forEach(enemy => enemy.update(deltaTime, this.camera));

        // Handle tank movement audio
        const isMoving = this.inputStates.moveForward || this.inputStates.moveBackward;
        if (isMoving && this.gameState === 'PLAYER_TURN') {
            if (!this.audioManager.isContinuousSoundPlaying('tankMove')) {
                this.audioManager.playContinuousSound('tankMove', 0.3);
            }
        } else {
            if (this.audioManager.isContinuousSoundPlaying('tankMove')) {
                this.audioManager.stopContinuousSound('tankMove');
            }
        }
        // Input handling is now done in handlePlayerInput method
    } addProjectile(projectile) {
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);

        // Track shots fired for statistics
        if (this.gameStats) {
            this.gameStats.shotsFired++;
        }
    }

    /**
     * LEGACY COLLISION METHOD - Kept as fallback
     * This method is now only used if collision system is not available
     */
    checkProjectileCollision(projectile) {
        console.warn('Using legacy collision detection - collision system not available');

        const targets = projectile.firedByPlayer ? this.enemyTanks : [this.playerTank];

        // Check tank collisions
        for (const tank of targets) {
            if (tank.isDestroyed) continue;
            const distance = projectile.mesh.position.distanceTo(tank.mesh.position);
            if (distance < tank.collisionRadius + projectile.collisionRadius) {
                const hitPosition = projectile.mesh.position.clone();
                hitPosition.y = tank.mesh.position.y + 0.8;

                // Apply damage
                tank.takeDamage(projectile.damage);
                this.ui.updateHealth(tank.id, tank.currentHealth, tank.maxHealth);
                projectile.shouldBeRemoved = true;

                // After damage is applied, check if win condition achieved
                // We delay this check to allow animations to complete
                if (tank.isDestroyed) {
                    setTimeout(() => {
                        this.checkWinCondition();
                    }, 1000);
                }

                return;
            }
        }

        // Check building collisions
        for (const building of this.buildings) {
            if (building.userData.isDestroyed) continue;
            const distance = projectile.mesh.position.distanceTo(building.position);
            if (distance < building.userData.collisionRadius + projectile.collisionRadius) {
                const hitPosition = projectile.mesh.position.clone();

                if (this.particleSystem) {
                    this.particleSystem.createSmoke(hitPosition, 0.8);
                    this.particleSystem.createMetalDebris(hitPosition, 0.6);
                }

                this.damageBuilding(building, projectile);
                projectile.shouldBeRemoved = true;
                return;
            }
        }

        // Check tree collisions
        for (const tree of this.trees) {
            if (tree.userData.isDestroyed) continue;
            const distance = projectile.mesh.position.distanceTo(tree.position);
            if (distance < tree.userData.collisionRadius + projectile.collisionRadius) {
                const hitPosition = projectile.mesh.position.clone();

                if (this.particleSystem) {
                    this.particleSystem.createSmoke(hitPosition, 0.3);
                }

                this.destroyTree(tree, projectile);
                projectile.shouldBeRemoved = true;
                return;
            }
        }

        // Check collision with terrain
        const terrainHeightAtImpact = this.scene.userData.terrain.getHeightAt(
            projectile.mesh.position.x,
            projectile.mesh.position.z
        );
        if (projectile.mesh.position.y <= terrainHeightAtImpact + projectile.collisionRadius) {
            projectile.shouldBeRemoved = true;
            const craterDepth = 1.5;
            this.scene.userData.terrain.deformTerrain(projectile.mesh.position, 4, Math.abs(craterDepth));

            const hitPosition = projectile.mesh.position.clone();
            hitPosition.y = terrainHeightAtImpact + 0.2;

            if (this.particleSystem) {
                this.particleSystem.createSmoke(hitPosition, 0.5);
                this.particleSystem.createMetalDebris(hitPosition, 0.3);
            }

            if (this.audioManager) {
                this.audioManager.playSound('groundHit');
            }

            const dust = new THREE.Mesh(
                new THREE.SphereGeometry(1.5, 12, 12),
                new THREE.MeshStandardMaterial({
                    color: 0x964B00,
                    transparent: true,
                    opacity: 0.6,
                    roughness: 0.8
                })
            );
            dust.position.copy(hitPosition);
            this.scene.add(dust);
            setTimeout(() => this.scene.remove(dust), 500);
            return;
        }
    }

    createCameraShake(intensity, duration) {
        if (!this.cameraController || !this.camera) return;

        const originalPosition = this.camera.position.clone();
        const startTime = Date.now();

        const shakeCamera = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress >= 1) {
                this.camera.position.copy(originalPosition);
                return;
            }

            const currentIntensity = intensity * (1 - progress);
            const shakeX = (Math.random() - 0.5) * currentIntensity;
            const shakeY = (Math.random() - 0.5) * currentIntensity;
            const shakeZ = (Math.random() - 0.5) * currentIntensity;

            this.camera.position.copy(originalPosition);
            this.camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));

            requestAnimationFrame(shakeCamera);
        };

        shakeCamera();
    }

    // Building and Tree destruction methods (these can be called by collision system)
    damageBuilding(building, projectile) {
        if (building.userData.isDestroyed) return;

        building.userData.health -= projectile.damage;

        if (this.audioManager) {
            this.audioManager.playSound('hitBuilding');
        }

        const impact = new THREE.Mesh(
            new THREE.SphereGeometry(1.2, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 })
        );
        impact.position.copy(projectile.mesh.position);
        this.scene.add(impact);
        setTimeout(() => this.scene.remove(impact), 400);

        this.createBuildingDebris(projectile.mesh.position, 5);

        if (building.userData.health <= 0) {
            if (this.audioManager) {
                this.audioManager.playSound('hitBuilding');
            }
            this.destroyBuilding(building);
        }
    }

    destroyBuilding(building) {
        if (building.userData.isDestroyed) return;

        building.userData.isDestroyed = true;
        building.userData.health = 0;

        this.createBuildingDebris(building.position, 15);

        const collapseDuration = 3000;
        const startTime = Date.now();
        const originalScale = building.scale.clone();

        const animateCollapse = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / collapseDuration, 1);

            const scale = THREE.MathUtils.lerp(1, 0.1, progress);
            building.scale.set(scale, scale, scale);
            building.position.y = building.userData.originalPosition ?
                building.userData.originalPosition.y - (progress * 2) :
                building.position.y - (progress * 0.1);

            if (progress < 1) {
                requestAnimationFrame(animateCollapse);
            } else {
                this.scene.remove(building);
                const index = this.buildings.indexOf(building);
                if (index > -1) {
                    this.buildings.splice(index, 1);
                }
            }
        };

        animateCollapse();
    }

    createBuildingDebris(position, count = 8) {
        for (let i = 0; i < count; i++) {
            const debrisGeo = new THREE.BoxGeometry(
                Math.random() * 0.5 + 0.2,
                Math.random() * 0.8 + 0.3,
                Math.random() * 0.5 + 0.2
            );
            const debrisMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHSL(0, 0, 0.3 + Math.random() * 0.4),
                roughness: 0.9
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);

            debris.position.set(
                position.x + (Math.random() - 0.5) * 6,
                position.y + Math.random() * 3,
                position.z + (Math.random() - 0.5) * 6
            );

            debris.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            debris.castShadow = true;
            this.scene.add(debris);

            setTimeout(() => this.scene.remove(debris), 15000);
        }
    }

    destroyTree(tree, projectile) {
        if (tree.userData.isDestroyed) return;

        tree.userData.isDestroyed = true;
        tree.userData.health = 0;

        if (this.audioManager) {
            this.audioManager.playSound('hitTree');
        }

        const impactDirection = projectile.velocity.clone().normalize();
        impactDirection.y = 0;

        this.createTreeDebris(tree.position, 8);

        const fallDuration = 2000;
        const fallAngle = Math.PI / 2;
        const startTime = Date.now();
        const originalRotation = tree.rotation.clone();

        const animateFall = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fallDuration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            const fallAxis = Math.abs(impactDirection.x) > Math.abs(impactDirection.z) ? 'z' : 'x';
            const fallDirection = fallAxis === 'z' ? Math.sign(impactDirection.x) : Math.sign(impactDirection.z);

            if (fallAxis === 'z') {
                tree.rotation.z = originalRotation.z + (fallAngle * fallDirection * easedProgress);
            } else {
                tree.rotation.x = originalRotation.x + (fallAngle * fallDirection * easedProgress);
            }

            tree.position.y = tree.userData.originalPosition.y - (easedProgress * 0.5);

            if (progress < 1) {
                requestAnimationFrame(animateFall);
            } else {
                setTimeout(() => this.fadeOutTree(tree), 3000);
            }
        };

        animateFall();

        const crashEffect = new THREE.Mesh(
            new THREE.SphereGeometry(2, 8, 8),
            new THREE.MeshBasicMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.6
            })
        );
        crashEffect.position.copy(tree.position);
        this.scene.add(crashEffect);
        setTimeout(() => this.scene.remove(crashEffect), 800);
    }

    createTreeDebris(position, count = 6) {
        for (let i = 0; i < count; i++) {
            const debrisGeo = new THREE.BoxGeometry(
                Math.random() * 0.3 + 0.1,
                Math.random() * 0.5 + 0.2,
                Math.random() * 0.3 + 0.1
            );
            const debrisMat = new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.9
            });
            const debris = new THREE.Mesh(debrisGeo, debrisMat);

            debris.position.set(
                position.x + (Math.random() - 0.5) * 4,
                position.y + Math.random() * 2 + 1,
                position.z + (Math.random() - 0.5) * 4
            );

            debris.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            debris.castShadow = true;
            this.scene.add(debris);

            setTimeout(() => this.scene.remove(debris), 10000);
        }
    }

    fadeOutTree(tree) {
        const fadeDuration = 3000;
        const startTime = Date.now();

        const fadeAnimation = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            const opacity = 1 - progress;

            tree.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material.transparent = true;
                    child.material.opacity = opacity;
                }
            });

            if (progress < 1) {
                requestAnimationFrame(fadeAnimation);
            } else {
                this.scene.remove(tree);
                const index = this.trees.indexOf(tree);
                if (index > -1) {
                    this.trees.splice(index, 1);
                }
            }
        };

        fadeAnimation();
    }
    gameOver(playerWon, gameStats = {}) {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';

        console.log(`Game over! ${playerWon ? 'Player won' : 'Player lost'}`);

        // Merge provided gameStats with collected game statistics
        const finalGameStats = {
            ...gameStats,
            shotsFired: this.gameStats?.shotsFired || 0,
            tanksDestroyed: this.gameStats?.tanksDestroyed || 0,
            gameStartTime: this.gameStats?.gameStartTime || null
        };

        // Update user statistics if user is logged in
        this.updateUserStats(playerWon, finalGameStats);

        // Enhanced camera sequence with multiple phases
        if (this.cameraController) {
            this.createCinematicGameOverSequence(playerWon);
        }

        // Stop all game sounds and create audio atmosphere
        if (this.audioManager) {
            this.audioManager.stopAllContinuousSounds();
            this.audioManager.stopAllMusic();
            this.createGameOverAudio(playerWon);
        }

        // Create enhanced visual effects
        this.createGameOverVisualEffects(playerWon);

        // Show enhanced game over UI after cinematic sequence
        setTimeout(() => {
            this.showEnhancedGameOverUI(playerWon, finalGameStats);
        }, 2500);

        this.ui.toggleEndTurnButton(false);
    }

    createCinematicGameOverSequence(playerWon) {
        const totalDuration = 4000;
        const phase1Duration = 1500; // Initial dramatic pause
        const phase2Duration = 2500; // Camera movement

        const startPosition = this.camera.position.clone();
        const startRotation = this.camera.rotation.clone();
        const startTime = Date.now();

        // Phase 1: Dramatic pause with slight shake
        const phase1 = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < phase1Duration) {
                // Subtle camera shake for impact
                const intensity = playerWon ? 0.1 : 0.3;
                const shake = {
                    x: (Math.random() - 0.5) * intensity,
                    y: (Math.random() - 0.5) * intensity,
                    z: (Math.random() - 0.5) * intensity
                };

                this.camera.position.copy(startPosition.clone().add(shake));
                requestAnimationFrame(phase1);
            } else {
                // Reset position and start phase 2
                this.camera.position.copy(startPosition);
                phase2();
            }
        };

        // Phase 2: Cinematic camera movement
        const phase2 = () => {
            const elapsed = Date.now() - startTime - phase1Duration;
            const progress = Math.min(elapsed / phase2Duration, 1);

            // Different camera movements based on outcome
            if (playerWon) {
                // Victory: Rise up and look down at the battlefield
                const easedProgress = 1 - Math.pow(1 - progress, 2); // Quadratic easing
                const newPosition = startPosition.clone();
                newPosition.y += 25 * easedProgress;
                newPosition.z += 15 * easedProgress;

                // Slight downward tilt to survey the battlefield
                const newRotation = startRotation.clone();
                newRotation.x -= 0.3 * easedProgress;

                this.camera.position.copy(newPosition);
                this.camera.rotation.copy(newRotation);
            } else {
                // Defeat: Dramatic pull back and tilt
                const easedProgress = 1 - Math.pow(1 - progress, 3); // Cubic easing
                const newPosition = startPosition.clone();
                newPosition.y += 15 * easedProgress;
                newPosition.z += 20 * easedProgress;
                newPosition.x += 10 * Math.sin(progress * Math.PI) * easedProgress;

                this.camera.position.copy(newPosition);
            }

            if (progress < 1) {
                requestAnimationFrame(phase2);
            }
        };

        phase1();
    }

    createGameOverAudio(playerWon) {
        if (playerWon) {
            // Victory audio sequence
            setTimeout(() => this.audioManager.playSound('victory_fanfare'), 500);
            setTimeout(() => this.audioManager.playMusic('victory_theme', 0.7), 1000);
        } else {
            // Defeat audio sequence
            this.audioManager.playSound('tank_destruction');
            setTimeout(() => this.audioManager.playSound('explosion_large'), 300);
            setTimeout(() => this.audioManager.playSound('defeat_sting'), 800);
            setTimeout(() => this.audioManager.playMusic('defeat_theme', 0.5), 1500);
        }
    }

    createGameOverVisualEffects(playerWon) {
        // Create particle effect overlay
        this.createParticleEffect(playerWon);

        // Enhanced color overlay with animation
        this.createAnimatedOverlay(playerWon);

        // Screen flash effect
        this.createScreenFlash(playerWon);
    }

    createParticleEffect(playerWon) {
        const canvas = document.createElement('canvas');
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '45';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        const particles = [];
        const particleCount = playerWon ? 100 : 50;

        // Create particles
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * (playerWon ? 4 : 2),
                vy: (Math.random() - 0.5) * (playerWon ? 4 : 2),
                size: Math.random() * (playerWon ? 6 : 3) + 2,
                opacity: 1,
                color: playerWon ?
                    `hsl(${Math.random() * 60 + 40}, 100%, 70%)` : // Gold/yellow for victory
                    `hsl(${Math.random() * 30}, 100%, 50%)` // Red/orange for defeat
            });
        }

        const animateParticles = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((particle, index) => {
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.opacity -= 0.01;
                particle.size *= 0.995;

                if (particle.opacity <= 0) {
                    particles.splice(index, 1);
                    return;
                }

                ctx.save();
                ctx.globalAlpha = particle.opacity;
                ctx.fillStyle = particle.color;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            if (particles.length > 0) {
                requestAnimationFrame(animateParticles);
            } else {
                document.body.removeChild(canvas);
            }
        };

        setTimeout(animateParticles, 1000);
    }

    createAnimatedOverlay(playerWon) {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '40';
        overlay.style.opacity = '0';

        if (playerWon) {
            overlay.style.background = 'radial-gradient(circle, rgba(255,215,0,0.2) 0%, rgba(0,255,0,0.1) 50%, transparent 100%)';
        } else {
            overlay.style.background = 'radial-gradient(circle, rgba(255,0,0,0.3) 0%, rgba(139,0,0,0.2) 50%, transparent 100%)';
        }

        document.body.appendChild(overlay);

        // Animate overlay
        overlay.style.transition = 'opacity 1.5s ease-in-out';
        setTimeout(() => overlay.style.opacity = '1', 100);

        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => document.body.removeChild(overlay), 1500);
        }, 3000);
    }

    createScreenFlash(playerWon) {
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100%';
        flash.style.height = '100%';
        flash.style.backgroundColor = playerWon ? 'rgba(255,255,255,0.8)' : 'rgba(255,0,0,0.6)';
        flash.style.pointerEvents = 'none';
        flash.style.zIndex = '60';
        flash.style.opacity = '1';
        flash.style.transition = 'opacity 0.3s ease-out';
        document.body.appendChild(flash);

        setTimeout(() => {
            flash.style.opacity = '0';
            setTimeout(() => document.body.removeChild(flash), 300);
        }, 100);
    }

    showEnhancedGameOverUI(playerWon, gameStats) {
        // Create modern game over modal
        const modal = document.createElement('div');
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
        border: 2px solid ${playerWon ? '#FFD700' : '#FF4444'};
        border-radius: 20px;
        padding: 40px;
        text-align: center;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
        transform: scale(0.8);
        transition: transform 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

        const title = document.createElement('h1');
        title.textContent = playerWon ? '🏆 VICTORY!' : '💥 DEFEAT';
        title.style.cssText = `
        font-family: 'Arial Black', Arial, sans-serif;
        font-size: 3.5rem;
        margin: 0 0 20px 0;
        color: ${playerWon ? '#FFD700' : '#FF4444'};
        text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.7);
        letter-spacing: 3px;
    `;

        const subtitle = document.createElement('h2');
        const difficultyText = this.difficultyConfig?.name || 'Unknown';
        subtitle.textContent = playerWon ?
            `All Enemies Destroyed!` :
            `Your Tank Was Destroyed!`;
        subtitle.style.cssText = `
        font-family: Arial, sans-serif;
        font-size: 1.4rem;
        margin: 0 0 30px 0;
        color: #CCCCCC;
        font-weight: normal;
    `;

        const difficultyBadge = document.createElement('div');
        difficultyBadge.textContent = `${difficultyText} Difficulty`;
        difficultyBadge.style.cssText = `
        display: inline-block;
        background: ${playerWon ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'};
        border: 1px solid ${playerWon ? '#FFD700' : '#FF4444'};
        border-radius: 25px;
        padding: 8px 20px;
        margin: 0 0 30px 0;
        font-size: 1rem;
        color: ${playerWon ? '#FFD700' : '#FF4444'};
        font-weight: bold;
    `;

        // Add stats if provided
        const statsContainer = document.createElement('div');
        if (gameStats && Object.keys(gameStats).length > 0) {
            statsContainer.style.cssText = `
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        `;

            const statsTitle = document.createElement('h3');
            statsTitle.textContent = '📊 Battle Statistics';
            statsTitle.style.cssText = `
            color: #FFFFFF;
            margin: 0 0 15px 0;
            text-align: center;
            font-size: 1.3rem;
        `;
            statsContainer.appendChild(statsTitle);

            const statsList = [
                { label: 'Enemies Destroyed', value: gameStats.enemiesDestroyed || 0 },
                { label: 'Shots Fired', value: gameStats.shotsFired || 0 },
                { label: 'Accuracy', value: gameStats.accuracy || '0%' },
                { label: 'Survival Time', value: gameStats.survivalTime || '0:00' }
            ];

            statsList.forEach(stat => {
                const statRow = document.createElement('div');
                statRow.style.cssText = `
                display: flex;
                justify-content: space-between;
                margin: 8px 0;
                color: #CCCCCC;
                font-size: 1rem;
            `;
                statRow.innerHTML = `<span>${stat.label}:</span><span style="color: ${playerWon ? '#FFD700' : '#FF4444'}; font-weight: bold;">${stat.value}</span>`;
                statsContainer.appendChild(statRow);
            });
        }

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
        margin-top: 30px;
        display: flex;
        gap: 15px;
        justify-content: center;
    `; const userMenu = this.createStyledButton('User Menu', '#4CAF50', () => {
            document.body.removeChild(modal);
            // Show user statistics page
            if (this.ui && typeof this.ui.showUserStatistics === 'function') {
                this.ui.showUserStatistics();
            } else {
                console.warn('UI showUserStatistics method not available');
            }
        });

        const menuBtn = this.createStyledButton('Difficulty Menu', '#2196F3', () => {
            document.body.removeChild(modal);
            this.ui.showDifficultySelector();
        });

        buttonContainer.appendChild(userMenu);
        buttonContainer.appendChild(menuBtn);

        content.appendChild(title);
        content.appendChild(subtitle);
        content.appendChild(difficultyBadge);
        if (statsContainer.children.length > 0) {
            content.appendChild(statsContainer);
        }
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
    } checkWinCondition() {
        // Return early if the game is already in GAME_OVER state
        if (this.gameState === 'GAME_OVER') return;

        // Check if player's tank is destroyed
        if (this.playerTank.isDestroyed) {
            // Player loses - pass current game statistics
            const gameStats = {
                shotsFired: this.gameStats?.shotsFired || 0,
                tanksDestroyed: this.gameStats?.tanksDestroyed || 0,
                gameStartTime: this.gameStats?.gameStartTime || null
            };
            this.gameOver(false, gameStats);
            return;
        }

        // Check if all enemy tanks are destroyed
        const allEnemiesDestroyed = this.enemyTanks.every(tank => tank.isDestroyed);
        if (allEnemiesDestroyed) {
            // Player wins - pass current game statistics
            const gameStats = {
                shotsFired: this.gameStats?.shotsFired || 0,
                tanksDestroyed: this.gameStats?.tanksDestroyed || 0,
                gameStartTime: this.gameStats?.gameStartTime || null
            };
            this.gameOver(true, gameStats);
            return;
        }
    }

    setupInputListeners() {
        document.addEventListener('keydown', (event) => {
            if (this.gameState !== 'PLAYER_TURN') return;
            switch (event.code) {
                case 'KeyW': this.inputStates.moveForward = true; break;
                case 'KeyS': this.inputStates.moveBackward = true; break;
                case 'KeyA': this.inputStates.rotateLeft = true; break;
                case 'KeyD': this.inputStates.rotateRight = true; break;
                case 'KeyQ': this.inputStates.turretLeft = true; break;
                case 'KeyE': this.inputStates.turretRight = true; break;
                case 'Space':
                    if (!this.playerTank.hasFiredThisTurn) {
                        this.inputStates.fire = true;
                    } else {
                        // If player has already fired, spacebar ends the turn
                        this.endPlayerTurn();
                    }
                    break;
                case 'ArrowUp': this.inputStates.increasePower = true; break;
                case 'ArrowDown': this.inputStates.decreasePower = true; break;
                case 'ArrowRight':
                    console.log('ArrowRight pressed - setting barrelUp = true');
                    this.inputStates.barrelUp = true;
                    break;
                case 'ArrowLeft':
                    console.log('ArrowLeft pressed - setting barrelDown = true');
                    this.inputStates.barrelDown = true;
                    break;
                case 'KeyH': this.toggleControlsInfo(); break;
            }
        });

        document.addEventListener('keyup', (event) => {
            if (this.gameState !== 'PLAYER_TURN') return;
            switch (event.code) {
                case 'KeyW': this.inputStates.moveForward = false; break;
                case 'KeyS': this.inputStates.moveBackward = false; break;
                case 'KeyA': this.inputStates.rotateLeft = false; break;
                case 'KeyD': this.inputStates.rotateRight = false; break;
                case 'KeyQ': this.inputStates.turretLeft = false; break;
                case 'KeyE': this.inputStates.turretRight = false; break;
                case 'ArrowUp': this.inputStates.increasePower = false; break;
                case 'ArrowDown': this.inputStates.decreasePower = false; break;
                case 'ArrowRight':
                    console.log('ArrowRight released - setting barrelUp = false');
                    this.inputStates.barrelUp = false;
                    break;
                case 'ArrowLeft':
                    console.log('ArrowLeft released - setting barrelDown = false');
                    this.inputStates.barrelDown = false;
                    break;
            }
        });
    }

    setupControlsInfo() {
        setTimeout(() => {
            this.hideControlsInfo();
        }, 10000);
    }

    toggleControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        if (controlsInfo.classList.contains('hidden')) {
            this.showControlsInfo();
        } else {
            this.hideControlsInfo();
        }
    }

    hideControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        controlsInfo.classList.add('hidden');
    }

    showControlsInfo() {
        const controlsInfo = document.getElementById('controls-info');
        controlsInfo.classList.remove('hidden');
    }

    updateUserStats(playerWon, gameStats = {}) {
        const authManager = window.mainAppInstance?.authManager;
        const currentUser = authManager?.getCurrentUser();

        if (!currentUser) {
            console.warn('No user logged in, stats not saved');
            return;
        }

        try {
            // Get current user data
            let userData = localStorage.getItem('tankGame_userData');
            let userRecord = userData ? JSON.parse(userData) : null;

            if (!userRecord || userRecord.uid !== currentUser.uid) {
                console.warn('User data not found or mismatch');
                return;
            }

            // Update statistics
            if (!userRecord.resources) {
                userRecord.resources = {
                    victories: 0,
                    defeats: 0,
                    gamesPlayed: 0,
                    shotsFired: 0,
                    tanksDestroyed: 0,
                    experience: 0,
                    level: 1
                };
            }

            // Update game stats
            userRecord.resources.gamesPlayed += 1;

            if (playerWon) {
                userRecord.resources.victories += 1;
                userRecord.resources.experience += 100; // Victory bonus
            } else {
                userRecord.resources.defeats += 1;
                userRecord.resources.experience += 25; // Participation points
            }

            // Add additional stats if provided
            if (gameStats.shotsFired) {
                userRecord.resources.shotsFired += gameStats.shotsFired;
                userRecord.resources.experience += gameStats.shotsFired * 2; // 2 exp per shot
            }

            if (gameStats.tanksDestroyed) {
                userRecord.resources.tanksDestroyed += gameStats.tanksDestroyed;
                userRecord.resources.experience += gameStats.tanksDestroyed * 50; // 50 exp per tank destroyed
            }

            // Level up calculation
            const newLevel = Math.floor(userRecord.resources.experience / 1000) + 1;
            if (newLevel > userRecord.resources.level) {
                userRecord.resources.level = newLevel;
                this.showLevelUpNotification(newLevel);
            }

            // Save updated data
            localStorage.setItem('tankGame_userData', JSON.stringify(userRecord));
            console.log('User stats updated:', userRecord.resources);

        } catch (error) {
            console.error('Failed to update user stats:', error);
        }
    }

    showLevelUpNotification(newLevel) {
        // Create level up notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #FFD700, #FFA500);
            color: #000;
            padding: 20px 30px;
            border-radius: 15px;
            font-size: 1.5rem;
            font-weight: bold;
            text-align: center;
            z-index: 200;
            box-shadow: 0 10px 30px rgba(255, 215, 0, 0.5);
            animation: levelUpPulse 2s ease-in-out;
        `;

        notification.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 10px;">🎉</div>
            <div>LEVEL UP!</div>
            <div style="font-size: 1.2rem; margin-top: 5px;">Level ${newLevel}</div>
        `;

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes levelUpPulse {
                0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(notification);
            document.head.removeChild(style);
        }, 3000);
    }

    getAggressivePosition(fromPos, targetPos, distance) {
        // Aggressive AI tries to get closer while maintaining some tactical positioning
        const direction = targetPos.clone().sub(fromPos).normalize();
        
        // Try to get closer but with some variation to avoid predictability
        const aggressiveDistance = Math.max(10, distance * 0.6); // Get significantly closer
        const sideOffset = (Math.random() - 0.5) * 10; // Add some lateral movement
        
        // Create perpendicular vector for side movement
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
        
        // Calculate aggressive position
        const aggressivePos = fromPos.clone()
            .add(direction.multiplyScalar(aggressiveDistance * 0.4))
            .add(perpendicular.multiplyScalar(sideOffset));
        
        // Ensure position is not too close (minimum 8 units)
        if (aggressivePos.distanceTo(targetPos) < 8) {
            const safeDirection = fromPos.clone().sub(targetPos).normalize();
            return targetPos.clone().add(safeDirection.multiplyScalar(8));
        }
        
        return aggressivePos;
    }

    /**
     * Comprehensive cleanup method for "play again" functionality
     * Removes all game entities from scene and resets game state
     */
    cleanupExistingGame() {
        console.log('Performing comprehensive game cleanup for restart...');

        // Stop all audio
        if (this.audioManager) {
            this.audioManager.stopAllContinuousSounds();
            this.audioManager.stopAllMusic();
        }

        // Remove player tank from scene
        if (this.playerTank && this.playerTank.mesh) {
            this.scene.remove(this.playerTank.mesh);
            this.playerTank = null;
        }

        // Remove all enemy tanks from scene
        this.enemyTanks.forEach(tank => {
            if (tank && tank.mesh) {
                this.scene.remove(tank.mesh);
            }
        });
        this.enemyTanks = [];

        // Remove all projectiles from scene
        this.projectiles.forEach(projectile => {
            if (projectile && projectile.mesh) {
                this.scene.remove(projectile.mesh);
            }
        });
        this.projectiles = [];

        // Remove all buildings from scene
        this.buildings.forEach(building => {
            if (building) {
                this.scene.remove(building);
            }
        });
        this.buildings = [];

        // Remove all trees from scene
        this.trees.forEach(tree => {
            if (tree) {
                this.scene.remove(tree);
            }
        });
        this.trees = [];

        // Clear any debris or temporary objects (search for objects with specific userData)
        const objectsToRemove = [];
        this.scene.traverse((child) => {
            // Remove any debris, particles, or temporary effects
            if (child.userData && (
                child.userData.isDebris || 
                child.userData.isTempEffect ||
                child.userData.isProjectileEffect ||
                child.userData.isExplosion
            )) {
                objectsToRemove.push(child);
            }
        });

        objectsToRemove.forEach(obj => {
            if (obj.parent) {
                obj.parent.remove(obj);
            }
        });

        // Reset collision system
        if (this.collisionSystem) {
            this.collisionSystem.destroy?.(); // Call destroy method if it exists
            this.collisionSystem = null;
        }

        // Reset game state variables
        this.currentPlayerIndex = -1;
        this.activeTank = null;
        this.gameState = 'INITIALIZING';
        
        // Reset game statistics
        this.gameStats = {
            shotsFired: 0,
            tanksDestroyed: 0,
            gameStartTime: null
        };

        // Clear any input states
        Object.keys(this.inputStates).forEach(key => {
            this.inputStates[key] = false;
        });

        // Clear mobile controls state
        if (this.mobileControls) {
            this.mobileControls.clearAllInputStates();
        }

        console.log('Game cleanup completed. Scene objects removed:', objectsToRemove.length);
    }

}