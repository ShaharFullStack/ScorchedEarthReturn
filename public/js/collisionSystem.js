import * as THREE from 'three';

/**
 * Comprehensive Collision Detection System
 * Handles all collision detection for tanks, projectiles, terrain, and environment objects
 */
export class CollisionSystem {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        
        // Collision groups for optimization
        this.staticObjects = []; // Buildings, trees, rocks
        this.dynamicObjects = []; // Tanks, projectiles
        
        // Collision settings
        this.settings = {
            tankRadius: 0.95,
            projectileRadius: 0.3,
            terrainMargin: 0.25, // How much above terrain tanks sit
            buildingMargin: 0.5,
            treeMargin: 0.3
        };
        
        this.initializeCollisionGroups();
    }
    
    initializeCollisionGroups() {
        // Update static objects from game
        this.updateStaticObjects();
        
        console.log(`Collision System Initialized:
        - Static Objects: ${this.staticObjects.length}
        - Buildings: ${this.game.buildings ? this.game.buildings.length : 0}
        - Trees: ${this.game.trees ? this.game.trees.length : 0}`);
    }
    
    updateStaticObjects() {
        this.staticObjects = [];
        
        // Add buildings
        if (this.game.buildings) {
            this.game.buildings.forEach(building => {
                if (!building.userData.isDestroyed) {
                    this.staticObjects.push({
                        type: 'building',
                        object: building,
                        position: building.position.clone(),
                        radius: building.userData.collisionRadius || 4,
                        height: 6 // Approximate building height
                    });
                }
            });
        }
        
        // Add trees
        if (this.game.trees) {
            this.game.trees.forEach(tree => {
                if (!tree.userData.isDestroyed) {
                    this.staticObjects.push({
                        type: 'tree',
                        object: tree,
                        position: tree.position.clone(),
                        radius: tree.userData.collisionRadius || 2,
                        height: 4 // Approximate tree height
                    });
                }
            });
        }
    }
    
    /**
     * Check if a tank can move to a new position
     * @param {Tank} tank - The tank attempting to move
     * @param {THREE.Vector3} newPosition - The desired new position
     * @param {THREE.Vector3} moveVector - The movement vector
     * @returns {Object} - {canMove: boolean, collisionInfo: object, adjustedPosition: Vector3}
     */
    checkTankMovement(tank, newPosition, moveVector) {
        const result = {
            canMove: true,
            collisionInfo: null,
            adjustedPosition: newPosition.clone(),
            terrainHeight: 0
        };
        
        // 1. Check terrain boundaries
        const boundaryCheck = this.checkBoundaries(newPosition);
        if (!boundaryCheck.valid) {
            result.canMove = false;
            result.collisionInfo = { type: 'boundary', ...boundaryCheck };
            return result;
        }
          // 2. Check terrain height and adjust Y position using track-based collision
        const terrainCheck = this.checkTerrainCollision(newPosition, tank);
        result.adjustedPosition.y = terrainCheck.groundY;
        result.terrainHeight = terrainCheck.terrainHeight;
        result.terrainData = terrainCheck; // Include full terrain data for track-based rotation
        
        // 3. Check collision with static objects (buildings, trees)
        const staticCollision = this.checkStaticCollisions(newPosition, this.settings.tankRadius);
        if (staticCollision.hasCollision) {
            result.canMove = false;
            result.collisionInfo = staticCollision;
            return result;
        }
        
        // 4. Check collision with other tanks
        const tankCollision = this.checkTankCollisions(tank, newPosition);
        if (tankCollision.hasCollision) {
            result.canMove = false;
            result.collisionInfo = tankCollision;
            return result;
        }
        
        // 5. Check if tank would be stuck or unstable on terrain
        const stabilityCheck = this.checkTankStability(result.adjustedPosition, tank);
        if (!stabilityCheck.stable) {
            result.canMove = false;
            result.collisionInfo = { type: 'unstable', ...stabilityCheck };
            return result;
        }
        
        return result;
    }
    
    /**
     * Check boundaries of the playable area
     */
    checkBoundaries(position) {
        const maxDistance = 85; // Slightly larger than terrain size
        
        if (Math.abs(position.x) > maxDistance || Math.abs(position.z) > maxDistance) {
            return {
                valid: false,
                reason: 'boundary',
                distance: Math.sqrt(position.x * position.x + position.z * position.z)
            };
        }
        
        return { valid: true };
    }
      /**
     * Track-based terrain collision - uses actual track contact points
     */
    checkTerrainCollision(position, tank) {
        let terrainHeight = 0;
        let groundY = position.y;
        
        if (!this.scene.userData.terrain) {
            return {
                terrainHeight: 0,
                groundY: position.y,
                isUnderwater: false,
                slope: 0,
                trackHeights: { left: 0, right: 0 },
                tankRotation: { x: 0, z: 0 }
            };
        }
        
        // Get actual track contact points from tank geometry
        const trackContactPoints = this.getTrackContactPoints(tank, position);
        
        // Sample terrain heights at actual track contact points
        const leftTrackHeights = trackContactPoints.left.map(worldPos => 
            this.scene.userData.terrain.getHeightAt(worldPos.x, worldPos.z)
        );
        const rightTrackHeights = trackContactPoints.right.map(worldPos => 
            this.scene.userData.terrain.getHeightAt(worldPos.x, worldPos.z)
        );
        
        // Calculate average track heights (tracks must touch ground)
        const avgLeftHeight = leftTrackHeights.reduce((sum, h) => sum + h, 0) / leftTrackHeights.length;
        const avgRightHeight = rightTrackHeights.reduce((sum, h) => sum + h, 0) / rightTrackHeights.length;
        
        // Tank body height is based on track contact points + track height
        const trackHeight = 0.15; // Height from track bottom to tank body bottom
        const centerHeight = (avgLeftHeight + avgRightHeight) / 2;
          // Calculate tank rotation based on actual track contact
        // FIXED: Reverse the height difference so tank leans INTO the slope, not away from it
        const heightDiffLR = avgLeftHeight - avgRightHeight; // Roll (left-right tilt) - reversed for correct leaning
        const actualTrackWidth = 2.15; // Actual distance between tracks (1.075 * 2)
        const rollAngle = -Math.atan2(heightDiffLR, actualTrackWidth);
          // Calculate pitch using front and rear track contact points
        const frontLeftHeight = leftTrackHeights[leftTrackHeights.length - 1];
        const frontRightHeight = rightTrackHeights[rightTrackHeights.length - 1];
        const rearLeftHeight = leftTrackHeights[0];
        const rearRightHeight = rightTrackHeights[0];        
        const frontAvg = (frontLeftHeight + frontRightHeight) / 2;
        const rearAvg = (rearLeftHeight + rearRightHeight) / 2;
        const heightDiffFR = rearAvg - frontAvg; // Front - rear: positive when going uphill, negative when going downhill
        const actualTrackLength = 3.25; // Actual track length
        const pitchAngle = Math.atan2(heightDiffFR, actualTrackLength);
        
        terrainHeight = centerHeight;
        groundY = centerHeight + trackHeight; // Tank body sits on tracks
        
        // Calculate slope for stability
        const maxHeightDiff = Math.max(
            Math.abs(heightDiffLR),
            Math.abs(heightDiffFR)
        );
        const slope = (maxHeightDiff + Math.max(actualTrackWidth, actualTrackLength)) / 2;
        
        return {
            terrainHeight: centerHeight,
            groundY,
            isUnderwater: centerHeight < 0,
            slope,
            trackHeights: {
                left: avgLeftHeight,
                right: avgRightHeight,
                leftPoints: leftTrackHeights,
                rightPoints: rightTrackHeights
            },
            tankRotation: {
                x: pitchAngle,  // Pitch (front/back tilt)
                z: rollAngle    // Roll (left/right tilt) 
            }
        };
    }
      /**
     * Calculate terrain slope at position (for stability checks)
     */    calculateTerrainSlope(position) {
        if (!this.scene.userData.terrain) return 0;return 0;
        
        const sampleDistance = 2.0; // Increased for smoother slope calculation
        const centerHeight = this.scene.userData.terrain.getHeightAt(position.x, position.z);
        const northHeight = this.scene.userData.terrain.getHeightAt(position.x, position.z + sampleDistance);
        const eastHeight = this.scene.userData.terrain.getHeightAt(position.x + sampleDistance, position.z);
        const southHeight = this.scene.userData.terrain.getHeightAt(position.x, position.z - sampleDistance);
        const westHeight = this.scene.userData.terrain.getHeightAt(position.x - sampleDistance, position.z);
        
        // Calculate slopes in all directions and use average for more stability
        const slopeX = Math.abs(eastHeight - westHeight) / (sampleDistance * 2);
        const slopeZ = Math.abs(northHeight - southHeight) / (sampleDistance * 2);
        
        return Math.max(slopeX, slopeZ);
    }
    
    /**
     * Check collision with static objects (buildings, trees)
     */
    checkStaticCollisions(position, objectRadius) {
        for (const staticObj of this.staticObjects) {
            const distance = position.distanceTo(staticObj.position);
            const combinedRadius = objectRadius + staticObj.radius;
            
            if (distance < combinedRadius) {
                return {
                    hasCollision: true,
                    type: 'static',
                    objectType: staticObj.type,
                    object: staticObj.object,
                    distance: distance,
                    penetration: combinedRadius - distance,
                    direction: position.clone().sub(staticObj.position).normalize()
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check collision with other tanks
     */
    checkTankCollisions(movingTank, newPosition) {
        const allTanks = [this.game.playerTank, ...this.game.enemyTanks];
        
        for (const tank of allTanks) {
            if (tank === movingTank || tank.isDestroyed) continue;
            
            const distance = newPosition.distanceTo(tank.mesh.position);
            const combinedRadius = this.settings.tankRadius * 2; // Two tank radii
            
            if (distance < combinedRadius) {
                return {
                    hasCollision: true,
                    type: 'tank',
                    tank: tank,
                    distance: distance,
                    penetration: combinedRadius - distance,
                    direction: newPosition.clone().sub(tank.mesh.position).normalize()
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check if tank would be stable at the position
     */    checkTankStability(position, tank) {
        const slope = this.calculateTerrainSlope(position);
        const maxSlope = 1.2; // Increased from 0.9 for more forgiving movement (about 50 degrees)
        
        if (slope > maxSlope) {
            return {
                stable: false,
                reason: 'too_steep',
                slope: slope,
                maxSlope: maxSlope
            };
        }
        
        // Check if position is too far underwater
        const terrainHeight = this.scene.userData.terrain ? 
            this.scene.userData.terrain.getHeightAt(position.x, position.z) : 0;
            
        if (terrainHeight < -2) {
            return {
                stable: false,
                reason: 'underwater',
                depth: Math.abs(terrainHeight)
            };
        }
        
        return { stable: true };
    }
    
    /**
     * Check projectile collisions with all possible targets
     * @param {Projectile} projectile - The projectile to check
     * @returns {Object} - Collision result with detailed information
     */
    checkProjectileCollisions(projectile) {
        const projectilePos = projectile.mesh.position;
        
        // 1. Check tank collisions
        const tankCollision = this.checkProjectileTankCollisions(projectile);
        if (tankCollision.hasCollision) {
            return {
                type: 'tank',
                hasCollision: true,
                ...tankCollision
            };
        }
        
        // 2. Check static object collisions
        const staticCollision = this.checkProjectileStaticCollisions(projectile);
        if (staticCollision.hasCollision) {
            return {
                type: 'static',
                hasCollision: true,
                ...staticCollision
            };
        }
        
        // 3. Check terrain collision
        const terrainCollision = this.checkProjectileTerrainCollision(projectile);
        if (terrainCollision.hasCollision) {
            return {
                type: 'terrain',
                hasCollision: true,
                ...terrainCollision
            };
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with tanks
     */
    checkProjectileTankCollisions(projectile) {
        const targets = projectile.firedByPlayer ? this.game.enemyTanks : [this.game.playerTank];
        
        for (const tank of targets) {
            if (tank.isDestroyed) continue;
            
            const distance = projectile.mesh.position.distanceTo(tank.mesh.position);
            const combinedRadius = tank.collisionRadius + projectile.collisionRadius;
            
            if (distance < combinedRadius) {
                // Calculate impact point and angle
                const impactPoint = this.calculateImpactPoint(projectile, tank);
                const impactAngle = this.calculateImpactAngle(projectile, tank);
                
                return {
                    hasCollision: true,
                    tank: tank,
                    impactPoint: impactPoint,
                    impactAngle: impactAngle,
                    distance: distance,
                    penetration: combinedRadius - distance + projectile.collisionRadius,
                    direction: projectile.mesh.position.clone().sub(tank.mesh.position).normalize(),
                    damage: this.calculateDamage(projectile, tank, impactAngle)
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with static objects
     */
    checkProjectileStaticCollisions(projectile) {
        const projectilePos = projectile.mesh.position;
        
        for (const staticObj of this.staticObjects) {
            const distance = projectilePos.distanceTo(staticObj.position);
            const combinedRadius = staticObj.radius + projectile.collisionRadius;
            
            if (distance < combinedRadius) {
                const impactPoint = projectilePos.clone();
                
                return {
                    hasCollision: true,
                    objectType: staticObj.type,
                    object: staticObj.object,
                    impactPoint: impactPoint,
                    distance: distance,
                    penetration: combinedRadius - distance,
                    damage: projectile.damage
                };
            }
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Check projectile collision with terrain
     */
    checkProjectileTerrainCollision(projectile) {
        const projectilePos = projectile.mesh.position;
        
        if (!this.scene.userData.terrain) {
            // Fallback ground level
            if (projectilePos.y <= 0) {
                return {
                    hasCollision: true,
                    impactPoint: new THREE.Vector3(projectilePos.x, 0, projectilePos.z),
                    terrainHeight: 0
                };
            }
            return { hasCollision: false };
        }
        
        const terrainHeight = this.scene.userData.terrain.getHeightAt(projectilePos.x, projectilePos.z);
        
        if (projectilePos.y <= terrainHeight + projectile.collisionRadius) {
            const impactPoint = new THREE.Vector3(projectilePos.x, terrainHeight, projectilePos.z);
            
            return {
                hasCollision: true,
                impactPoint: impactPoint,
                terrainHeight: terrainHeight,
                crater: {
                    position: impactPoint,
                    radius: 4,
                    depth: 1.5
                }
            };
        }
        
        return { hasCollision: false };
    }
    
    /**
     * Calculate impact point between projectile and target
     */
    calculateImpactPoint(projectile, target) {
        const projectilePos = projectile.mesh.position.clone();
        const targetPos = target.mesh.position.clone();
        
        // Adjust target position to tank center
        targetPos.y += 0.8;
        
        // Calculate intersection point on tank surface
        const direction = projectilePos.clone().sub(targetPos).normalize();
        const impactPoint = targetPos.clone().add(direction.multiplyScalar(target.collisionRadius));
        
        return impactPoint;
    }
    
    /**
     * Calculate impact angle for damage calculation
     */
    calculateImpactAngle(projectile, target) {
        const velocity = projectile.velocity.clone().normalize();
        const toTarget = target.mesh.position.clone().sub(projectile.mesh.position).normalize();
        
        // Calculate angle between projectile velocity and line to target
        const dotProduct = velocity.dot(toTarget);
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        
        return angle;
    }
    
    /**
     * Calculate damage based on impact conditions
     */
    calculateDamage(projectile, target, impactAngle) {
        let damage = projectile.damage;
        
        // Angle modifier (direct hits do more damage)
        const angleModifier = Math.cos(impactAngle);
        damage *= (0.7 + 0.3 * angleModifier);
        
        // Speed modifier
        const speed = projectile.velocity.length();
        const speedModifier = Math.min(1.5, speed / 50); // More damage for faster projectiles
        damage *= speedModifier;
        
        return Math.round(damage);
    }
    
    /**
     * Apply collision effects (damage, destruction, etc.)
     */
    applyCollisionEffects(collisionResult, projectile) {
        if (!collisionResult.hasCollision) return;
        
        switch (collisionResult.type) {
            case 'tank':
                this.handleTankHit(collisionResult, projectile);
                break;
                
            case 'static':
                this.handleStaticObjectHit(collisionResult, projectile);
                break;
                
            case 'terrain':
                this.handleTerrainHit(collisionResult, projectile);
                break;
        }
        
        // Mark projectile for removal
        projectile.shouldBeRemoved = true;
    }
    
    /**
     * Handle tank hit effects
     */
    handleTankHit(collisionResult, projectile) {
        const tank = collisionResult.tank;
        const damage = collisionResult.damage;
        const impactPoint = collisionResult.impactPoint;
        
        // Log hit details
        const shooterName = projectile.shootingTank ? 
            (projectile.shootingTank.isPlayer ? 'PLAYER' : projectile.shootingTank.id) : 'UNKNOWN';
        const targetName = tank.isPlayer ? 'PLAYER' : tank.id;
        
        console.log(`${shooterName} HIT ${targetName}:`, {
            impactPosition: `(${impactPoint.x.toFixed(2)}, ${impactPoint.y.toFixed(2)}, ${impactPoint.z.toFixed(2)})`,
            targetPosition: `(${tank.mesh.position.x.toFixed(2)}, ${tank.mesh.position.y.toFixed(2)}, ${tank.mesh.position.z.toFixed(2)})`,
            distance: `${collisionResult.distance.toFixed(2)} units`,
            damage: `${damage} HP`,
            targetHealthBefore: `${tank.currentHealth} HP`,
            targetHealthAfter: `${Math.max(0, tank.currentHealth - damage)} HP`,
            impactAngle: `${(collisionResult.impactAngle * 180 / Math.PI).toFixed(1)}°`
        });
        
        // Apply damage
        tank.takeDamage(damage);
        
        // Create particle effects
        if (this.game.particleSystem) {
            const intensity = 1.2 - (tank.currentHealth / tank.maxHealth * 0.5);
            this.game.particleSystem.createTankHitEffect(impactPoint, intensity);
        }
        
        // Play sound effects
        if (this.game.audioManager) {
            this.game.audioManager.playSound('tankHit');
            if (tank.isDestroyed) {
                this.game.audioManager.playSound('explosion');
            }
        }
    }
    
    /**
     * Handle static object hit effects
     */
    handleStaticObjectHit(collisionResult, projectile) {
        const object = collisionResult.object;
        const impactPoint = collisionResult.impactPoint;
        
        // Log impact
        const shooterName = projectile.shootingTank ? 
            (projectile.shootingTank.isPlayer ? 'PLAYER' : projectile.shootingTank.id) : 'UNKNOWN';
        
        console.log(`${shooterName} HIT ${collisionResult.objectType.toUpperCase()}:`, {
            impactPosition: `(${impactPoint.x.toFixed(2)}, ${impactPoint.y.toFixed(2)}, ${impactPoint.z.toFixed(2)})`,
            objectPosition: `(${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})`,
            distance: `${collisionResult.distance.toFixed(2)} units`,
            damage: `${projectile.damage} HP`
        });
        
        // Create appropriate effects
        if (this.game.particleSystem) {
            if (collisionResult.objectType === 'building') {
                this.game.particleSystem.createSmoke(impactPoint, 0.8);
                this.game.particleSystem.createMetalDebris(impactPoint, 0.6);
            } else if (collisionResult.objectType === 'tree') {
                this.game.particleSystem.createSmoke(impactPoint, 0.3);
            }
        }
        
        // Apply damage to object
        if (collisionResult.objectType === 'building') {
            this.game.damageBuilding(object, projectile);
        } else if (collisionResult.objectType === 'tree') {
            this.game.destroyTree(object, projectile);
        }
        
        // Play sound effects
        if (this.game.audioManager) {
            if (collisionResult.objectType === 'building') {
                this.game.audioManager.playSound('hitBuilding');
            } else if (collisionResult.objectType === 'tree') {
                this.game.audioManager.playSound('hitTree');
            }
        }
    }
    
    /**
     * Handle terrain hit effects
     */
    handleTerrainHit(collisionResult, projectile) {
        const impactPoint = collisionResult.impactPoint;
        const crater = collisionResult.crater;
        
        // Log ground impact
        const shooterName = projectile.shootingTank ? 
            (projectile.shootingTank.isPlayer ? 'PLAYER' : projectile.shootingTank.id) : 'UNKNOWN';
        const shooterPos = projectile.shootingTank ? projectile.shootingTank.mesh.position : new THREE.Vector3(0, 0, 0);
        const actualRange = Math.sqrt(
            Math.pow(impactPoint.x - shooterPos.x, 2) + 
            Math.pow(impactPoint.z - shooterPos.z, 2)
        );
        
        console.log(`${shooterName} HIT GROUND:`, {
            impactPosition: `(${impactPoint.x.toFixed(2)}, ${impactPoint.y.toFixed(2)}, ${impactPoint.z.toFixed(2)})`,
            shooterPosition: `(${shooterPos.x.toFixed(2)}, ${shooterPos.y.toFixed(2)}, ${shooterPos.z.toFixed(2)})`,
            actualRange: `${actualRange.toFixed(1)} units`,
            terrainHeight: `${collisionResult.terrainHeight.toFixed(2)}`,
            craterDepth: `${crater.depth.toFixed(1)}`
        });
        
        // Deform terrain
        if (this.scene.userData.terrain) {
            this.scene.userData.terrain.deformTerrain(impactPoint, crater.radius, crater.depth);
        }
        
        // Create effects
        if (this.game.particleSystem) {
            this.game.particleSystem.createSmoke(impactPoint, 0.5);
            this.game.particleSystem.createMetalDebris(impactPoint, 0.3);
        }
        
        // Play sound
        if (this.game.audioManager) {
            this.game.audioManager.playSound('groundHit');
        }
        
        // Create dust cloud
        this.createDustCloud(impactPoint);
    }
    
    /**
     * Create dust cloud effect for ground impacts
     */
    createDustCloud(position) {
        const dust = new THREE.Mesh(
            new THREE.SphereGeometry(1.5, 12, 12),
            new THREE.MeshStandardMaterial({ 
                color: 0x964B00,
                transparent: true, 
                opacity: 0.6,
                roughness: 0.8
            })
        );
        dust.position.copy(position);
        this.scene.add(dust);
        
        setTimeout(() => this.scene.remove(dust), 500);
    }
    
    /**
     * Update collision system (call every frame)
     */
    update() {
        // Update static objects list if needed
        this.updateStaticObjects();
        
        // Update dynamic collision data
        this.updateDynamicCollisions();
    }
    
    /**
     * Update dynamic collision objects
     */
    updateDynamicCollisions() {
        this.dynamicObjects = [];
        
        // Add all tanks
        if (this.game.playerTank && !this.game.playerTank.isDestroyed) {
            this.dynamicObjects.push({
                type: 'tank',
                object: this.game.playerTank,
                position: this.game.playerTank.mesh.position.clone(),
                radius: this.settings.tankRadius
            });
        }
        
        this.game.enemyTanks.forEach(tank => {
            if (!tank.isDestroyed) {
                this.dynamicObjects.push({
                    type: 'tank',
                    object: tank,
                    position: tank.mesh.position.clone(),
                    radius: this.settings.tankRadius
                });
            }
        });
        
        // Add all projectiles
        this.game.projectiles.forEach(projectile => {
            this.dynamicObjects.push({
                type: 'projectile',
                object: projectile,
                position: projectile.mesh.position.clone(),
                radius: this.settings.projectileRadius
            });
        });
    }
    
    /**
     * Get debug information about collisions
     */
    getDebugInfo() {
        return {
            staticObjects: this.staticObjects.length,
            dynamicObjects: this.dynamicObjects.length,
            settings: this.settings
        };
    }
    
    /**
     * Get actual track contact points from tank geometry
     */
    getTrackContactPoints(tank, position) {
        const tankPos = position || tank.mesh.position;
        const tankRotationY = tank.mesh.rotation.y;
        
        // Track dimensions from tank.js
        const trackWidth = 0.4;  // Track width
        const trackLength = 3.25; // Track length
        const trackOffset = 1.075; // Distance from center to track center
        
        // Sample points along each track (front to rear)
        const sampleCount = 4;
        const leftTrackPoints = [];
        const rightTrackPoints = [];
        
        for (let i = 0; i < sampleCount; i++) {
            // Calculate position along track (from rear to front)
            const t = i / (sampleCount - 1);
            const localZ = (t - 0.5) * trackLength; // -1.625 to +1.625
            
            // Left track points (relative to tank center)
            const leftLocalX = -trackOffset; // -1.075
            const rightLocalX = trackOffset;  // +1.075
            
            // Transform to world coordinates considering tank rotation
            const cos = Math.cos(tankRotationY);
            const sin = Math.sin(tankRotationY);
            
            // Left track contact point
            const leftWorldX = tankPos.x + (leftLocalX * cos - localZ * sin);
            const leftWorldZ = tankPos.z + (leftLocalX * sin + localZ * cos);
            leftTrackPoints.push(new THREE.Vector3(leftWorldX, 0, leftWorldZ));
            
            // Right track contact point
            const rightWorldX = tankPos.x + (rightLocalX * cos - localZ * sin);
            const rightWorldZ = tankPos.z + (rightLocalX * sin + localZ * cos);
            rightTrackPoints.push(new THREE.Vector3(rightWorldX, 0, rightWorldZ));
        }
        
        return {
            left: leftTrackPoints,
            right: rightTrackPoints
        };
    }
    
    /**
     * Check if a position is suitable for tank spawning
     * This method considers both horizontal clearance and vertical height of obstacles
     * @param {THREE.Vector3} position - The position to check
     * @param {number} tankRadius - The tank's collision radius
     * @param {number} minClearance - Minimum clearance distance from obstacles
     * @returns {Object} - {suitable: boolean, reason: string, conflictingObject: object}
     */
    checkTankSpawnSuitability(position, tankRadius = 1.5, minClearance = 3.0) {
        // Check boundaries first
        const boundaryCheck = this.checkBoundaries(position);
        if (!boundaryCheck.valid) {
            return {
                suitable: false,
                reason: 'boundary',
                conflictingObject: null
            };
        }

        // Get terrain height at position
        let terrainHeight = 0;
        if (this.scene.userData.terrain) {
            terrainHeight = this.scene.userData.terrain.getHeightAt(position.x, position.z);
        }

        // Check if position is underwater or too steep
        if (terrainHeight < -1) {
            return {
                suitable: false,
                reason: 'underwater',
                conflictingObject: null
            };
        }

        const slope = this.calculateTerrainSlope(position);
        if (slope > 0.8) { // More strict slope check for spawning
            return {
                suitable: false,
                reason: 'too_steep',
                conflictingObject: null
            };
        }

        // Check clearance from static objects with enhanced 3D collision detection
        for (const staticObj of this.staticObjects) {
            const horizontalDistance = Math.sqrt(
                Math.pow(position.x - staticObj.position.x, 2) + 
                Math.pow(position.z - staticObj.position.z, 2)
            );
            
            // Calculate required clearance based on object type and size
            let requiredClearance = minClearance;
            if (staticObj.type === 'building') {
                requiredClearance = Math.max(minClearance, staticObj.radius + 2.0); // Extra clearance for buildings
            } else if (staticObj.type === 'tree') {
                requiredClearance = Math.max(minClearance, staticObj.radius + 1.5); // Moderate clearance for trees
            }

            if (horizontalDistance < requiredClearance) {
                return {
                    suitable: false,
                    reason: `too_close_to_${staticObj.type}`,
                    conflictingObject: staticObj,
                    distance: horizontalDistance,
                    requiredClearance: requiredClearance
                };
            }

            // Additional check for vertical clearance under tall objects
            if (staticObj.height && staticObj.height > 3) {
                // Check if tank would spawn underneath a tall object
                const verticalDistance = Math.abs(terrainHeight - staticObj.position.y);
                if (horizontalDistance < staticObj.radius * 1.5 && verticalDistance < staticObj.height) {
                    return {
                        suitable: false,
                        reason: `underneath_${staticObj.type}`,
                        conflictingObject: staticObj
                    };
                }
            }
        }

        // Check for adequate space around the position (no clustering)
        const samplingRadius = minClearance * 1.5;
        const samplePoints = 8; // Check 8 points around the position
        
        for (let i = 0; i < samplePoints; i++) {
            const angle = (i / samplePoints) * Math.PI * 2;
            const sampleX = position.x + Math.cos(angle) * samplingRadius;
            const sampleZ = position.z + Math.sin(angle) * samplingRadius;
            const samplePos = new THREE.Vector3(sampleX, 0, sampleZ);
            
            // Check if any sample point is too close to obstacles
            for (const staticObj of this.staticObjects) {
                const sampleDistance = samplePos.distanceTo(staticObj.position);
                if (sampleDistance < staticObj.radius + 1.0) {
                    return {
                        suitable: false,
                        reason: `insufficient_space_around_${staticObj.type}`,
                        conflictingObject: staticObj
                    };
                }
            }
        }

        return {
            suitable: true,
            reason: 'clear',
            conflictingObject: null
        };
    }
}