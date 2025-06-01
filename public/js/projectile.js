import * as THREE from 'three';

// Enhanced physics constants
const GRAVITY = 9.81 * 2; // Slightly exaggerated gravity for game feel
const AIR_RESISTANCE = 0.98; // Air resistance coefficient (0.98 = 2% resistance per second)
const WIND_STRENGTH = 0.5; // Base wind strength
const TERMINAL_VELOCITY = 60; // Maximum falling speed

export class Projectile {
    constructor(startPosition, initialVelocity, firedByPlayer, scene, shootingTank = null) {
        this.scene = scene;
        this.firedByPlayer = firedByPlayer;
        this.shootingTank = shootingTank;
        
        // Enhanced visual representation
        const geo = new THREE.SphereGeometry(0.25, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ 
            color: firedByPlayer ? 0x00ffff : 0xff8800,
            transparent: true,
            opacity: 0.9
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(startPosition);
        
        // Enhanced physics properties
        this.velocity = initialVelocity.clone();
        this.originalVelocity = initialVelocity.clone(); // Store for calculations
        this.mass = 5.0; // Projectile mass (kg)
        this.dragCoefficient = 0.47; // Sphere drag coefficient
        this.crossSectionalArea = Math.PI * (0.25 * 0.25); // Projectile cross-section
        
        // Environmental effects
        this.windVector = this.generateWindVector();
        
        this.lifespan = 8; // Increased for longer range shots
        this.age = 0;
        this.shouldBeRemoved = false;
        this.damage = 35;
        this.collisionRadius = 0.35;        
        // Enhanced trajectory tracking
        this.startPosition = startPosition.clone();
        this.startHeight = startPosition.y;
        this.maxHeight = startPosition.y;
        this.maxHeightReached = false;
        this.timeToMaxHeight = 0;
        this.trajectoryPoints = []; // For trajectory visualization
        this.impactVelocity = null; // Store velocity at impact
        
        // Performance tracking
        this.totalDistance = 0;
        this.horizontalDistance = 0;
        
        // Debug logging for projectile creation
        console.log(`ENHANCED PROJECTILE CREATED:`, {
            startPos: `(${startPosition.x.toFixed(2)}, ${startPosition.y.toFixed(2)}, ${startPosition.z.toFixed(2)})`,
            velocity: `(${initialVelocity.x.toFixed(1)}, ${initialVelocity.y.toFixed(1)}, ${initialVelocity.z.toFixed(1)})`,
            speed: `${initialVelocity.length().toFixed(1)} m/s`,
            mass: `${this.mass} kg`,
            windVector: `(${this.windVector.x.toFixed(2)}, ${this.windVector.z.toFixed(2)})`,
            firedByPlayer: firedByPlayer
        });
    }
    
    generateWindVector() {
        // Generate realistic wind pattern
        const windDirection = Math.random() * Math.PI * 2;
        const windMagnitude = WIND_STRENGTH * (0.5 + Math.random() * 0.5);
        
        return new THREE.Vector3(
            Math.cos(windDirection) * windMagnitude,
            0,
            Math.sin(windDirection) * windMagnitude
        );
    }    update(deltaTime) {
        if (this.shouldBeRemoved) return;
        
        // Store previous position for trajectory tracking
        const previousPosition = this.mesh.position.clone();
        const previousY = this.mesh.position.y;
        
        // Enhanced physics simulation
        this.updatePhysics(deltaTime);
        
        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
        this.age += deltaTime;
        
        // Track trajectory for visualization
        if (this.trajectoryPoints.length === 0 || 
            previousPosition.distanceTo(this.mesh.position) > 1.0) {
            this.trajectoryPoints.push(this.mesh.position.clone());
        }
        
        // Calculate distances
        this.totalDistance = this.startPosition.distanceTo(this.mesh.position);
        this.horizontalDistance = Math.sqrt(
            Math.pow(this.mesh.position.x - this.startPosition.x, 2) +
            Math.pow(this.mesh.position.z - this.startPosition.z, 2)
        );
        
        // Track maximum height reached
        if (this.mesh.position.y > this.maxHeight) {
            this.maxHeight = this.mesh.position.y;
            this.timeToMaxHeight = this.age;
        }
        
        // Detect when projectile starts falling (reached max height)
        if (!this.maxHeightReached && this.velocity.y <= 0 && this.mesh.position.y <= previousY) {
            this.maxHeightReached = true;
            this.impactVelocity = this.velocity.clone();
            
            const heightGain = this.maxHeight - this.startHeight;
            const shooterType = this.firedByPlayer ? 'PLAYER' : 'AI';
            console.log(`${shooterType} PROJECTILE MAX HEIGHT REACHED:`, {
                startHeight: `${this.startHeight.toFixed(2)} m`,
                maxHeight: `${this.maxHeight.toFixed(2)} m`, 
                heightGain: `${heightGain.toFixed(2)} m`,
                timeToMaxHeight: `${this.timeToMaxHeight.toFixed(2)} s`,
                currentVelocityY: `${this.velocity.y.toFixed(2)} m/s`,
                horizontalDistance: `${this.horizontalDistance.toFixed(1)} m`,
                trajectory: `(${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`
            });
        }
        
        // Enhanced boundary checking
        if (this.age > this.lifespan) {
            this.shouldBeRemoved = true;
            this.logFlightStatistics('TIMEOUT');
        }
        
        // Remove if it goes too far or too low
        if (Math.abs(this.mesh.position.x) > 100 || Math.abs(this.mesh.position.z) > 100 || this.mesh.position.y < -10) {
            this.shouldBeRemoved = true;
            this.logFlightStatistics('OUT_OF_BOUNDS');
        }
    }
    
    updatePhysics(deltaTime) {
        // Apply gravity
        this.velocity.y -= GRAVITY * deltaTime;
        
        // Apply air resistance
        const speed = this.velocity.length();
        if (speed > 0) {
            // Calculate air resistance force
            const airDensity = 1.225; // kg/m³ at sea level
            const dragForce = 0.5 * airDensity * this.dragCoefficient * this.crossSectionalArea * speed * speed;
            const dragAcceleration = dragForce / this.mass;
            
            // Apply drag in opposite direction of velocity
            const dragVector = this.velocity.clone().normalize().multiplyScalar(-dragAcceleration * deltaTime);
            this.velocity.add(dragVector);
        }
        
        // Apply wind effects (more pronounced at higher altitudes)
        const altitudeFactor = Math.max(0.1, Math.min(1.0, this.mesh.position.y / 20));
        const windEffect = this.windVector.clone().multiplyScalar(deltaTime * altitudeFactor);
        this.velocity.add(windEffect);
        
        // Apply terminal velocity limit
        if (this.velocity.y < -TERMINAL_VELOCITY) {
            this.velocity.y = -TERMINAL_VELOCITY;
        }
    }
    
    logFlightStatistics(reason) {
        if (this.maxHeightReached) {
            const totalFlightTime = this.age;
            const finalSpeed = this.velocity.length();
            const shooterType = this.firedByPlayer ? 'PLAYER' : 'AI';
            
            console.log(`${shooterType} PROJECTILE FLIGHT ENDED (${reason}):`, {
                totalFlightTime: `${totalFlightTime.toFixed(2)} s`,
                horizontalDistance: `${this.horizontalDistance.toFixed(1)} m`,
                totalDistance: `${this.totalDistance.toFixed(1)} m`,
                finalPosition: `(${this.mesh.position.x.toFixed(1)}, ${this.mesh.position.y.toFixed(1)}, ${this.mesh.position.z.toFixed(1)})`,
                maxHeightAchieved: `${this.maxHeight.toFixed(2)} m`,
                finalSpeed: `${finalSpeed.toFixed(1)} m/s`,
                impactAngle: this.calculateImpactAngle(),
                trajectoryPoints: this.trajectoryPoints.length
            });
        }
    }
    
    calculateImpactAngle() {
        if (!this.velocity) return 0;
        
        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        const verticalSpeed = Math.abs(this.velocity.y);
        
        return Math.atan2(verticalSpeed, horizontalSpeed) * 180 / Math.PI;
    }
    
    // Get predicted trajectory points for visualization
    getPredictedTrajectory(steps = 50) {
        const points = [];
        const testVelocity = this.originalVelocity.clone();
        const testPosition = this.startPosition.clone();
        const dt = 0.1;
        
        for (let i = 0; i < steps; i++) {
            points.push(testPosition.clone());
            
            // Apply simplified physics for prediction
            testVelocity.y -= GRAVITY * dt;
            testVelocity.multiplyScalar(AIR_RESISTANCE);
            testPosition.add(testVelocity.clone().multiplyScalar(dt));
            
            // Stop prediction if projectile hits ground level
            if (testPosition.y <= 0) break;
        }
        
        return points;
    }
}