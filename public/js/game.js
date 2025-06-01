import * as THREE from 'three';
import { Tank } from './tank.js';
import { Projectile } from './projectile.js';
import { generateTrees, generateBuildings } from './sceneSetup.js';
import { ParticleSystem } from './particleSystem.js';
import { MobileControls } from './mobileControls.js';
import { CollisionSystem } from './collisionSystem.js'; // Import the new collision system


const PLAYER_ID = 'player';
const ENEMY_ID_PREFIX = 'enemy_';

// Difficulty configurations
const DIFFICULTY_SETTINGS = {
    beginner: {
        name: "New Player",
        aiReactionTime: 2000,
        aimAccuracy: 0.3,
        strategicThinking: 0.2,
        aggressiveness: 0.3,
        fuelEfficiency: 0.6,
        coverUsage: 0.3,
        playerHealthBonus: 50,
        playerFuelBonus: 50
    },
    professional: {
        name: "Professional",
        aiReactionTime: 1200,
        aimAccuracy: 0.7,
        strategicThinking: 0.6,
        aggressiveness: 0.6,
        fuelEfficiency: 0.8,
        coverUsage: 0.7,
        playerHealthBonus: 0,
        playerFuelBonus: 0
    },
    veteran: {
        name: "Veteran",
        aiReactionTime: 600,
        aimAccuracy: 0.95,
        strategicThinking: 0.9,
        aggressiveness: 0.8,
        fuelEfficiency: 0.95,
        coverUsage: 0.9,
        playerHealthBonus: -25,
        playerFuelBonus: -25    }
};

// Make mobile controls accessible globally for testing
window.forceMobileControls = function() {
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
        this.trees = [];

        this.currentPlayerIndex = -1;
        this.activeTank = null;
        this.cameraController = null;
        this.difficulty = 'professional';
        this.difficultyConfig = DIFFICULTY_SETTINGS.professional;

        this.gameState = 'DIFFICULTY_SELECTION';

        // Initialize particle system
        this.particleSystem = new ParticleSystem(this.scene);

        // Initialize collision system (WILL BE SET AFTER SCENE SETUP)
        this.collisionSystem = null;

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
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.difficultyConfig = DIFFICULTY_SETTINGS[difficulty];
        console.log(`Difficulty set to: ${this.difficultyConfig.name}`);
        this.startGameInitialization();
    }

    async startGameInitialization() {
        this.gameState = 'INITIALIZING';
        await this.initGame();
        this.startGame();
    }

    async initGame() {
        // Clear existing entities
        this.buildings = [];
        this.trees = [];
        this.enemyTanks = [];
        this.projectiles = [];

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
                }
                  // Use enhanced collision system to check tank spawn suitability
                if (this.collisionSystem) {
                    const spawnCheck = this.collisionSystem.checkTankSpawnSuitability(position, tankCollisionRadius, 3.0);
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
    }    startGame() {
        this.gameState = 'PLAYER_TURN';
        this.currentPlayerIndex = -1;
        this.activeTank = this.playerTank;
        this.activeTank.resetTurnStats();
        const playerName = this.ui.getPlayerName() || 'Player';
        this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - ${playerName}'s Turn`);
        this.ui.updateFuel(this.activeTank.currentFuel, this.activeTank.maxFuel);
        this.ui.updateHealth(this.activeTank.id, this.activeTank.currentHealth, this.activeTank.maxHealth);
        this.ui.toggleEndTurnButton(true);
        this.ui.updateActionIndicator("Move / Aim / Fire / Adjust Power");
        this.ui.updatePowerIndicator(this.playerTank.currentPower, this.playerTank.minPower, this.playerTank.maxPower);
        
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
                this.audioManager.playMusic('gameplayBg', true);            } else {
                console.log('Music already playing with shared audio object - ensuring correct volume');
                // Make sure volume is correct even if using shared object
                if (currentMusic) {
                    currentMusic.volume = this.audioManager.musicVolume;
                }
            }
        }
    }

    nextTurn() {
        this.activeTank.hasFiredThisTurn = false;

        if (this.gameState === 'GAME_OVER') return;

        // Stop any continuous sounds when turn changes
        if (this.audioManager) {
            this.audioManager.stopAllContinuousSounds();
        }

        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.enemyTanks.length) {
            this.currentPlayerIndex = -1;
        }        if (this.currentPlayerIndex === -1) {
            this.activeTank = this.playerTank;
            if (this.activeTank.isDestroyed) {
                this.gameOver(false);
                return;
            }
            this.gameState = 'PLAYER_TURN';
            this.activeTank.resetTurnStats();
            const playerName = this.ui.getPlayerName() || 'Player';
            this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - ${playerName} Turn`);
            this.ui.toggleEndTurnButton(true);
        } else {
            this.activeTank = this.enemyTanks[this.currentPlayerIndex];
            if (this.activeTank.isDestroyed) {
                this.nextTurn();
                return;
            }
            this.gameState = 'ENEMY_TURN';
            this.activeTank.resetTurnStats();
            this.ui.updateTurnIndicator(`${this.difficultyConfig.name} - Enemy ${this.currentPlayerIndex + 1}'s Turn`);
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
        
        this.ui.updateActionIndicator(`Enemy is ${aiDecision.action}...`);
        
        // Execute AI decision
        this.executeAIDecision(enemy, aiDecision);
        
        // End turn with appropriate delay
        const turnDelay = Math.max(800, 2000 - (this.difficultyConfig.strategicThinking * 1200));
        setTimeout(() => this.nextTurn(), turnDelay);
    }

    // AI decision making using collision system for line of sight checks
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
        
        // Strategic decision matrix based on difficulty
        let decision = { action: 'thinking', priority: 0 };
        
        // HIGH PRIORITY: Shoot if opportunity exists
        if (hasAmmo && playerInRange && decision.priority < 9) {
            const canAttemptShot = lineOfSight || (distanceToPlayer < 30);
            
            if (canAttemptShot) {
                const baseAccuracy = Math.max(0.3, config.aimAccuracy * 0.8);
                decision = {
                    action: 'engaging target',
                    type: 'shoot',
                    accuracy: baseAccuracy,
                    priority: 9
                };
            }
        }
        
        // Emergency retreat if low health
        if (lowHealth && config.strategicThinking > 0.5 && decision.priority < 8) {
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
        
        // Medium priority: Tactical positioning
        if (config.strategicThinking > 0.6 && decision.priority < 7) {
            if (!inCover && config.coverUsage > Math.random()) {
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
        
        // Low priority: Basic movement
        if (decision.priority < 5) {
            const idealDistance = 25;
            if (distanceToPlayer > idealDistance + 15) {
                decision = {
                    action: 'advancing on target',
                    type: 'move',
                    target: this.getPositionTowards(enemyPos, playerPos, idealDistance),
                    priority: 4
                };
            } else if (distanceToPlayer < idealDistance - 5) {
                decision = {
                    action: 'maintaining distance',
                    type: 'move',
                    target: this.getPositionAway(enemyPos, playerPos, idealDistance),
                    priority: 3
                };
            }
        }
        
        // Fallback: Wait and aim
        if (decision.priority < 3) {
            decision = {
                action: 'aiming',
                type: 'aim',
                priority: 1
            };
        }
        
        return decision;
    }

    executeAIDecision(enemy, decision) {
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
        }
    }

    executeAIShoot(enemy, baseAccuracy) {
        const playerPos = this.playerTank.mesh.position.clone();
        const enemyPos = enemy.mesh.position.clone();
        
        // Aim at target horizontally
        enemy.aimTowards(playerPos);
        
        // Calculate proper ballistics
        const distance = enemyPos.distanceTo(playerPos);
        const heightDiff = playerPos.y - enemyPos.y;
        
        // Start with a reasonable power estimate based on distance
        let estimatedPower = Math.min(enemy.maxPower, Math.max(enemy.minPower, distance * 1.5 + 20));
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
    }    calculateOptimalPower(distance, elevation, tank) {
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
    }

    executeAIMove(enemy, targetPosition) {
        if (!targetPosition || enemy.currentFuel <= 0) return;
        
        const enemyPos = enemy.mesh.position.clone();
        const direction = targetPosition.clone().sub(enemyPos).normalize();
        const moveDistance = Math.min(
            enemy.currentFuel / 20,
            enemyPos.distanceTo(targetPosition)
        );
        
        const fuelEfficiency = enemy.aiDifficulty.fuelEfficiency;
        const actualMoveDistance = moveDistance * fuelEfficiency;
        
        for (let i = 0; i < 5 && enemy.currentFuel > 0; i++) {
            enemy.move(direction, actualMoveDistance / 5);
        }
    }

    executeAIAim(enemy) {
        const playerPos = this.playerTank.mesh.position.clone();
        enemy.aimTowards(playerPos);
        
        const distance = enemy.mesh.position.distanceTo(playerPos);
        const heightDiff = playerPos.y - enemy.mesh.position.y;
        
        const estimatedPower = Math.min(enemy.maxPower, Math.max(enemy.minPower, distance * 1.5 + 20));
        enemy.currentPower = estimatedPower;
        
        const optimalElevation = this.calculatePhysicsBasedElevation(distance, heightDiff, enemy);
        
        const targetElevation = Math.max(
            enemy.minBarrelElevation,
            Math.min(enemy.maxBarrelElevation, optimalElevation)
        );
        
        const elevationDiff = targetElevation - enemy.barrelElevation;
        const elevationStep = Math.sign(elevationDiff) * Math.min(Math.abs(elevationDiff), enemy.barrelElevateSpeed * 0.2);
        enemy.elevateBarrel(elevationStep);
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
    }

    calculateShootingAccuracy(enemy, targetPos, distance) {
        let accuracy = 0.9;
        
        accuracy -= Math.min(0.2, distance / 200);
        
        if (enemy.currentFuel < enemy.maxFuel * 0.8) {
            accuracy -= 0.05;
        }
        
        if (this.hasLineOfSight(enemy.mesh.position, targetPos)) {
            accuracy += 0.1;
        }
        
        if (distance < 20) {
            accuracy += 0.15;
        }
        
        return Math.max(0.3, Math.min(1, accuracy));
    }

    endPlayerTurn() {
        if (this.gameState === 'PLAYER_TURN') {
            this.nextTurn();
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
                    const collisionResult = this.collisionSystem.checkProjectileCollisions(p);
                    if (collisionResult.hasCollision) {
                        this.collisionSystem.applyCollisionEffects(collisionResult, p);
                        this.scene.remove(p.mesh);
                        this.projectiles.splice(i, 1);
                        
                        // Update UI if tank was hit
                        if (collisionResult.type === 'tank') {
                            this.ui.updateHealth(collisionResult.tank.id, collisionResult.tank.currentHealth, collisionResult.tank.maxHealth);
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

        // Check for game over conditions
        if (this.playerTank.isDestroyed) {
            this.gameOver(false);
        } else if (this.enemyTanks.every(enemy => enemy.isDestroyed)) {
            this.gameOver(true);
        }
    }

    handlePlayerInput(deltaTime) {
        if (this.playerTank.isDestroyed) return;

        // Track if tank is currently moving
        const isMoving = this.inputStates.moveForward || this.inputStates.moveBackward;
        const isRotatingBody = this.inputStates.rotateLeft || this.inputStates.rotateRight;
        const isRotatingTurret = this.inputStates.turretLeft || this.inputStates.turretRight;

        // Handle tank movement sounds
        if (isMoving || isRotatingBody) {
            if (!this.audioManager.isContinuousSoundPlaying('tankMove')) {
                this.audioManager.playContinuousSound('tankMove', 0.3);
            }
        } else {
            if (this.audioManager.isContinuousSoundPlaying('tankMove')) {
                this.audioManager.stopContinuousSound('tankMove');
            }
        }        // Handle turret rotation sounds
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
        }// Movement input handling
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
    
    addProjectile(projectile) {
        this.projectiles.push(projectile);
        this.scene.add(projectile.mesh);
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
                
                // Create basic particle effects
                if (this.particleSystem) {
                    this.particleSystem.createTankHitEffect(hitPosition, 1.0);
                }
                
                // Apply damage
                tank.takeDamage(projectile.damage);
                this.ui.updateHealth(tank.id, tank.currentHealth, tank.maxHealth);
                projectile.shouldBeRemoved = true;
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
    }    gameOver(playerWon) {
        if (this.gameState === 'GAME_OVER') return;
        this.gameState = 'GAME_OVER';
        
        // Stop all continuous sounds when game ends
        if (this.audioManager) {
            this.audioManager.stopAllContinuousSounds();
            this.audioManager.stopAllMusic();
            
            if (playerWon) {
                // Play victory sound and music
                this.audioManager.playMusic('openingScreen');
            } else {
                // Play defeat sounds
                this.audioManager.playExitTankSound();
                setTimeout(() => {
                    this.audioManager.playSound('explosion');
                }, 500);
            }
        }
        
        const difficultyText = this.difficultyConfig.name;
        const message = playerWon ? 
            `Victory on ${difficultyText} Difficulty!\nAll Enemies Destroyed!` : 
            `Defeat on ${difficultyText} Difficulty!\nYour Tank Was Destroyed!`;
        this.ui.showGameOverMessage(message);
        this.ui.toggleEndTurnButton(false);
    }

    setupInputListeners() {
        document.addEventListener('keydown', (event) => {
            if (this.gameState !== 'PLAYER_TURN') return;
            switch(event.code) {
                case 'KeyW': this.inputStates.moveForward = true; break;
                case 'KeyS': this.inputStates.moveBackward = true; break;
                case 'KeyA': this.inputStates.rotateLeft = true; break;
                case 'KeyD': this.inputStates.rotateRight = true; break;
                case 'KeyQ': this.inputStates.turretLeft = true; break;
                case 'KeyE': this.inputStates.turretRight = true; break;
                case 'Space': if (!this.playerTank.hasFiredThisTurn) this.inputStates.fire = true; break;
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
            switch(event.code) {
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

}

// Make mobile controls accessible globally for testing
window.forceMobileControls = function() {
    if (window.gameInstance && window.gameInstance.mobileControls) {
        window.gameInstance.mobileControls.forceEnable();
    } else {
        console.log('Game instance or mobile controls not available');
    }
};