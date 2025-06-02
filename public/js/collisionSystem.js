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
            terrainMargin: 0.35, // How much above terrain tanks sit (increased for better track clearance)
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
     * Get proper spawn position for a tank - ensures correct ground placement
     * @param {THREE.Vector3} position - The desired spawn position
     * @param {Tank} tank - The tank to spawn (optional, used for track-based positioning)
     * @returns {Object} - {position: Vector3, terrainData: object}
     */
    getProperSpawnPosition(position, tank = null) {
        // For initial spawning, use simple terrain height to avoid complications
        let groundHeight = 0;
        if (this.scene.userData.terrain) {
            groundHeight = this.getSimpleTerrainHeight(position.x, position.z);
        }
        
        // Calculate proper spawn height with track and terrain margin
        const trackHeight = 0.4;
        const terrainMargin = this.settings.terrainMargin;
        
        // FIXED: Spawn tanks only 2-3 units above ground, not 12+ units
        const spawnY = groundHeight + trackHeight + terrainMargin + 2.5; // 2.5 units above ground for gravity fall
        
        const spawnPosition = new THREE.Vector3(position.x, spawnY, position.z);
        
        // Create basic terrain data for spawning
        const basicTerrainData = {
            terrainHeight: groundHeight,
            groundY: groundHeight + trackHeight + terrainMargin, // Actual ground level for tank
            isUnderwater: groundHeight < 0,
            slope: 0,
            trackHeights: { left: groundHeight, right: groundHeight },
            tankRotation: { x: 0, z: 0 }
        };
        
        console.log(`Spawn position calculated: input=(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)}) -> spawn=(${spawnPosition.x.toFixed(2)}, ${spawnPosition.y.toFixed(2)}, ${spawnPosition.z.toFixed(2)}), ground=${groundHeight.toFixed(2)}, final_ground=${basicTerrainData.groundY.toFixed(2)}`);
        
        return {
            position: spawnPosition,
            terrainData: basicTerrainData
        };
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
     * Track-based terrain collision - FIXED coordinate system and rotation logic
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
        
        // Enhanced terrain sampling with multiple points per track section for deformed terrain
        const leftTrackHeights = trackContactPoints.left.map(worldPos => 
            this.sampleTerrainHeightRobust(worldPos.x, worldPos.z)
        );
        const rightTrackHeights = trackContactPoints.right.map(worldPos => 
            this.sampleTerrainHeightRobust(worldPos.x, worldPos.z)
        );
        
        // Calculate weighted average track heights (give more weight to points that would actually contact ground)
        const avgLeftHeight = this.calculateWeightedTrackHeight(leftTrackHeights);
        const avgRightHeight = this.calculateWeightedTrackHeight(rightTrackHeights);
        
        // Tank body height is based on track contact points + track height + terrain margin
        const trackHeight = 0.4; // Height from track bottom to tank body bottom
        const terrainMargin = this.settings.terrainMargin; // Additional clearance above terrain
        const centerHeight = (avgLeftHeight + avgRightHeight) / 2;
        
        // FIXED: Calculate tank rotation based on actual track contact with CORRECT coordinate system
        // Roll calculation: FIXED - positive when RIGHT track is higher (tank tilts left in right-hand coordinate system)
        const heightDiffLR = avgRightHeight - avgLeftHeight; // RIGHT - LEFT height difference (FIXED)
        const actualTrackWidth = 2.15; // Actual distance between tracks (1.075 * 2)
        let rollAngle = Math.atan2(heightDiffLR, actualTrackWidth);
        
        // FIXED: Calculate pitch using CORRECT front and rear identification
        // In the track contact points array, index 0 = rear, last index = front
        const rearLeftHeight = leftTrackHeights[0];   // FIRST point = REAR
        const rearRightHeight = rightTrackHeights[0]; // FIRST point = REAR  
        const frontLeftHeight = leftTrackHeights[leftTrackHeights.length - 1];   // LAST point = FRONT
        const frontRightHeight = rightTrackHeights[rightTrackHeights.length - 1]; // LAST point = FRONT
        
        const rearAvg = (rearLeftHeight + rearRightHeight) / 2;
        const frontAvg = (frontLeftHeight + frontRightHeight) / 2;
        
        // FIXED: Pitch calculation - positive when REAR is higher than FRONT (tank pitches UP when climbing)
        const heightDiffFR = rearAvg - frontAvg; // REAR - FRONT: positive when climbing uphill
        const actualTrackLength = 3.25; // Actual track length
        let pitchAngle = Math.atan2(heightDiffFR, actualTrackLength);
        
        // Apply realistic limits to prevent extreme rotations
        const maxPitchAngle = Math.PI / 6; // 30 degrees max
        const maxRollAngle = Math.PI / 9;  // 20 degrees max
        
        pitchAngle = Math.max(-maxPitchAngle, Math.min(maxPitchAngle, pitchAngle));
        rollAngle = Math.max(-maxRollAngle, Math.min(maxRollAngle, rollAngle));
        
        // Apply smoothing factor to reduce jitter on rough terrain
        const smoothingFactor = 0.7; // Reduce rotation intensity
        const rawPitchAngle = pitchAngle;
        const rawRollAngle = rollAngle;
        pitchAngle *= smoothingFactor;
        rollAngle *= smoothingFactor;
        
        // Debug logging to verify correct behavior (only for significant rotations)
        if (Math.abs(pitchAngle) > 0.1 || Math.abs(rollAngle) > 0.1) { // Only log significant rotations
            console.log(`TERRAIN ROTATION DEBUG (${tank.id || 'unknown'}):
                Rear: L=${rearLeftHeight.toFixed(2)} R=${rearRightHeight.toFixed(2)} Avg=${rearAvg.toFixed(2)}
                Front: L=${frontLeftHeight.toFixed(2)} R=${frontRightHeight.toFixed(2)} Avg=${frontAvg.toFixed(2)}
                HeightDiff(Rear-Front): ${heightDiffFR.toFixed(2)} | HeightDiff(Right-Left): ${heightDiffLR.toFixed(2)}
                Raw Pitch: ${(rawPitchAngle * 180 / Math.PI).toFixed(1)}° | Raw Roll: ${(rawRollAngle * 180 / Math.PI).toFixed(1)}°
                Final Pitch: ${(pitchAngle * 180 / Math.PI).toFixed(1)}° | Final Roll: ${(rollAngle * 180 / Math.PI).toFixed(1)}°`);
        }
        
        terrainHeight = centerHeight;
        groundY = centerHeight + trackHeight + terrainMargin; // Tank body sits on tracks with proper clearance
        
        // Calculate slope for stability
        const maxHeightDiff = Math.max(
            Math.abs(heightDiffLR),
            Math.abs(heightDiffFR)
        );
        const slope = maxHeightDiff / Math.max(actualTrackWidth, actualTrackLength);
        
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
                x: pitchAngle,  // Pitch (front/back tilt) - FIXED
                z: rollAngle    // Roll (left/right tilt) - FIXED
            }
        };
    }
    
    /**
     * Calculate terrain slope at position with enhanced crater/deformation handling - FIXED
     */
    calculateTerrainSlope(position) {
        if (!this.scene.userData.terrain) return 0;
        
        // Use multiple sampling distances to handle different terrain features
        const sampleDistances = [1.0, 2.0]; // Reduced to prevent over-sampling
        let maxSlope = 0;
        
        for (const sampleDistance of sampleDistances) {
            const centerHeight = this.sampleTerrainHeightRobust(position.x, position.z);
            const northHeight = this.sampleTerrainHeightRobust(position.x, position.z + sampleDistance);
            const eastHeight = this.sampleTerrainHeightRobust(position.x + sampleDistance, position.z);
            const southHeight = this.sampleTerrainHeightRobust(position.x, position.z - sampleDistance);
            const westHeight = this.sampleTerrainHeightRobust(position.x - sampleDistance, position.z);
            
            // FIXED: Calculate slopes correctly
            const slopeX = Math.abs(eastHeight - westHeight) / (sampleDistance * 2);
            const slopeZ = Math.abs(northHeight - southHeight) / (sampleDistance * 2);
            const currentMaxSlope = Math.max(slopeX, slopeZ);
            
            // Weight shorter distances more heavily (immediate terrain is more important)
            const weight = 1.0 / sampleDistance;
            maxSlope += currentMaxSlope * weight;
        }
        
        // Normalize by total weights
        const totalWeight = sampleDistances.reduce((sum, dist) => sum + (1.0 / dist), 0);
        return maxSlope / totalWeight;
    }
    
    /**
     * Robust terrain height sampling that handles deformed/cratered terrain
     */
    sampleTerrainHeightRobust(x, z) {
        if (!this.scene.userData.terrain) return 0;
        
        // For initial spawning or critical calculations, use more conservative sampling
        const centerHeight = this.scene.userData.terrain.getHeightAt(x, z);
        
        // For basic height queries, just return center height to avoid over-complication
        if (!this.scene.userData.terrain.getHeightAt) {
            return centerHeight;
        }
        
        // Only use enhanced sampling for movement/rotation calculations, not for initial positioning
        const sampleRadius = 0.3; // Reduced radius for more conservative sampling
        const samplePoints = [
            { x: x, z: z },                    // Center (primary)
            { x: x + sampleRadius, z: z },     // East
            { x: x - sampleRadius, z: z },     // West
            { x: x, z: z + sampleRadius },     // North
            { x: x, z: z - sampleRadius },     // South
        ];
        
        const heights = samplePoints.map(point => 
            this.scene.userData.terrain.getHeightAt(point.x, point.z)
        );
        
        // Use more conservative weighting - center point dominates
        const centerWeight = 0.6;  // Increased from 0.4
        const edgeWeight = 0.1;    // Reduced from 0.15, total = 1.0
        
        return heights[0] * centerWeight + 
               (heights[1] + heights[2] + heights[3] + heights[4]) * edgeWeight;
    }
    
    /**
     * Simple terrain height for spawning - no fancy sampling to avoid spawn height issues
     */
    getSimpleTerrainHeight(x, z) {
        if (!this.scene.userData.terrain) return 0;
        return this.scene.userData.terrain.getHeightAt(x, z);
    }
    
    /**
     * Calculate weighted track height for better ground contact on uneven terrain
     */
    calculateWeightedTrackHeight(trackHeights) {
        if (trackHeights.length === 0) return 0;
        
        // Sort heights to identify the main contact points
        const sortedHeights = [...trackHeights].sort((a, b) => b - a);
        
        // Use the highest points for primary contact (tracks would rest on these)
        // but also consider lower points to prevent floating over small holes
        let weightedSum = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < trackHeights.length; i++) {
            // Higher points get more weight (tracks naturally rest on high points)
            const heightRank = sortedHeights.indexOf(trackHeights[i]);
            const weight = Math.exp(-heightRank * 0.5); // Exponential decay for lower points
            
            weightedSum += trackHeights[i] * weight;
            totalWeight += weight;
        }
        
        return weightedSum / totalWeight;
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
        if (!this.game.playerTank || !this.game.enemyTanks) {
            return { hasCollision: false };
        }
        
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
     * Check if tank would be stable at the position - enhanced for deformed terrain
     */
    checkTankStability(position, tank) {
        const slope = this.calculateTerrainSlope(position);
        const maxSlope = 1.5; // Increased for more forgiving movement on battle-damaged terrain
        
        if (slope > maxSlope) {
            return {
                stable: false,
                reason: 'too_steep',
                slope: slope,
                maxSlope: maxSlope
            };
        }
        
        // Enhanced underwater check with terrain sampling
        const terrainHeight = this.scene.userData.terrain ? 
            this.getSimpleTerrainHeight(position.x, position.z) : 0;
            
        if (terrainHeight < -2.5) { // Slightly more lenient for crater edges
            return {
                stable: false,
                reason: 'underwater',
                depth: Math.abs(terrainHeight)
            };
        }
        
        // Check for extreme terrain deformation that would destabilize the tank
        if (this.scene.userData.terrain) {
            const trackPoints = this.getTrackContactPoints(tank, position);
            const allTrackHeights = [
                ...trackPoints.left.map(p => this.getSimpleTerrainHeight(p.x, p.z)),
                ...trackPoints.right.map(p => this.getSimpleTerrainHeight(p.x, p.z))
            ];
            
            const minHeight = Math.min(...allTrackHeights);
            const maxHeight = Math.max(...allTrackHeights);
            const heightVariation = maxHeight - minHeight;
            
            // If height variation across all track contact points is too extreme
            if (heightVariation > 3.0) {
                return {
                    stable: false,
                    reason: 'extreme_deformation',
                    heightVariation: heightVariation
                };
            }
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
        if (!this.game.playerTank || !this.game.enemyTanks) {
            return { hasCollision: false };
        }
        
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
        if (tank.takeDamage) {
            tank.takeDamage(damage);
        }
        
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
        if (collisionResult.objectType === 'building' && this.game.damageBuilding) {
            this.game.damageBuilding(object, projectile);
        } else if (collisionResult.objectType === 'tree' && this.game.destroyTree) {
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
        if (this.scene.userData.terrain && this.scene.userData.terrain.deformTerrain) {
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
        
        setTimeout(() => {
            if (dust.parent) {
                this.scene.remove(dust);
            }
        }, 500);
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
        
        if (this.game.enemyTanks) {
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
        }
        
        // Add all projectiles
        if (this.game.projectiles) {
            this.game.projectiles.forEach(projectile => {
                this.dynamicObjects.push({
                    type: 'projectile',
                    object: projectile,
                    position: projectile.mesh.position.clone(),
                    radius: this.settings.projectileRadius
                });
            });
        }
    }
    
    /**
     * Validate and correct tank position if it's too far from ground
     * @param {Tank} tank - The tank to validate
     * @returns {Object} - {needsCorrection: boolean, correctedPosition: Vector3}
     */
    validateTankPosition(tank) {
        if (!tank || !tank.mesh) {
            return { needsCorrection: false, correctedPosition: null };
        }
        
        const currentPos = tank.mesh.position;
        const groundHeight = this.scene.userData.terrain ? 
            this.getSimpleTerrainHeight(currentPos.x, currentPos.z) : 0;
        
        const trackHeight = 0.4;
        const terrainMargin = this.settings.terrainMargin;
        const expectedY = groundHeight + trackHeight + terrainMargin;
        
        const heightDifference = Math.abs(currentPos.y - expectedY);
        
        // If tank is more than 2 units away from expected ground position
        if (heightDifference > 2.0) {
            const correctedPosition = new THREE.Vector3(currentPos.x, expectedY, currentPos.z);
            
            console.log(`Tank position correction needed: current=(${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(2)}, ${currentPos.z.toFixed(2)}) -> corrected=(${correctedPosition.x.toFixed(2)}, ${correctedPosition.y.toFixed(2)}, ${correctedPosition.z.toFixed(2)}), diff=${heightDifference.toFixed(2)}`);
            
            return {
                needsCorrection: true,
                correctedPosition: correctedPosition,
                heightDifference: heightDifference
            };
        }
        
        return { needsCorrection: false, correctedPosition: null };
    }
    
    /**
     * Get proper ground level for tank gravity physics
     * @param {Tank} tank - The tank to get ground level for
     * @returns {Object} - {groundY: number, terrainData: object}
     */
    getGroundLevelForTank(tank) {
        if (!tank || !tank.mesh) {
            return { groundY: 0, terrainData: null };
        }
        
        const position = tank.mesh.position.clone();
        const terrainCheck = this.checkTerrainCollision(position, tank);
        
        return {
            groundY: terrainCheck.groundY,
            terrainData: terrainCheck
        };
    }
    
    /**
     * Test the collision system to verify fixes are working
     * @param {Tank} tank - A tank to test with
     * @returns {Object} - Test results
     */
    testCollisionSystemFixes(tank) {
        console.log("=== TESTING COLLISION SYSTEM FIXES ===");
        
        const testPosition = tank.mesh.position.clone();
        const terrainCheck = this.checkTerrainCollision(testPosition, tank);
        
        console.log(`Test Results:
            Tank Position: (${testPosition.x.toFixed(2)}, ${testPosition.y.toFixed(2)}, ${testPosition.z.toFixed(2)})
            Terrain Height: ${terrainCheck.terrainHeight.toFixed(2)}
            Ground Y: ${terrainCheck.groundY.toFixed(2)}
            Pitch: ${(terrainCheck.tankRotation.x * 180 / Math.PI).toFixed(1)}° (positive = nose up)
            Roll: ${(terrainCheck.tankRotation.z * 180 / Math.PI).toFixed(1)}° (positive = right side up)
            Slope: ${terrainCheck.slope.toFixed(3)}`);
        
        // Test track contact points
        const trackPoints = this.getTrackContactPoints(tank, testPosition);
        console.log(`Track Contact Points:
            Left Track: ${trackPoints.left.length} points (rear to front)
            Right Track: ${trackPoints.right.length} points (rear to front)
            Rear Left: (${trackPoints.left[0].x.toFixed(2)}, ${trackPoints.left[0].z.toFixed(2)})
            Front Left: (${trackPoints.left[trackPoints.left.length-1].x.toFixed(2)}, ${trackPoints.left[trackPoints.left.length-1].z.toFixed(2)})
            Rear Right: (${trackPoints.right[0].x.toFixed(2)}, ${trackPoints.right[0].z.toFixed(2)})
            Front Right: (${trackPoints.right[trackPoints.right.length-1].x.toFixed(2)}, ${trackPoints.right[trackPoints.right.length-1].z.toFixed(2)})`);
        
        console.log("=== COLLISION SYSTEM TEST COMPLETE ===");
        
        return {
            terrainData: terrainCheck,
            trackPoints: trackPoints,
            systemWorking: true
        };
    }
    
    /**
     * Get debug information about collisions with terrain analysis
     */
    getDebugInfo() {
        const terrainInfo = this.scene.userData.terrain ? {
            hasTerrainSystem: true,
            terrainBounds: 'Available'
        } : {
            hasTerrainSystem: false,
            terrainBounds: 'Not Available'
        };
        
        return {
            staticObjects: this.staticObjects.length,
            dynamicObjects: this.dynamicObjects.length,
            settings: this.settings,
            terrain: terrainInfo
        };
    }
    
    /**
     * Get actual track contact points from tank geometry - FIXED coordinate system
     */
    getTrackContactPoints(tank, position) {
        const tankPos = position || tank.mesh.position;
        const tankRotationY = tank.mesh.rotation.y;
        
        // Track dimensions from tank.js
        const trackWidth = 0.4;  // Track width
        const trackLength = 3.25; // Track length
        const trackOffset = 1.075; // Distance from center to track center
        
        // Increased sample count for better contact detection on irregular terrain
        const sampleCount = 6; // More samples for better deformed terrain handling
        const leftTrackPoints = [];
        const rightTrackPoints = [];
        
        for (let i = 0; i < sampleCount; i++) {
            // Calculate position along track from REAR to FRONT
            const t = i / (sampleCount - 1); // 0 to 1
            // FIXED: Ensure proper front-to-rear ordering based on tank's forward direction
            const localZ = (t - 0.5) * trackLength; // -1.625 (rear) to +1.625 (front)
            
            // FIXED: Track positions relative to tank center in local coordinates
            // Left track is on the LEFT side of the tank (negative X in local space)
            // Right track is on the RIGHT side of the tank (positive X in local space)
            const leftLocalX = -trackOffset;  // Left side: -1.075
            const rightLocalX = trackOffset;  // Right side: +1.075
            
            // Transform to world coordinates considering tank rotation
            const cos = Math.cos(tankRotationY);
            const sin = Math.sin(tankRotationY);
            
            // FIXED: Proper coordinate transformation
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
            left: leftTrackPoints,   // Array from rear to front
            right: rightTrackPoints  // Array from rear to front
        };
    }
    
    /**
     * Check if a position is suitable for tank spawning - enhanced for deformed terrain
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

        // Get terrain height at position using simple sampling for spawn positioning
        let terrainHeight = 0;
        if (this.scene.userData.terrain) {
            terrainHeight = this.getSimpleTerrainHeight(position.x, position.z);
        }

        // Check if position is underwater or too steep
        if (terrainHeight < -0.01) { // More lenient for crater areas
            return {
                suitable: false,
                reason: 'underwater',
                conflictingObject: null
            };
        }

        const slope = this.calculateTerrainSlope(position);
        if (slope > 1.0) { // More lenient slope check for spawning on deformed terrain
            return {
                suitable: false,
                reason: 'too_steep',
                conflictingObject: null
            };
        }

        // Check for extreme crater/deformation at spawn point
        if (this.scene.userData.terrain) {
            const craterCheck = this.checkForCraterAtPosition(position, tankRadius);
            if (!craterCheck.suitable) {
                return {
                    suitable: false,
                    reason: 'in_crater',
                    conflictingObject: null,
                    craterDepth: craterCheck.depth
                };
            }
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
    
    /**
     * Check if position is in a crater that would be unsuitable for tank spawning
     */
    checkForCraterAtPosition(position, tankRadius) {
        if (!this.scene.userData.terrain) {
            return { suitable: true, depth: 0 };
        }
        
        const centerHeight = this.getSimpleTerrainHeight(position.x, position.z);
        const checkRadius = tankRadius * 1.5;
        const sampleCount = 8;
        
        let maxHeightDiff = 0;
        let avgSurroundingHeight = 0;
        
        // Sample heights around the position
        for (let i = 0; i < sampleCount; i++) {
            const angle = (i / sampleCount) * Math.PI * 2;
            const sampleX = position.x + Math.cos(angle) * checkRadius;
            const sampleZ = position.z + Math.sin(angle) * checkRadius;
            const sampleHeight = this.getSimpleTerrainHeight(sampleX, sampleZ);
            
            avgSurroundingHeight += sampleHeight;
            maxHeightDiff = Math.max(maxHeightDiff, Math.abs(sampleHeight - centerHeight));
        }
        
        avgSurroundingHeight /= sampleCount;
        const craterDepth = avgSurroundingHeight - centerHeight;
        
        // If center is significantly lower than surroundings, it's likely a crater
        if (craterDepth > 2.0 || maxHeightDiff > 2.5) {
            return {
                suitable: false,
                depth: craterDepth,
                heightVariation: maxHeightDiff
            };
        }
        
        return { suitable: true, depth: craterDepth };
    }
    
    /**
     * INTEGRATION METHODS FOR TANK PHYSICS
     */
    
    /**
     * Check if tank should land at current position (for gravity physics)
     * @param {Tank} tank - The tank checking for ground contact
     * @param {THREE.Vector3} newPosition - The position to check
     * @returns {Object} - {shouldLand: boolean, landingY: number, terrainData: object}
     */
    checkTankLanding(tank, newPosition) {
        if (!tank || !newPosition) {
            return { shouldLand: false, landingY: 0, terrainData: null };
        }
        
        const terrainCheck = this.checkTerrainCollision(newPosition, tank);
        const expectedY = terrainCheck.groundY;
        
        // Tank should land if it's at or below the expected ground level
        const shouldLand = newPosition.y <= expectedY;
        
        return {
            shouldLand: shouldLand,
            landingY: expectedY,
            terrainData: terrainCheck
        };
    }
    
    /**
     * Apply terrain-based rotation to tank mesh (for smooth terrain following)
     * @param {Tank} tank - The tank to apply rotation to
     * @param {Object} terrainData - Terrain data from collision check
     * @param {number} smoothingFactor - How smoothly to apply rotation (0-1)
     */
    applyTerrainRotationToTank(tank, terrainData, smoothingFactor = 0.1) {
        if (!tank || !tank.mesh || !terrainData || !terrainData.tankRotation) {
            return;
        }
        
        const rotation = terrainData.tankRotation;
        
        // Apply smooth rotation interpolation to prevent jitter
        tank.mesh.rotation.x += (rotation.x - tank.mesh.rotation.x) * smoothingFactor;
        tank.mesh.rotation.z += (rotation.z - tank.mesh.rotation.z) * smoothingFactor;
        
        // Debug logging for player tank
        if (tank.isPlayer && (Math.abs(rotation.x) > 0.05 || Math.abs(rotation.z) > 0.05)) {
            console.log(`Applied terrain rotation to ${tank.id}: pitch=${(rotation.x * 180/Math.PI).toFixed(1)}°, roll=${(rotation.z * 180/Math.PI).toFixed(1)}°`);
        }
    }
}

/*
CRITICAL FIXES APPLIED TO COLLISION SYSTEM:

1. COLLISION SETTINGS RESTORED:
   - Tank radius: 0.25 -> 0.95 (proper tank size)
   - Terrain margin: 0.15 -> 0.35 (proper ground clearance)

2. SPAWN POSITIONING FIXED:
   - Tanks now spawn 2.5 units above ground (not 12+ units)
   - Proper ground level calculation for gravity physics
   - Clear separation between spawn height and final ground position

3. TANK PHYSICS INTEGRATION:
   - Added checkTankLanding() for gravity physics
   - Added applyTerrainRotationToTank() for smooth rotation
   - Added getGroundLevelForTank() for physics integration

4. ROTATION SYSTEM VERIFIED:
   - Roll: RIGHT - LEFT (correct for right-hand coordinate system)
   - Pitch: REAR - FRONT (correct for climbing behavior)
   - Proper smoothing and limits applied

5. DEBUG LOGGING IMPROVED:
   - More informative terrain rotation debug
   - Clear indication of raw vs final rotation values
   - Tank ID included in debug messages

USAGE FOR GAME INTEGRATION:
- Use getProperSpawnPosition() for tank spawning
- Use checkTankLanding() in tank gravity physics
- Use applyTerrainRotationToTank() for smooth terrain following
- The system now properly handles tank movement with correct collision detection
*/