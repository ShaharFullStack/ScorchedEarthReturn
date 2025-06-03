import * as THREE from 'three';

/**
 * Comprehensive Collision Detection System
 * Handles all collision detection for tanks, projectiles, terrain, and environment objects
 * Optimized for both single-player and multiplayer modes
 */
export class CollisionSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        
        // Collision configuration
        this.config = {
            tank: { radius: 1.5, height: 1.8 },
            projectile: { radius: 0.35 },
            terrain: { margin: 0.15, maxSlope: 1.5, minDepth: -2.5 },
            building: { margin: 0.5 },
            tree: { margin: 0.3 },
            spawn: { minClearance: 3.0, sampleRadius: 1.5 }
        };
        
        // Collision groups for optimization
        this.staticObjects = [];
        this.dynamicObjects = [];
        
        // Performance optimization
        this.lastStaticUpdate = 0;
        this.staticUpdateInterval = 1000; // Update every second
        
        this.initialize();
    }
    
    // ========================================
    // INITIALIZATION & SETUP
    // ========================================
    
    initialize() {
        this.updateStaticObjects();
        console.log(`Collision System Initialized:
        - Static Objects: ${this.staticObjects.length}
        - Buildings: ${this.game.buildings?.length || 0}
        - Trees: ${this.game.trees?.length || 0}`);
    }
    
    updateStaticObjects() {
        this.staticObjects = [];
        
        // Add buildings
        this.game.buildings?.forEach(building => {
            if (!building.userData.isDestroyed) {
                this.staticObjects.push({
                    type: 'building',
                    object: building,
                    position: building.position.clone(),
                    radius: building.userData.collisionRadius || 4,
                    height: 6
                });
            }
        });
        
        // Add trees
        this.game.trees?.forEach(tree => {
            if (!tree.userData.isDestroyed) {
                this.staticObjects.push({
                    type: 'tree',
                    object: tree,
                    position: tree.position.clone(),
                    radius: tree.userData.collisionRadius || 2,
                    height: 4
                });
            }
        });
        
        this.lastStaticUpdate = Date.now();
    }
    
    // ========================================
    // TANK MOVEMENT & POSITIONING
    // ========================================
    
    /**
     * Check if a tank can move to a new position
     * @param {Tank} tank - The tank attempting to move
     * @param {THREE.Vector3} newPosition - The desired new position
     * @param {THREE.Vector3} moveVector - The movement vector
     * @returns {Object} Movement validation result
     */
    checkTankMovement(tank, newPosition, moveVector) {
        const result = {
            canMove: true,
            collisionInfo: null,
            adjustedPosition: newPosition.clone(),
            terrainHeight: 0,
            terrainData: null
        };
        
        // 1. Boundary check
        if (!this.isWithinBoundaries(newPosition)) {
            return this.createCollisionResult(false, 'boundary', newPosition);
        }
        
        // 2. Terrain collision and positioning
        const terrainData = this.getTerrainCollisionData(newPosition, tank);
        result.adjustedPosition.y = terrainData.groundY;
        result.terrainHeight = terrainData.terrainHeight;
        result.terrainData = terrainData;
        
        // 3. Static object collision
        const staticCollision = this.checkStaticCollisions(newPosition, this.config.tank.radius);
        if (staticCollision.hasCollision) {
            return this.createCollisionResult(false, 'static', newPosition, staticCollision);
        }
        
        // 4. Tank-to-tank collision
        const tankCollision = this.checkTankCollisions(tank, newPosition);
        if (tankCollision.hasCollision) {
            return this.createCollisionResult(false, 'tank', newPosition, tankCollision);
        }
        
        // 5. Stability check
        if (!this.isTankStable(result.adjustedPosition, tank)) {
            return this.createCollisionResult(false, 'unstable', newPosition);
        }
        
        return result;
    }
    
    /**
     * Get proper spawn position for a tank
     * @param {THREE.Vector3} position - The desired spawn position
     * @param {Tank} tank - The tank to spawn
     * @returns {Object} Spawn position data
     */
    getProperSpawnPosition(position, tank = null) {
        const terrainHeight = this.getTerrainHeight(position.x, position.z);
        const spawnY = terrainHeight + 0.4 + this.config.terrain.margin; // track + clearance
        const spawnPosition = new THREE.Vector3(position.x, spawnY, position.z);
        
        const terrainData = {
            terrainHeight,
            groundY: spawnY,
            isUnderwater: terrainHeight < 0,
            slope: 0,
            trackHeights: { left: terrainHeight, right: terrainHeight },
            tankRotation: { x: 0, z: 0 }
        };
        
        console.log(`Spawn calculated: (${position.x.toFixed(2)}, ${spawnY.toFixed(2)}, ${position.z.toFixed(2)})`);
        
        return { position: spawnPosition, terrainData };
    }
    
    /**
     * Check if position is suitable for tank spawning
     * @param {THREE.Vector3} position - Position to check
     * @param {number} tankRadius - Tank collision radius
     * @param {number} minClearance - Minimum clearance required
     * @returns {Object} Suitability result
     */
    checkSpawnSuitability(position, tankRadius = 1.5, minClearance = 3.0) {
        // Boundary check
        if (!this.isWithinBoundaries(position)) {
            return { suitable: false, reason: 'boundary' };
        }
        
        // Terrain checks
        const terrainHeight = this.getTerrainHeight(position.x, position.z);
        if (terrainHeight < this.config.terrain.minDepth) {
            return { suitable: false, reason: 'underwater' };
        }
        
        const slope = this.calculateTerrainSlope(position);
        if (slope > 1.0) {
            return { suitable: false, reason: 'too_steep', slope };
        }
        
        // Crater check
        const craterCheck = this.checkForCrater(position, tankRadius);
        if (!craterCheck.suitable) {
            return { suitable: false, reason: 'in_crater', ...craterCheck };
        }
        
        // Static object clearance
        for (const obj of this.staticObjects) {
            const distance = this.getHorizontalDistance(position, obj.position);
            const requiredClearance = this.getRequiredClearance(obj.type, obj.radius, minClearance);
            
            if (distance < requiredClearance) {
                return { 
                    suitable: false, 
                    reason: `too_close_to_${obj.type}`,
                    conflictingObject: obj,
                    distance,
                    requiredClearance
                };
            }
        }
        
        return { suitable: true, reason: 'clear' };
    }
    
    /**
     * Check terrain collision for a tank at a specific position
     * @param {THREE.Vector3} position - Position to check
     * @param {Tank} tank - Tank object for calculations
     * @returns {Object} Terrain collision data
     */
    checkTerrainCollision(position, tank) {
        return this.getTerrainCollisionData(position, tank);
    }

    /**
     * Backward compatibility alias for checkSpawnSuitability
     * @param {THREE.Vector3} position - Position to check
     * @param {number} tankRadius - Tank collision radius
     * @param {number} minClearance - Minimum clearance required
     * @returns {Object} Suitability result
     */
    checkTankSpawnSuitability(position, tankRadius = 1.5, minClearance = 3.0) {
        return this.checkSpawnSuitability(position, tankRadius, minClearance);
    }

    // ========================================
    // TERRAIN COLLISION & ANALYSIS
    // ========================================
    
    /**
     * Get comprehensive terrain collision data for tank positioning
     * @param {THREE.Vector3} position - Position to check
     * @param {Tank} tank - Tank object for track calculations
     * @returns {Object} Terrain collision data
     */
    getTerrainCollisionData(position, tank) {
        if (!this.scene.userData.terrain) {
            return this.getDefaultTerrainData(position.y);
        }
        
        // Get track contact points (delegate to enhanced track system if available)
        const trackPoints = this.getTrackContactPoints(tank, position);
        
        // Sample terrain heights at track points
        const leftHeights = trackPoints.left.map(p => this.getTerrainHeight(p.x, p.z));
        const rightHeights = trackPoints.right.map(p => this.getTerrainHeight(p.x, p.z));
        
        // Calculate weighted averages
        const leftAvg = this.calculateWeightedHeight(leftHeights);
        const rightAvg = this.calculateWeightedHeight(rightHeights);
        const centerHeight = (leftAvg + rightAvg) / 2;
        
        // Calculate tank orientation
        const rotation = this.calculateTankRotation(leftHeights, rightHeights);
        
        // Calculate final position
        const groundY = centerHeight + 0.4 + this.config.terrain.margin;
        const slope = this.calculateSlopeFromHeights(leftHeights, rightHeights);
        
        return {
            terrainHeight: centerHeight,
            groundY,
            isUnderwater: centerHeight < 0,
            slope,
            trackHeights: { left: leftAvg, right: rightAvg },
            tankRotation: rotation
        };
    }
    
    /**
     * Calculate tank rotation based on track contact heights
     * @param {Array} leftHeights - Left track height samples
     * @param {Array} rightHeights - Right track height samples
     * @returns {Object} Rotation angles
     */
    calculateTankRotation(leftHeights, rightHeights) {
        if (leftHeights.length === 0 || rightHeights.length === 0) {
            return { x: 0, z: 0 };
        }
        
        // Roll: right - left height difference
        const rollDiff = rightHeights.reduce((a, b) => a + b, 0) / rightHeights.length - 
                        leftHeights.reduce((a, b) => a + b, 0) / leftHeights.length;
        const rollAngle = Math.atan2(rollDiff, 2.15); // track spacing
        
        // Pitch: rear - front height difference
        const rearHeight = (leftHeights[0] + rightHeights[0]) / 2;
        const frontHeight = (leftHeights[leftHeights.length - 1] + rightHeights[rightHeights.length - 1]) / 2;
        const pitchDiff = rearHeight - frontHeight;
        const pitchAngle = Math.atan2(pitchDiff, 3.25); // track length
        
        // Apply limits and smoothing
        const maxAngle = Math.PI / 6; // 30 degrees
        const smoothing = 0.7;
        
        return {
            x: Math.max(-maxAngle, Math.min(maxAngle, pitchAngle)) * smoothing,
            z: Math.max(-maxAngle, Math.min(maxAngle, rollAngle)) * smoothing
        };
    }
    
    /**
     * Calculate terrain slope at position
     * @param {THREE.Vector3} position - Position to check
     * @returns {number} Maximum slope value
     */
    calculateTerrainSlope(position) {
        if (!this.scene.userData.terrain) return 0;
        
        const sampleDistance = 1.0;
        const center = this.getTerrainHeight(position.x, position.z);
        const north = this.getTerrainHeight(position.x, position.z + sampleDistance);
        const east = this.getTerrainHeight(position.x + sampleDistance, position.z);
        const south = this.getTerrainHeight(position.x, position.z - sampleDistance);
        const west = this.getTerrainHeight(position.x - sampleDistance, position.z);
        
        const slopeX = Math.abs(east - west) / (sampleDistance * 2);
        const slopeZ = Math.abs(north - south) / (sampleDistance * 2);
        
        return Math.max(slopeX, slopeZ);
    }
    
    // ========================================
    // PROJECTILE COLLISION DETECTION
    // ========================================
    
    /**
     * Check projectile collisions with all possible targets
     * @param {Projectile} projectile - The projectile to check
     * @returns {Object} Collision result
     */
    checkProjectileCollisions(projectile) {
        // Check tank collisions first (most important)
        const tankCollision = this.checkProjectileTankCollisions(projectile);
        if (tankCollision.hasCollision) {
            return { type: 'tank', hasCollision: true, ...tankCollision };
        }
        
        // Check static object collisions
        const staticCollision = this.checkProjectileStaticCollisions(projectile);
        if (staticCollision.hasCollision) {
            return { type: 'static', hasCollision: true, ...staticCollision };
        }
        
        // Check terrain collision
        const terrainCollision = this.checkProjectileTerrainCollision(projectile);
        if (terrainCollision.hasCollision) {
            return { type: 'terrain', hasCollision: true, ...terrainCollision };
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with tanks
     * @param {Projectile} projectile - Projectile to check
     * @returns {Object} Tank collision result
     */
    checkProjectileTankCollisions(projectile) {
        const validTargets = this.getValidTargets(projectile);
        
        for (const tank of validTargets) {
            if (tank.isDestroyed) continue;
            
            const distance = projectile.mesh.position.distanceTo(tank.mesh.position);
            const combinedRadius = this.config.tank.radius + this.config.projectile.radius;
            
            if (distance < combinedRadius) {
                const impactData = this.calculateImpactData(projectile, tank);
                return {
                    hasCollision: true,
                    tank,
                    distance,
                    penetration: combinedRadius - distance,
                    ...impactData
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with static objects
     * @param {Projectile} projectile - Projectile to check
     * @returns {Object} Static collision result
     */
    checkProjectileStaticCollisions(projectile) {
        const projectilePos = projectile.mesh.position;
        
        for (const obj of this.staticObjects) {
            const distance = projectilePos.distanceTo(obj.position);
            const combinedRadius = obj.radius + this.config.projectile.radius;
            
            if (distance < combinedRadius) {
                return {
                    hasCollision: true,
                    objectType: obj.type,
                    object: obj.object,
                    impactPoint: projectilePos.clone(),
                    distance,
                    penetration: combinedRadius - distance,
                    damage: projectile.damage
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with terrain
     * @param {Projectile} projectile - Projectile to check
     * @returns {Object} Terrain collision result
     */
    checkProjectileTerrainCollision(projectile) {
        const pos = projectile.mesh.position;
        const terrainHeight = this.getTerrainHeight(pos.x, pos.z);
        
        if (pos.y <= terrainHeight + this.config.projectile.radius) {
            return {
                hasCollision: true,
                impactPoint: new THREE.Vector3(pos.x, terrainHeight, pos.z),
                terrainHeight,
                crater: {
                    position: new THREE.Vector3(pos.x, terrainHeight, pos.z),
                    radius: 4,
                    depth: 1.5
                }
            };
        }
        
        return { hasCollision: false };
    }
    
    // ========================================
    // COLLISION EFFECTS & HANDLING
    // ========================================
    
    /**
     * Apply collision effects based on collision result
     * @param {Object} collisionResult - Collision data
     * @param {Projectile} projectile - The projectile that collided
     */
    async applyCollisionEffects(collisionResult, projectile) {
        if (!collisionResult.hasCollision) return;
        
        // Handle multiplayer synchronization
        if (this.isMultiplayer() && this.isHost()) {
            await this.syncCollisionEffects(collisionResult, projectile);
        }
        
        // Apply local effects
        this.applyLocalCollisionEffects(collisionResult, projectile);
        
        // Mark projectile for removal
        projectile.shouldBeRemoved = true;
    }
    
    /**
     * Apply collision effects locally
     * @param {Object} collisionResult - Collision data
     * @param {Projectile} projectile - The projectile
     */
    applyLocalCollisionEffects(collisionResult, projectile) {
        const handlers = {
            tank: () => this.handleTankHit(collisionResult, projectile),
            static: () => this.handleStaticHit(collisionResult, projectile),
            terrain: () => this.handleTerrainHit(collisionResult, projectile)
        };
        
        const handler = handlers[collisionResult.type];
        if (handler) {
            handler();
        } else {
            console.warn(`Unknown collision type: ${collisionResult.type}`);
        }
    }
    
    /**
     * Handle tank hit effects
     * @param {Object} collision - Collision data
     * @param {Projectile} projectile - The projectile
     */
    handleTankHit(collision, projectile) {
        const { tank, damage, impactPoint } = collision;
        
        // Log hit
        this.logHit('TANK', projectile, {
            target: tank.isPlayer ? 'PLAYER' : tank.id,
            damage,
            position: impactPoint,
            healthBefore: tank.currentHealth,
            healthAfter: Math.max(0, tank.currentHealth - damage)
        });
        
        // Apply damage
        tank.takeDamage?.(damage);
        
        // Create effects
        this.createHitEffects(impactPoint, 'tank', tank.currentHealth / tank.maxHealth);
        
        // Play sounds
        this.playCollisionSounds(['tankHit', tank.isDestroyed ? 'explosion' : null]);
    }
    
    /**
     * Handle static object hit effects
     * @param {Object} collision - Collision data
     * @param {Projectile} projectile - The projectile
     */
    handleStaticHit(collision, projectile) {
        const { objectType, object, impactPoint } = collision;
        
        this.logHit(objectType.toUpperCase(), projectile, { position: impactPoint });
        
        // Create type-specific effects
        const effectMap = {
            building: () => {
                this.createHitEffects(impactPoint, 'building');
                this.game.damageBuilding?.(object, projectile);
            },
            tree: () => {
                this.createHitEffects(impactPoint, 'tree');
                this.game.destroyTree?.(object, projectile);
            }
        };
        
        effectMap[objectType]?.();
        this.playCollisionSounds([`hit${objectType.charAt(0).toUpperCase() + objectType.slice(1)}`]);
    }
    
    /**
     * Handle terrain hit effects
     * @param {Object} collision - Collision data
     * @param {Projectile} projectile - The projectile
     */
    handleTerrainHit(collision, projectile) {
        const { impactPoint, crater } = collision;
        
        this.logHit('GROUND', projectile, { 
            position: impactPoint,
            craterDepth: crater.depth
        });
        
        // Deform terrain
        this.deformTerrain(crater);
        
        // Create effects
        this.createHitEffects(impactPoint, 'terrain');
        this.playCollisionSounds(['groundHit']);
    }
    
    // ========================================
    // UTILITY METHODS
    // ========================================
    
    /**
     * Get all tanks in the game (multiplayer-aware)
     * @returns {Array} Array of all tanks
     */
    getAllTanks() {
        const tanks = [];
        
        // Single-player tanks
        if (this.game.playerTank) tanks.push(this.game.playerTank);
        if (this.game.enemyTanks) tanks.push(...this.game.enemyTanks);
        
        // Multiplayer tanks
        if (this.game.multiplayerTanks) {
            Object.values(this.game.multiplayerTanks).forEach(tank => {
                if (tank?.mesh) tanks.push(tank);
            });
        }
        
        return tanks;
    }
    
    /**
     * Get valid targets for projectile (excluding shooter)
     * @param {Projectile} projectile - The projectile
     * @returns {Array} Valid target tanks
     */
    getValidTargets(projectile) {
        const allTanks = this.getAllTanks();
        
        // Single-player mode fallback
        if (!this.isMultiplayer() && projectile.firedByPlayer !== undefined) {
            return projectile.firedByPlayer ? 
                (this.game.enemyTanks || []) : 
                [this.game.playerTank].filter(Boolean);
        }
        
        // Exclude shooting tank
        return allTanks.filter(tank => tank !== projectile.shootingTank);
    }
    
    /**
     * Check if position is within game boundaries
     * @param {THREE.Vector3} position - Position to check
     * @returns {boolean} Whether position is valid
     */
    isWithinBoundaries(position) {
        const maxDistance = 60;
        return Math.abs(position.x) <= maxDistance && Math.abs(position.z) <= maxDistance;
    }
    
    /**
     * Get terrain height at coordinates
     * @param {number} x - X coordinate
     * @param {number} z - Z coordinate
     * @returns {number} Terrain height
     */
    getTerrainHeight(x, z) {
        return this.scene.userData.terrain?.getHeightAt(x, z) || 0;
    }
    
    /**
     * Get track contact points for tank
     * @param {Tank} tank - Tank object
     * @param {THREE.Vector3} position - Tank position
     * @returns {Object} Track contact points
     */
    getTrackContactPoints(tank, position) {
        // If enhanced track system is available, use it
        if (tank.getTrackContactPoints) {
            return tank.getTrackContactPoints(position);
        }
        
        // Fallback: simplified track calculation
        return this.calculateSimpleTrackPoints(tank, position);
    }
    
    /**
     * Calculate simple track contact points (fallback)
     * @param {Tank} tank - Tank object
     * @param {THREE.Vector3} position - Tank position
     * @returns {Object} Basic track points
     */
    calculateSimpleTrackPoints(tank, position) {
        const tankPos = position || tank.mesh.position;
        const rotation = tank.mesh.rotation.y;
        const trackOffset = 1.075;
        const trackLength = 3.25;
        const sampleCount = 36;
        
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        
        const leftPoints = [];
        const rightPoints = [];
        
        for (let i = 0; i < sampleCount; i++) {
            const t = i / (sampleCount - 1);
            const localZ = (t - 0.5) * trackLength;
            
            // Left track
            const leftX = tankPos.x + (-trackOffset * cos - localZ * sin);
            const leftZ = tankPos.z + (-trackOffset * sin + localZ * cos);
            leftPoints.push(new THREE.Vector3(leftX, 0, leftZ));
            
            // Right track
            const rightX = tankPos.x + (trackOffset * cos - localZ * sin);
            const rightZ = tankPos.z + (trackOffset * sin + localZ * cos);
            rightPoints.push(new THREE.Vector3(rightX, 0, rightZ));
        }
        
        return { left: leftPoints, right: rightPoints };
    }
    
    // ========================================
    // HELPER METHODS
    // ========================================
    
    createCollisionResult(canMove, type, position, info = null) {
        return {
            canMove,
            collisionInfo: { type, ...info },
            adjustedPosition: position.clone(),
            terrainHeight: 0
        };
    }
    
    getDefaultTerrainData(y) {
        return {
            terrainHeight: 0,
            groundY: y,
            isUnderwater: false,
            slope: 0,
            trackHeights: { left: 0, right: 0 },
            tankRotation: { x: 0, z: 0 }
        };
    }
    
    calculateWeightedHeight(heights) {
        if (heights.length === 0) return 0;
        
        // Weighted average favoring higher points (track contact)
        const sorted = [...heights].sort((a, b) => b - a);
        let weightedSum = 0;
        let totalWeight = 0;
        
        heights.forEach(height => {
            const rank = sorted.indexOf(height);
            const weight = Math.exp(-rank * 0.5);
            weightedSum += height * weight;
            totalWeight += weight;
        });
        
        return weightedSum / totalWeight;
    }
    
    calculateSlopeFromHeights(leftHeights, rightHeights) {
        const allHeights = [...leftHeights, ...rightHeights];
        if (allHeights.length < 2) return 0;
        
        const min = Math.min(...allHeights);
        const max = Math.max(...allHeights);
        return (max - min) / 3.25; // Normalize by track length
    }
    
    getHorizontalDistance(pos1, pos2) {
        return Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + 
            Math.pow(pos1.z - pos2.z, 2)
        );
    }
    
    getRequiredClearance(objectType, objectRadius, baseClearance) {
        const multipliers = { building: 2.0, tree: 1.5 };
        return Math.max(baseClearance, objectRadius + (multipliers[objectType] || 1.0));
    }
    
    checkForCrater(position, radius) {
        if (!this.scene.userData.terrain) return { suitable: true, depth: 0 };
        
        const centerHeight = this.getTerrainHeight(position.x, position.z);
        const sampleCount = 8;
        const checkRadius = radius * 1.5;
        
        let avgSurrounding = 0;
        let maxDiff = 0;
        
        for (let i = 0; i < sampleCount; i++) {
            const angle = (i / sampleCount) * Math.PI * 2;
            const x = position.x + Math.cos(angle) * checkRadius;
            const z = position.z + Math.sin(angle) * checkRadius;
            const height = this.getTerrainHeight(x, z);
            
            avgSurrounding += height;
            maxDiff = Math.max(maxDiff, Math.abs(height - centerHeight));
        }
        
        avgSurrounding /= sampleCount;
        const craterDepth = avgSurrounding - centerHeight;
        
        return {
            suitable: craterDepth <= 2.0 && maxDiff <= 2.5,
            depth: craterDepth,
            heightVariation: maxDiff
        };
    }
    
    checkStaticCollisions(position, radius) {
        for (const obj of this.staticObjects) {
            const distance = position.distanceTo(obj.position);
            const combinedRadius = radius + obj.radius;
            
            if (distance < combinedRadius) {
                return {
                    hasCollision: true,
                    type: 'static',
                    objectType: obj.type,
                    object: obj.object,
                    distance,
                    penetration: combinedRadius - distance,
                    direction: position.clone().sub(obj.position).normalize()
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    checkTankCollisions(movingTank, newPosition) {
        const allTanks = this.getAllTanks();
        
        for (const tank of allTanks) {
            if (tank === movingTank || tank.isDestroyed) continue;
            
            const distance = newPosition.distanceTo(tank.mesh.position);
            const combinedRadius = this.config.tank.radius * 2;
            
            if (distance < combinedRadius) {
                return {
                    hasCollision: true,
                    type: 'tank',
                    tank,
                    distance,
                    penetration: combinedRadius - distance,
                    direction: newPosition.clone().sub(tank.mesh.position).normalize()
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    isTankStable(position, tank) {
        const slope = this.calculateTerrainSlope(position);
        if (slope > this.config.terrain.maxSlope) return false;
        
        const terrainHeight = this.getTerrainHeight(position.x, position.z);
        if (terrainHeight < this.config.terrain.minDepth) return false;
        
        return true;
    }
    
    calculateImpactData(projectile, tank) {
        const impactPoint = this.calculateImpactPoint(projectile, tank);
        const impactAngle = this.calculateImpactAngle(projectile, tank);
        const damage = this.calculateDamage(projectile, tank, impactAngle);
        
        return { impactPoint, impactAngle, damage };
    }
    
    calculateImpactPoint(projectile, target) {
        const projectilePos = projectile.mesh.position.clone();
        const targetPos = target.mesh.position.clone();
        targetPos.y += 0.8; // Tank center height
        
        const direction = projectilePos.clone().sub(targetPos).normalize();
        return targetPos.clone().add(direction.multiplyScalar(this.config.tank.radius));
    }
    
    calculateImpactAngle(projectile, target) {
        const velocity = projectile.velocity.clone().normalize();
        const toTarget = target.mesh.position.clone().sub(projectile.mesh.position).normalize();
        const dotProduct = velocity.dot(toTarget);
        return Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    }
    
    calculateDamage(projectile, target, impactAngle) {
        let damage = projectile.damage;
        
        // Angle modifier
        damage *= (0.7 + 0.3 * Math.cos(impactAngle));
        
        // Speed modifier
        const speed = projectile.velocity.length();
        damage *= Math.min(1.5, speed / 50);
        
        return Math.round(damage);
    }
    
    // Multiplayer helpers
    isMultiplayer() {
        return this.game.gameSynchronizer?.isMultiplayer;
    }
    
    isHost() {
        return this.game.gameSynchronizer?.isHost;
    }
    
    async syncCollisionEffects(collision, projectile) {
        try {
            const data = this.prepareCollisionData(collision, projectile);
            await this.game.gameSynchronizer.syncProjectileCollision(projectile.id, data);
        } catch (error) {
            console.error('Failed to sync collision:', error);
        }
    }
    
    prepareCollisionData(collision, projectile) {
        return {
            collisionPoint: collision.impactPoint || projectile.mesh.position.clone(),
            explosionRadius: 4,
            damage: collision.damage || projectile.damage,
            type: collision.type
        };
    }
    
    // Effect helpers
    createHitEffects(position, type, intensity = 1.0) {
        if (!this.game.particleSystem) return;
        
        const effects = {
            tank: () => this.game.particleSystem.createTankHitEffect(position, intensity),
            building: () => {
                this.game.particleSystem.createSmoke(position, 0.8);
                this.game.particleSystem.createMetalDebris(position, 0.6);
            },
            tree: () => this.game.particleSystem.createSmoke(position, 0.3),
            terrain: () => {
                this.game.particleSystem.createSmoke(position, 0.5);
                this.game.particleSystem.createMetalDebris(position, 0.3);
            }
        };
        
        effects[type]?.();
    }
    
    playCollisionSounds(soundNames) {
        if (!this.game.audioManager) return;
        
        soundNames.filter(Boolean).forEach(sound => {
            this.game.audioManager.playSound(sound);
        });
    }
    
    deformTerrain(crater) {
        if (!this.scene.userData.terrain?.deformTerrain) return;
        
        this.scene.userData.terrain.deformTerrain(
            crater.position, 
            crater.radius, 
            crater.depth
        );
        
        // Sync in multiplayer
        if (this.isMultiplayer() && this.isHost()) {
            this.game.gameSynchronizer.syncTerrainDestruction(
                crater.position,
                crater.radius,
                Date.now()
            );
        }
    }
    
    logHit(targetType, projectile, details) {
        const shooterName = projectile.shootingTank?.isPlayer ? 'PLAYER' : 
                          (projectile.shootingTank?.id || 'UNKNOWN');
        
        console.log(`${shooterName} HIT ${targetType}:`, details);
    }
    
    // ========================================
    // PUBLIC UPDATE & DEBUG METHODS
    // ========================================
    
    /**
     * Update collision system (call every frame)
     */
    update() {
        // Update static objects periodically
        if (Date.now() - this.lastStaticUpdate > this.staticUpdateInterval) {
            this.updateStaticObjects();
        }
        
        // Update dynamic objects
        this.updateDynamicObjects();
    }
    
    updateDynamicObjects() {
        this.dynamicObjects = [];
        
        // Add tanks
        this.getAllTanks().forEach(tank => {
            if (!tank.isDestroyed) {
                this.dynamicObjects.push({
                    type: 'tank',
                    object: tank,
                    position: tank.mesh.position.clone(),
                    radius: this.config.tank.radius
                });
            }
        });
        
        // Add projectiles
        this.game.projectiles?.forEach(projectile => {
            this.dynamicObjects.push({
                type: 'projectile',
                object: projectile,
                position: projectile.mesh.position.clone(),
                radius: this.config.projectile.radius
            });
        });
    }
    
    /**
     * Get debug information
     * @returns {Object} Debug data
     */
    getDebugInfo() {
        return {
            config: this.config,
            staticObjects: this.staticObjects.length,
            dynamicObjects: this.dynamicObjects.length,
            terrain: {
                available: !!this.scene.userData.terrain,
                bounds: this.scene.userData.terrain ? 'Available' : 'Not Available'
            },
            performance: {
                lastStaticUpdate: this.lastStaticUpdate,
                updateInterval: this.staticUpdateInterval
            }
        };
    }
    
    /**
     * Create dust cloud effect for tank landing
     * @param {THREE.Vector3} position - Position to create dust effect
     */
    createDustCloud(position) {
        if (this.game.particleSystem) {
            this.game.particleSystem.createSmoke(position, 0.3);
        }
    }
}