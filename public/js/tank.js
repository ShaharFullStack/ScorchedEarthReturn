import * as THREE from 'three';
import { Projectile } from './projectile.js';

const FUEL_PER_MOVE_ACTION = 0; // Cost for one 'tick' of movement
const FUEL_PER_ROTATE_ACTION = 0; // Cost for one 'tick' of rotation

export class Tank {
    constructor(id, isPlayer, scene, initialPosition, color, gameInstance) {
        this.id = id;
        this.isPlayer = isPlayer;
        this.scene = scene;
        this.game = gameInstance; // Reference to the game instance

        this.mesh = new THREE.Group();
        this.turretGroup = new THREE.Group();
        this.barrelGroup = new THREE.Group();
        this.barrel = null;
        this.nameLabel = null; // For player name display
        this.previousHealth = 0; // Track health changes

        this.maxHealth = 100;
        this.currentHealth = this.maxHealth;
        this.isDestroyed = false;

        this.maxFuel = 100;
        this.currentFuel = this.maxFuel;
        
        this.moveSpeed = 5; // units per second
        this.rotateSpeed = Math.PI;
        this.turretRotateSpeed = Math.PI / 9; 

        this.hasFiredThisTurn = false;
        this.collisionRadius = 1.1; // For collision detection
        
        // Gravity physics for tank spawning
        this.gravity = 9.81 * 1.5; // Moderate gravity for tanks (less than projectiles)
        this.velocity = new THREE.Vector3(0, 0, 0); // Current velocity vector
        this.isGrounded = false; // Whether tank is on ground
        this.groundY = -0.2; // Ground level cache
        this.fallDamping = 0.8; // Reduce velocity on ground impact for realistic landing
        
        // Firing properties
        this.minPower = 5;
        this.maxPower = 100;
        this.currentPower = 50; // Default power
        this.powerIncrement = 1;
        this.minProjectileSpeed = 15; // m/s at minPower
        this.maxProjectileSpeed = 100; // m/s at maxPower
          // Barrel elevation - Fixed ranges for proper aiming
        this.barrelElevation = Math.PI / 36; // Approx 5 degrees (slightly up)
        this.minBarrelElevation = -Math.PI / 12; // Approx -15 degrees (depression/down)
        this.maxBarrelElevation = Math.PI / 3;   // Approx 60 degrees (elevation/up)
        this.barrelElevateSpeed = Math.PI / 6; // Faster elevation adjustment
        
        this.createAdvancedTank(color);
        this.mesh.position.copy(initialPosition);
        
        // Set initial position using collision system if available
        this.setInitialPosition(initialPosition);
        
        // Create name label if this is a player tank
        if (this.isPlayer) {
            this.createNameLabel();
        }
        
        // Set initial previous health
        this.previousHealth = this.currentHealth;
        
        // Initial health bar update
        setTimeout(() => {
            if (this.healthBarSprite && this.game.camera) {
                this.updateHealthBar(this.game.camera);
            }
        }, 100);
    }    setInitialPosition(position) {
        // Use collision system to find proper ground height
        if (this.game.collisionSystem) {
            const terrainCheck = this.game.collisionSystem.checkTerrainCollision(position, this);            
            // Spawn tanks 12 meters above ground so they fall naturally into place
            this.mesh.position.set(position.x, terrainCheck.groundY + 12.0, position.z);
            this.groundY = terrainCheck.groundY + 0.25; // Cache ground level for physics
        } else {
            // Fallback to old method - also spawn 2 meters above ground
            this.mesh.position.copy(position);
            if (this.scene.userData.terrain) {
                const groundLevel = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z);                this.mesh.position.y = groundLevel + 2.25; // 2m above + 0.25 tank height
                this.groundY = groundLevel + 0.25; // Cache ground level for physics
            } else {
                this.mesh.position.y = position.y + 12.0; // 12 meters above given position
                this.groundY = position.y + 0.25; // Estimate ground level
            }
        }
        
        // Initialize physics state for falling
        this.isGrounded = false;
        this.velocity.set(0, 0, 0); // Start with no velocity
        
        console.log(`Tank ${this.id} spawned at height ${this.mesh.position.y.toFixed(2)}, will fall to ${this.groundY.toFixed(2)}`);
    }

    createAdvancedTank(color) {
        // Create main hull
        this.createHull(color);
        
        // Create track system
        this.createTracks();
        
        // Create turret
        this.createTurret(color);
        
        // Create barrel
        this.createBarrel();
        
        // Create additional details
        this.createDetails();
        
        // Add turret and barrel to main group
        this.mesh.add(this.turretGroup);
        this.turretGroup.add(this.barrelGroup);
        
        // Create health bar for all tanks
        this.createHealthBar();
    }
      
    createHull(color) {
        // Main hull body - smaller, more realistic proportions
        const hullGeometry = new THREE.BoxGeometry(1.75, 0.6, 3);
        const hullMaterial = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        hull.position.y = 0.3;
        hull.castShadow = true;
        hull.receiveShadow = true;
        this.mesh.add(hull);
        
        // Hull front slope
        const frontSlopeGeometry = new THREE.BoxGeometry(1.75, 0.4, 0.75);
        const frontSlope = new THREE.Mesh(frontSlopeGeometry, hullMaterial);
        frontSlope.position.set(0, 0.5, 1.625);
        frontSlope.rotation.x = -Math.PI / 6;
        frontSlope.castShadow = true;
        this.mesh.add(frontSlope);
        
        // Hull rear slope
        const rearSlopeGeometry = new THREE.BoxGeometry(1.75, 0.3, 0.5);
        const rearSlope = new THREE.Mesh(rearSlopeGeometry, hullMaterial);
        rearSlope.position.set(0, 0.4, -1.5);
        rearSlope.rotation.x = Math.PI / 8;
        rearSlope.castShadow = true;
        this.mesh.add(rearSlope);
        
        // Side armor plates
        for (let side of [-1, 1]) {
            const sideArmorGeometry = new THREE.BoxGeometry(0.15, 0.5, 2.75);
            const sideArmor = new THREE.Mesh(sideArmorGeometry, hullMaterial);
            sideArmor.position.set(side * 0.95, 0.3, 0);
            sideArmor.castShadow = true;
            this.mesh.add(sideArmor);
        }
    }
    
    createTracks() {
        // Track assemblies on both sides
        for (let side of [-1, 1]) {
            const trackGroup = new THREE.Group();
            
            // Track base
            const trackGeometry = new THREE.BoxGeometry(0.4, 0.3, 3.25);
            const trackMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                metalness: 0.9,
                roughness: 0.8
            });
            
            const track = new THREE.Mesh(trackGeometry, trackMaterial);
            track.position.set(side * 1.075, 0.15, 0);
            track.castShadow = true;
            trackGroup.add(track);
            
            // Road wheels (5 wheels per side - scaled down)
            for (let i = 0; i < 5; i++) {
                const wheelGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.15, 12);
                const wheelMaterial = new THREE.MeshStandardMaterial({
                    color: 0x333333,
                    metalness: 0.8,
                    roughness: 0.2
                });
                
                const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
                wheel.position.set(side * 1.075, 0.15, -1.2 + i * 0.6);
                wheel.rotation.z = Math.PI / 2;
                wheel.castShadow = true;
                trackGroup.add(wheel);
                
                // Wheel details
                const hubGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.175, 8);
                const hubMaterial = new THREE.MeshStandardMaterial({
                    color: 0x666666,
                    metalness: 0.9,
                    roughness: 0.1
                });
                
                const hub = new THREE.Mesh(hubGeometry, hubMaterial);
                hub.position.copy(wheel.position);
                hub.rotation.z = Math.PI / 2;
                trackGroup.add(hub);
            }
            
            // Drive sprocket (front)
            const sprocketGeometry = new THREE.CylinderGeometry(0.225, 0.225, 0.2, 8);
            const sprocketMaterial = new THREE.MeshStandardMaterial({
                color: 0x444444,
                metalness: 0.8,
                roughness: 0.3
            });
            
            const sprocket = new THREE.Mesh(sprocketGeometry, sprocketMaterial);
            sprocket.position.set(side * 1.075, 0.15, 1.6);
            sprocket.rotation.z = Math.PI / 2;
            sprocket.castShadow = true;
            trackGroup.add(sprocket);
            
            // Idler wheel (rear)
            const idler = new THREE.Mesh(sprocketGeometry, sprocketMaterial);
            idler.position.set(side * 1.075, 0.15, -1.6);
            idler.rotation.z = Math.PI / 2;
            idler.castShadow = true;
            trackGroup.add(idler);
            
            this.mesh.add(trackGroup);
        }
    }
    
    createTurret(color) {
        // Main turret body
        const turretGeometry = new THREE.BoxGeometry(1.25, 0.6, 1.25);
        const turretMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(color).offsetHSL(0, 0, -0.1),
            metalness: 0.8,
            roughness: 0.2
        });
        
        const turret = new THREE.Mesh(turretGeometry, turretMaterial);
        turret.position.set(0, 0.9, -0.15);
        turret.castShadow = true;
        this.turretGroup.add(turret);
        
        // Turret front armor
        const frontArmorGeometry = new THREE.BoxGeometry(1.25, 0.5, 0.4);
        const frontArmor = new THREE.Mesh(frontArmorGeometry, turretMaterial);
        frontArmor.position.set(0, 0.9, 0.4);
        frontArmor.rotation.x = -Math.PI / 12;
        frontArmor.castShadow = true;
        this.turretGroup.add(frontArmor);
        
        // Turret sides
        for (let side of [-1, 1]) {
            const sideArmorGeometry = new THREE.BoxGeometry(0.2, 0.5, 1.1);
            const sideArmor = new THREE.Mesh(sideArmorGeometry, turretMaterial);
            sideArmor.position.set(side * 0.725, 0.9, -0.1);
            sideArmor.castShadow = true;
            this.turretGroup.add(sideArmor);
        }
        
        // Commander's cupola
        const cupolaGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12);
        const cupola = new THREE.Mesh(cupolaGeometry, turretMaterial);
        cupola.position.set(-0.4, 1.25, -0.4);
        cupola.castShadow = true;
        this.turretGroup.add(cupola);
        
        // Position turret group
        this.turretGroup.position.set(0, 0, 0);
    }
    
    createBarrel() {
        // Main gun barrel
        const barrelGeometry = new THREE.CylinderGeometry(0.06, 0.075, 2.25, 16);
        const barrelMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.9,
            roughness: 0.1
        });
        
        this.barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
        this.barrel.position.set(0, 0.9, 1.25);
        this.barrel.rotation.x = Math.PI / 2;
        this.barrel.castShadow = true;
        this.barrelGroup.add(this.barrel);
        
        // Barrel muzzle brake
        const muzzleBrakeGeometry = new THREE.CylinderGeometry(0.09, 0.09, 0.3, 8);
        const muzzleBrake = new THREE.Mesh(muzzleBrakeGeometry, barrelMaterial);
        muzzleBrake.position.set(0, 0.9, 2.25);
        muzzleBrake.rotation.x = Math.PI / 2;
        muzzleBrake.castShadow = true;
        this.barrelGroup.add(muzzleBrake);
        
        // Mantlet (gun shield)
        const mantletGeometry = new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const mantletMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.3
        });
        
        const mantlet = new THREE.Mesh(mantletGeometry, mantletMaterial);
        mantlet.position.set(0, 0.9, 0.6);
        mantlet.castShadow = true;
        this.barrelGroup.add(mantlet);
        
        // Position barrel group
        this.barrelGroup.position.set(0, 0, 0);
        
        // Apply the initial barrel elevation that was set in constructor
        this.barrelGroup.rotation.x = -this.barrelElevation;
    }
    
    createDetails() {
        // Antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.01, 0.01, 1, 8);
        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0.6, 1.75, -0.75);
        antenna.rotation.z = Math.PI / 8;
        this.mesh.add(antenna);
        
        // External fuel tanks
        for (let i = 0; i < 2; i++) {
            const tankGeometry = new THREE.CylinderGeometry(0.125, 0.125, 0.75, 12);
            const tankMaterial = new THREE.MeshStandardMaterial({
                color: 0x3a3a3a,
                metalness: 0.6,
                roughness: 0.4
            });
            
            const fuelTank = new THREE.Mesh(tankGeometry, tankMaterial);
            fuelTank.position.set(0.9, 0.6, -1 + i * 0.4);
            fuelTank.rotation.z = Math.PI / 2;
            fuelTank.castShadow = true;
            this.mesh.add(fuelTank);
        }
        
        // Headlights
        for (let side of [-1, 1]) {
            const lightGeometry = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12);
            const lightMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffcc,
                emissive: 0x333300,
                metalness: 0.1,
                roughness: 0.1
            });
            
            const headlight = new THREE.Mesh(lightGeometry, lightMaterial);
            headlight.position.set(side * 0.6, 0.75, 1.9);
            headlight.rotation.x = Math.PI / 2;
            this.mesh.add(headlight);
        }
        
        // Tool attachments on hull
        const toolGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.75);
        const toolMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            metalness: 0.1,
            roughness: 0.8
        });
        
        const tool = new THREE.Mesh(toolGeometry, toolMaterial);
        tool.position.set(-0.9, 0.65, 0.5);
        tool.rotation.y = Math.PI / 4;
        this.mesh.add(tool);
        
        // Spare track links
        for (let i = 0; i < 3; i++) {
            const linkGeometry = new THREE.BoxGeometry(0.15, 0.05, 0.2);
            const linkMaterial = new THREE.MeshStandardMaterial({
                color: 0x1a1a1a,
                metalness: 0.9,
                roughness: 0.8
            });
            
            const link = new THREE.Mesh(linkGeometry, linkMaterial);
            link.position.set(0.8, 0.7, -0.75 + i * 0.25);
            this.mesh.add(link);
        }
    }
    
    createHealthBar() {
        // Create canvas for health bar
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Store canvas and context for updates
        this.healthBarCanvas = canvas;
        this.healthBarContext = context;
        
        // Create texture from canvas
        this.healthBarTexture = new THREE.CanvasTexture(canvas);
        this.healthBarTexture.needsUpdate = true;
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: this.healthBarTexture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false
        });
        
        // Create sprite
        this.healthBarSprite = new THREE.Sprite(spriteMaterial);
        this.healthBarSprite.scale.set(3, 0.75, 1);
        
        // Position above tank (below name label if player)
        const yOffset = this.isPlayer ? 2.8 : 3.2;
        this.healthBarSprite.position.set(0, yOffset, 0);
        
        // Add to tank mesh
        this.mesh.add(this.healthBarSprite);
        
        // Initial health bar render
        this.updateHealthBarVisual();
    }
    
    updateHealthBarVisual() {
        if (!this.healthBarContext || !this.healthBarTexture) {
            console.warn(`Tank ${this.id}: Health bar components missing`);
            return;
        }
        
        const context = this.healthBarContext;
        const canvas = this.healthBarCanvas;
        
        // Clear canvas
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Health percentage
        const healthPercent = this.currentHealth / this.maxHealth;
        
        // Background (black with border)
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Border
        context.strokeStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.lineWidth = 3;
        context.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
        
        // Health bar background (dark)
        const barWidth = canvas.width - 40;
        const barHeight = 20;
        const barX = 20;
        const barY = 22;
        
        context.fillStyle = 'rgba(60, 60, 60, 0.9)';
        context.fillRect(barX, barY, barWidth, barHeight);
        
        // Health bar fill
        const fillWidth = barWidth * healthPercent;
        
        // Color based on health percentage
        let healthColor;
        if (healthPercent > 0.6) {
            healthColor = this.isPlayer ? '#00ff41' : '#ff6b6b';
        } else if (healthPercent > 0.3) {
            healthColor = '#ffaa00';
        } else {
            healthColor = '#ff4444';
        }
        
        // Create gradient for health bar
        const gradient = context.createLinearGradient(barX, barY, barX, barY + barHeight);
        gradient.addColorStop(0, healthColor);
        gradient.addColorStop(0.5, healthColor + 'CC');
        gradient.addColorStop(1, healthColor);
        
        context.fillStyle = gradient;
        context.fillRect(barX, barY, fillWidth, barHeight);
        
        // Health text
        context.font = 'bold 14px "Orbitron", monospace';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
        
        // Add glow effect to text
        context.shadowColor = healthColor;
        context.shadowBlur = 5;
        context.fillText(`${this.currentHealth}/${this.maxHealth}`, canvas.width / 2, barY + barHeight / 2);
        context.shadowBlur = 0;
        
        // Tank identifier (small text above bar)
        context.font = 'bold 10px "Rajdhani", monospace';
        context.fillStyle = this.isPlayer ? '#00ff41' : '#ff4444';
        context.textAlign = 'center';
        
        let tankName;
        if (this.isPlayer) {
            tankName = this.game.ui.getPlayerName() || 'PLAYER';
        } else {
            const enemyIndex = this.id.replace('enemy_', '');
            tankName = `ENEMY ${parseInt(enemyIndex) + 1}`;
        }
        
        context.fillText(tankName, canvas.width / 2, 16);
        
        // Update texture
        this.healthBarTexture.needsUpdate = true;
    }
    
    updateHealthBar(camera) {
        // Force update the visual (used when taking damage)
        this.updateHealthBarVisual();
        this.previousHealth = this.currentHealth;
        
        // Update health in the UI
        if (this.game && this.game.ui) {
            this.game.ui.updateHealth(this.id, this.currentHealth, this.maxHealth);
        }
    }
    
    createNameLabel() {
        // Get player name from game UI
        const playerName = this.game.ui.getPlayerName() || 'COMMANDER';
        
        // Create canvas for text texture
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Style the text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Text styling
        context.fillStyle = '#00ff41';
        context.font = 'bold 48px "Orbitron", monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add glow effect
        context.shadowColor = '#00ff41';
        context.shadowBlur = 10;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // Draw the text
        context.fillText(playerName, canvas.width / 2, canvas.height / 2);
        
        // Add border
        context.strokeStyle = '#004400';
        context.lineWidth = 3;
        context.strokeText(playerName, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1,
            depthWrite: false
        });
        
        // Create sprite
        this.nameLabel = new THREE.Sprite(spriteMaterial);
        this.nameLabel.scale.set(4, 1, 1);
        this.nameLabel.position.set(0, 3.5, 0);
        
        // Add to tank mesh
        this.mesh.add(this.nameLabel);
    }
    
    updateNameLabel(camera) {
        if (this.nameLabel && camera) {
            // Make the label always face the camera
            this.nameLabel.lookAt(camera.position);
            
            // Adjust opacity based on distance to camera
            const distance = this.mesh.position.distanceTo(camera.position);
            const maxDistance = 50;
            const minDistance = 10;
            
            let opacity = 1.0;
            if (distance > maxDistance) {
                opacity = 0.3;
            } else if (distance > minDistance) {
                opacity = 1.0 - ((distance - minDistance) / (maxDistance - minDistance)) * 0.7;
            }
            
            this.nameLabel.material.opacity = opacity;
        }
    }

    elevateBarrel(angleChange) {
        if (this.isDestroyed) return;
        
        const oldElevation = this.barrelElevation;
        this.barrelElevation += angleChange;
        
        let hitLimit = false;
        let limitType = '';
        
        if (this.barrelElevation < this.minBarrelElevation) {
            this.barrelElevation = this.minBarrelElevation;
            hitLimit = true;
            limitType = 'MIN';
        } else if (this.barrelElevation > this.maxBarrelElevation) {
            this.barrelElevation = this.maxBarrelElevation;
            hitLimit = true;
            limitType = 'MAX';
        }
        
        // Apply elevation to the barrel group
        if (this.barrelGroup) {
            this.barrelGroup.rotation.x = -this.barrelElevation;
        }
        
        // Debug logging
        if (this.isPlayer) {
            const msg = `PLAYER barrel elevation: ${(oldElevation * 180 / Math.PI).toFixed(1)}° -> ${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°, angleChange: ${(angleChange * 180 / Math.PI).toFixed(3)}°`;
            if (hitLimit) {
                console.log(`${msg} [HIT ${limitType} LIMIT]`);
            } else {
                console.log(msg);
            }
        }
    }
    
    /**
     * UPDATED: Move method now uses CollisionSystem
     */
    move(direction, deltaTime) {
        if (this.isDestroyed || this.currentFuel <= 0) return;

        // Reduced fuel cost for better movement
        const fuelCost = FUEL_PER_MOVE_ACTION * deltaTime * 2;
        if (this.currentFuel < fuelCost) return;

        const moveDistance = this.moveSpeed * deltaTime;
        
        // IMPORTANT: Clone the direction to avoid modifying the original vector
        const moveVector = direction.clone().multiplyScalar(moveDistance);
        const newPosition = this.mesh.position.clone().add(moveVector);
        
        // Use collision system for movement validation
        if (this.game.collisionSystem) {
            const collisionResult = this.game.collisionSystem.checkTankMovement(this, newPosition, moveVector);
            
            if (!collisionResult.canMove) {
                // Log collision and don't move
                if (collisionResult.collisionInfo) {
                    const collision = collisionResult.collisionInfo;
                    console.log(`Tank ${this.id} movement blocked by ${collision.type}:`, collision);
                }
                return;
            }              // Apply the validated movement with track-based terrain following
            this.mesh.position.copy(collisionResult.adjustedPosition);
            
            // Update ground level if tank is grounded (for gravity physics)
            if (this.isGrounded && collisionResult.terrainData) {
                this.groundY = collisionResult.terrainData.groundY + 0.25;
            }
            
            // Apply track-based tank rotation for realistic terrain following
            if (collisionResult.terrainData && collisionResult.terrainData.tankRotation) {
                const rotation = collisionResult.terrainData.tankRotation;
                
                // Apply smooth rotation based on track contact
                const smoothingFactor = 0.1; // Smooth transition to prevent jitter
                
                // Interpolate to target rotation
                this.mesh.rotation.x += (rotation.x - this.mesh.rotation.x) * smoothingFactor;
                this.mesh.rotation.z += (rotation.z - this.mesh.rotation.z) * smoothingFactor;
                
                if (this.isPlayer) {
                    console.log(`Track-based rotation applied: pitch=${(rotation.x * 180/Math.PI).toFixed(1)}°, roll=${(rotation.z * 180/Math.PI).toFixed(1)}°`);
                }
            }
            
        } else {
            // Fallback to old boundary check if collision system not available
            if (newPosition.x < -70 || newPosition.x > 70 || newPosition.z < -70 || newPosition.z > 70) {
                return; // Hit boundary
            }
              // Apply movement without collision checking
            this.mesh.position.add(moveVector);
            
            // Update Y position based on terrain height (fallback)
            if (this.scene.userData.terrain) {
                const newGroundLevel = this.scene.userData.terrain.getHeightAt(this.mesh.position.x, this.mesh.position.z) + 0.25;
                this.mesh.position.y = newGroundLevel;
                // Update cached ground level for gravity physics
                if (this.isGrounded) {
                this.groundY = newGroundLevel;
                }
            }
        }
        
        // Reduce fuel consumption
        this.currentFuel -= fuelCost;
        if (this.currentFuel < 0) this.currentFuel = 0;
        if (this.isPlayer) this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        
        // Debug logging for movement
        if (this.isPlayer) {
            console.log(`Player moved: ${moveVector.length().toFixed(2)} units, fuel: ${this.currentFuel.toFixed(1)}`);
        }
    }

    rotateBody(angle) {
        if (this.isDestroyed || this.currentFuel <= 0) return;
        const fuelCost = FUEL_PER_ROTATE_ACTION * Math.abs(angle) * 2;
        if (this.currentFuel < fuelCost && this.isPlayer) return;

        this.mesh.rotation.y += angle;
        
        if (this.isPlayer) {
            this.currentFuel -= fuelCost;
            if (this.currentFuel < 0) this.currentFuel = 0;
            this.game.ui.updateFuel(this.currentFuel, this.maxFuel);
        }
    }

    rotateTurret(angle) {
        if (this.isDestroyed) return;
        this.turretGroup.rotation.y += angle;
    }
    
    aimTowards(targetPosition) {
        if (this.isDestroyed) return;
        
        // Get tank position
        const tankPos = this.mesh.position.clone();
        
        // Calculate direction vector from tank to target
        const direction = targetPosition.clone().sub(tankPos);
        direction.y = 0; // Remove vertical component for horizontal aiming
        direction.normalize();
        
        // Calculate angle to target
        const angleToTarget = Math.atan2(direction.x, direction.z);
        
        // Set turret rotation directly to face target
        this.turretGroup.rotation.y = angleToTarget;
    }

    shoot() {
        if (this.isDestroyed || this.hasFiredThisTurn) return;

        // Get the world position of the barrel tip
        const barrelTip = new THREE.Vector3(0, 1, 1.125);
        this.barrel.localToWorld(barrelTip);
        this.barrel.updateMatrixWorld(true);
        
        // Get barrel direction
        const localForward = new THREE.Vector3(0, 1, 0);
        const barrelDirection = localForward.clone();
        barrelDirection.transformDirection(this.barrel.matrixWorld);
        barrelDirection.normalize();
        
        // Calculate initial speed based on current power
        const powerRatio = (this.currentPower - this.minPower) / (this.maxPower - this.minPower);
        const initialSpeed = this.minProjectileSpeed + powerRatio * (this.maxProjectileSpeed - this.minProjectileSpeed);
        const initialVelocity = barrelDirection.clone().multiplyScalar(initialSpeed);
        
        // Log shooting details
        const tankPosition = this.mesh.position.clone();
        const tankName = this.isPlayer ? 'PLAYER' : this.id;
        
        // Calculate theoretical range for this shot
        const g = 9.81 * 2;
        const v0 = initialSpeed;
        const angle = this.barrelElevation;
        const theoreticalRange = (v0 * v0 * Math.sin(2 * angle)) / g;
        const maxHeight = (v0 * v0 * Math.sin(angle) * Math.sin(angle)) / (2 * g);
        const timeOfFlight = (2 * v0 * Math.sin(angle)) / g;
        
        console.log(`${tankName} SHOOTING:`, {
            tankPosition: `(${tankPosition.x.toFixed(2)}, ${tankPosition.y.toFixed(2)}, ${tankPosition.z.toFixed(2)})`,
            barrelTip: `(${barrelTip.x.toFixed(2)}, ${barrelTip.y.toFixed(2)}, ${barrelTip.z.toFixed(2)})`,
            power: `${this.currentPower}%`,
            elevation: `${(this.barrelElevation * 180 / Math.PI).toFixed(1)}°`,
            turretRotation: `${(this.turretGroup.rotation.y * 180 / Math.PI).toFixed(1)}°`,
            direction: `(${barrelDirection.x.toFixed(3)}, ${barrelDirection.y.toFixed(3)}, ${barrelDirection.z.toFixed(3)})`,
            velocity: `(${initialVelocity.x.toFixed(1)}, ${initialVelocity.y.toFixed(1)}, ${initialVelocity.z.toFixed(1)})`,
            initialSpeed: `${initialSpeed.toFixed(1)} m/s`,
            theoreticalRange: `${theoreticalRange.toFixed(1)} units`,
            maxHeight: `${maxHeight.toFixed(1)} units`,
            timeOfFlight: `${timeOfFlight.toFixed(2)} seconds`
        });
        
        const projectile = new Projectile(
            barrelTip,
            initialVelocity,
            this.isPlayer,
            this.scene
        );
        
        // Store reference to shooting tank for impact logging
        projectile.shootingTank = this;
        this.game.addProjectile(projectile);
        this.hasFiredThisTurn = false;
        
        // Play shooting sound effect
        if (this.game.audioManager) {
            this.game.audioManager.playSound('shoot');
        }        if (this.isPlayer) {
            this.game.ui.updateActionIndicator("Aim / Move / Space to End Turn");
              // Check if we're in barrel scope mode and auto-exit if needed
            // Get the reference to MainApp from the window object
            console.log('Tank shoot: Checking camera mode to auto-exit barrel scope if needed');
            console.log('mainApp exists:', !!window.mainApp);
            console.log('mainAppInstance exists:', !!window.mainAppInstance);
            
            if (window.mainApp) {
                console.log('mainApp camera mode:', window.mainApp.currentCameraMode);
            }
            
            if (window.mainAppInstance) {
                console.log('mainAppInstance camera mode:', window.mainAppInstance.currentCameraMode);
            }
            
            if ((window.mainApp && window.mainApp.currentCameraMode === 'barrel-scope') || 
                (window.mainAppInstance && window.mainAppInstance.currentCameraMode === 'barrel-scope')) {
                console.log('Barrel scope detected! Will exit after short delay');
                // Add a small delay to exit scope mode after shot is fired
                setTimeout(() => {
                    console.log('Auto-exiting barrel scope mode after shooting');
                    // Try both possible references to ensure one works
                    if (window.mainApp && typeof window.mainApp.exitBarrelScope === 'function') {
                        console.log('Using window.mainApp reference to exit barrel scope');
                        window.mainApp.exitBarrelScope();
                    } else if (window.mainAppInstance && typeof window.mainAppInstance.exitBarrelScope === 'function') {
                        console.log('Using window.mainAppInstance reference to exit barrel scope');
                        window.mainAppInstance.exitBarrelScope();                    } else if (this.game && typeof this.game.exitBarrelScope === 'function') {
                        console.log('Using game.exitBarrelScope reference as fallback');
                        this.game.exitBarrelScope();
                    } else if (typeof window.exitBarrelScope === 'function') {
                        console.log('Using static global exitBarrelScope function');
                        window.exitBarrelScope();
                    } else {
                        console.error('Failed to find any instance to exit barrel scope');
                        // Ultimate fallback - try to manually restore third-person view
                        try {
                            const scopeOverlay = document.getElementById('scope-overlay');
                            if (scopeOverlay) scopeOverlay.style.display = 'none';
                            console.log('Manually hiding scope overlay as last resort');
                        } catch (e) {
                            console.error('Even manual scope overlay hiding failed:', e);
                        }
                    }
                }, 300); // Short delay to see the shot firing before switching views
            } else {
                console.log('Not in barrel scope mode, or scope references not found - no need to exit');
            }
        }
    }
    
    takeDamage(amount) {
        if (this.isDestroyed) return;
        
        const oldHealth = this.currentHealth;
        this.currentHealth -= amount;
        
        console.log(`Tank ${this.id}: Taking ${amount} damage. Health: ${oldHealth} -> ${this.currentHealth}`);
        
        // Play tank hit sound effect
          if (this.currentHealth <= 0) {
            this.currentHealth = 0;
            this.isDestroyed = true;
            
            // Track tank destruction for statistics (only count enemy tanks destroyed by player)
            if (this.game && this.game.gameStats && !this.isPlayer) {
                this.game.gameStats.tanksDestroyed++;
            }
            
            // Play explosion sound for destroyed tank
            if (this.game.audioManager) {
                this.game.audioManager.playSound('explosion');
            }
            
            this.destroy();
            
            // Check if this destruction triggers a win/loss condition
            if (this.game && this.game.checkWinCondition) {
                // Small delay to ensure explosion effects are visible
                setTimeout(() => {
                    this.game.checkWinCondition();
                }, 1000);
            }
        }
        
        // Update health bar immediately when taking damage
        const camera = this.game && this.game.camera ? this.game.camera : null;
        this.updateHealthBar(camera);
        
        // Create damage flash effect on health bar
        if (this.healthBarSprite) {
            const originalScale = this.healthBarSprite.scale.clone();
            
            // Flash animation
            const flashDuration = 300;
            const startTime = Date.now();
            
            const animateFlash = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / flashDuration;
                
                if (progress >= 1) {
                    this.healthBarSprite.scale.copy(originalScale);
                    return;
                }
                
                // Pulse effect
                const pulse = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
                this.healthBarSprite.scale.copy(originalScale).multiplyScalar(pulse);
                
                requestAnimationFrame(animateFlash);
            };
            
            animateFlash();
        }
    }

    destroy() {
        // Hide name label and health bar if they exist
        if (this.nameLabel) {
            this.nameLabel.visible = false;
        }
        if (this.healthBarSprite) {
            this.healthBarSprite.visible = false;
        }
        
        // Simple visual effect: sink into ground and fade
        let sinkSpeed = 0.5;
        let opacitySpeed = 1.0;
        const interval = setInterval(() => {
            this.mesh.position.y -= sinkSpeed * 0.05;
            this.mesh.traverse(child => {
                if (child.isMesh && child.material) {
                    if (child.material.opacity <= 0) {
                        child.material.opacity = 0;
                    } else {
                        child.material.opacity -= opacitySpeed * 0.05;
                        child.material.transparent = true;
                    }
                }
            });
            if (this.mesh.position.y < -2 || (this.mesh.children[0].material && this.mesh.children[0].material.opacity <= 0)) {
                clearInterval(interval);
                this.scene.remove(this.mesh);
            }
        }, 50);
        console.log(`${this.id} destroyed!`);
    }
    
    resetTurnStats() {
        this.currentFuel = this.maxFuel;
        this.hasFiredThisTurn = false;
        
        if (this.isPlayer) {
            this.game.ui.updateActionIndicator("Move/Aim/Fire");
            this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
        }
    }
    
    adjustPower(amount) {
        if (this.isDestroyed || !this.isPlayer) return;
        this.currentPower += amount;
        if (this.currentPower < this.minPower) this.currentPower = this.minPower;
        if (this.currentPower > this.maxPower) this.currentPower = this.maxPower;
        this.game.ui.updatePowerIndicator(this.currentPower, this.minPower, this.maxPower);
    }
    
    /**
     * Update tank gravity physics for spawning fall effect
     */
    updateGravityPhysics(deltaTime) {
        if (this.isDestroyed || this.isGrounded) return;
        
        // Apply gravity to velocity
        this.velocity.y -= this.gravity * deltaTime;
        
        // Calculate new position
        const newPosition = this.mesh.position.clone();
        newPosition.add(this.velocity.clone().multiplyScalar(deltaTime));
        
        // Check ground collision using collision system or fallback
        let groundLevel = 0.02;
        if (this.game.collisionSystem) {
            const terrainCheck = this.game.collisionSystem.checkTerrainCollision(newPosition, this);
            groundLevel = terrainCheck.groundY + 0.25; // Tank height offset
        } else if (this.scene.userData.terrain) {
            groundLevel = this.scene.userData.terrain.getHeightAt(newPosition.x, newPosition.z) + 0.25;
        }
        
        // Check if tank has hit the ground
        if (newPosition.y <= groundLevel) {
            // Tank has landed
            this.mesh.position.x = newPosition.x;
            this.mesh.position.z = newPosition.z;
            this.mesh.position.y = groundLevel;
            
            // Apply landing damping and mark as grounded
            this.velocity.multiplyScalar(this.fallDamping);
            this.velocity.y = 0;
            this.isGrounded = true;
            this.groundY = groundLevel;
              // Play landing sound effect if available
            if (this.game.audioManager) {
                this.game.audioManager.playSound('groundHit', 0.3);
            }
              // Create small dust effect on landing
            if (this.game.collisionSystem) {
                this.game.collisionSystem.createDustCloud(this.mesh.position);
            }
            
            console.log(`Tank ${this.id} landed at ground level: ${groundLevel.toFixed(2)}`);
        } else {
            // Tank is still falling, update position
            this.mesh.position.copy(newPosition);
        }
    }
    
    heal(amount) {
        if (this.isDestroyed) return false;
        
        const oldHealth = this.currentHealth;
        this.currentHealth += amount;
        
        // Cap health at maximum
        if (this.currentHealth > this.maxHealth) {
            this.currentHealth = this.maxHealth;
        }
        
        const actualHealing = this.currentHealth - oldHealth;
        
        console.log(`Tank ${this.id}: Healed ${actualHealing} HP. Health: ${oldHealth} -> ${this.currentHealth}`);
        
        // Play healing sound effect if available
        if (this.game.audioManager) {
            this.game.audioManager.playSound('heal', 0.5);
        }
        
        // Update health bar immediately when healing
        const camera = this.game && this.game.camera ? this.game.camera : null;
        this.updateHealthBar(camera);
        
        // Create healing flash effect on health bar (green glow)
        if (this.healthBarSprite) {
            const originalScale = this.healthBarSprite.scale.clone();
            
            // Green healing flash animation
            const flashDuration = 500;
            const startTime = Date.now();
            
            const animateHealFlash = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / flashDuration;
                
                if (progress >= 1) {
                    this.healthBarSprite.scale.copy(originalScale);
                    return;
                }
                
                // Gentle pulse effect for healing (slower and gentler than damage)
                const pulse = 1 + Math.sin(progress * Math.PI * 2) * 0.15;
                this.healthBarSprite.scale.copy(originalScale).multiplyScalar(pulse);
                
                requestAnimationFrame(animateHealFlash);
            };
            
            animateHealFlash();
        }
        
        return actualHealing > 0;
    }
    
    update(deltaTime, camera) {
        // Update gravity physics first (for spawning fall effect)
        this.updateGravityPhysics(deltaTime);
        
        // Update name label to face camera
        if (this.isPlayer && this.nameLabel && camera) {
            this.updateNameLabel(camera);
        }
        
        // Update health bar
        if (this.healthBarSprite && camera) {
            // Always make it face the camera
            this.healthBarSprite.lookAt(camera.position);
            
            // Adjust opacity based on distance to camera
            const distance = this.mesh.position.distanceTo(camera.position);
            const maxDistance = 60;
            const minDistance = 5;
            
            let opacity = 1.0;
            if (distance > maxDistance) {
                opacity = 0.2;
            } else if (distance > minDistance) {
                opacity = 1.0 - ((distance - minDistance) / (maxDistance - minDistance)) * 0.8;
            }
            
            this.healthBarSprite.material.opacity = opacity;
            
            // Only update the visual if health has changed
            if (this.currentHealth !== this.previousHealth) {
                console.log(`Tank ${this.id}: Health changed from ${this.previousHealth} to ${this.currentHealth}`);
                this.updateHealthBarVisual();
                this.previousHealth = this.currentHealth;
            }
        }
    }
}