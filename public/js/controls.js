import * as THREE from 'three';

/**
 * PlayerController - Handles player movement and physics
 */
class PlayerController {
  constructor(player, options = {}) {
    this.player = player;

    // Configuration
    this.moveSpeed = options.moveSpeed || 10;
    this.jumpForce = options.jumpForce || 15;
    this.gravity = options.gravity || 30;
    this.groundLevel = options.groundLevel || 1; // Assuming base ground is at y=0, player bottom at y=0.4

    // State
    this.velocity = new THREE.Vector3();
    this.isOnGround = true;
    this.canJump = true;
    this.keys = {};
    this.cameraMode = 'third-person'; // Default camera mode

    // Setup input handlers
    this.setupInput();
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  /**
   * Updates the player's state, velocity, and position.
   * @param {number} deltaTime Time elapsed since the last frame.
   * @param {number} cameraRotation The current horizontal rotation (yaw) of the active camera.
   */
  update(deltaTime, cameraRotation) {
    // Apply gravity
    // Check if the player's base (center y - half height approx) is above ground
    // Note: Player model base is roughly at world y = player.position.y
    if (this.player.position.y > this.groundLevel) {
      this.velocity.y -= this.gravity * deltaTime;
      this.isOnGround = false;
    } else {
      // Clamp player to ground level and reset vertical velocity
      this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity, allow upward (jump)
      this.player.position.y = this.groundLevel;
      this.isOnGround = true;
      this.canJump = true; // Can jump again once grounded
    }

    // Handle jumping
    if (this.keys['Space'] && this.isOnGround && this.canJump) {
      this.velocity.y = this.jumpForce;
      this.isOnGround = false;
      this.canJump = false; // Prevent double jumps until grounded again
    }

    // --- Horizontal Movement ---

    // Reset horizontal velocity each frame
    // We calculate desired movement directly based on input and camera
    let moveX = 0;
    let moveZ = 0;

    // Calculate movement direction vectors relative to the camera's horizontal rotation
    // Forward direction (local -Z) rotated by camera yaw
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);
    // Right direction (local +X) rotated by camera yaw
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraRotation);

    // Apply movement based on keys pressed
    const currentMoveSpeed = this.moveSpeed; // Use the configured move speed

    if (this.keys['KeyW']) { // Forward
      moveX += forward.x;
      moveZ += forward.z;
    }
    if (this.keys['KeyS']) { // Backward
      moveX -= forward.x;
      moveZ -= forward.z;
    }
    if (this.keys['KeyA']) { // Left
      moveX -= right.x;
      moveZ -= right.z;
    }
    if (this.keys['KeyD']) { // Right
      moveX += right.x;
      moveZ += right.z;
    }

    // Normalize the movement vector if moving diagonally
    const moveDirection = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDirection.lengthSq() > 0) { // Check if there's any horizontal movement input
        moveDirection.normalize();
    }

    // Apply speed and deltaTime to get the displacement for this frame
    this.velocity.x = moveDirection.x * currentMoveSpeed;
    this.velocity.z = moveDirection.z * currentMoveSpeed;


    // --- Update Player Position ---
    // Apply calculated velocity scaled by deltaTime
    this.player.position.x += this.velocity.x * deltaTime;
    this.player.position.y += this.velocity.y * deltaTime; // Vertical velocity already includes gravity effect
    this.player.position.z += this.velocity.z * deltaTime;


    // --- Update Player Rotation ---
    // Rotate player model to face movement direction (only in third-person mode)
    // In first-person mode, the FirstPersonCameraController handles player rotation.
    if (this.cameraMode === 'third-person' && (this.velocity.x !== 0 || this.velocity.z !== 0)) {
      // Calculate the angle of the horizontal velocity vector (world space)
      const angle = Math.atan2(this.velocity.x, this.velocity.z);

      // Set the player's rotation. Add Math.PI because the player's
      // "front" is along its local negative Z axis,
      // but atan2 gives the angle relative to the positive Z axis.
      // Adding PI rotates the model 180 degrees to align the negative Z axis
      // with the calculated movement direction.
      this.player.rotation.y = angle + Math.PI;
    }
     // If not moving in third-person, the player keeps their last rotation.
     // In first-person mode, the player's rotation is handled entirely by
     // the FirstPersonCameraController synchronizing with the mouse look.
  }
}

/**
 * ThirdPersonCameraController - Handles third-person camera positioning and rotation
 */
class ThirdPersonCameraController {
  constructor(camera, target, domElement, options = {}) {
    this.camera = camera;
    this.target = target;
    this.domElement = domElement;

    // Configuration
    this.distance = options.distance || 7;
    this.height = options.height || 3;
    this.rotationSpeed = options.rotationSpeed || 0.003;

    // State
    this.rotation = 0;
    this.isDragging = false;
    this.mousePosition = { x: 0, y: 0 };
    this.enabled = true;

    // Setup mouse controls
    this.setupMouseControls();
  }

  setupMouseControls() {
    this.domElement.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.isDragging = true;
      this.mousePosition = { x: e.clientX, y: e.clientY };
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.isDragging) return;

      const deltaX = e.clientX - this.mousePosition.x;
      this.rotation -= deltaX * this.rotationSpeed;

      this.mousePosition = { x: e.clientX, y: e.clientY };
    });
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.isDragging = false;
  }

  update() {
    if (!this.enabled) return 0;

    // Calculate camera position
    const offset = new THREE.Vector3(
      Math.sin(this.rotation) * this.distance,
      this.height,
      Math.cos(this.rotation) * this.distance
    );

    // Position camera
    this.camera.position.copy(this.target.position).add(offset);

    // Look at target
    this.camera.lookAt(
      this.target.position.x,
      this.target.position.y + 1,
      this.target.position.z
    );

    return this.rotation; // Return rotation for player movement
  }
}

/**
 * FirstPersonCameraController - Handles first-person camera controls
 */
class FirstPersonCameraController {
  constructor(camera, player, domElement, options = {}) {
    this.camera = camera;
    this.player = player;
    this.domElement = domElement;

    // Configuration
    this.eyeHeight = options.eyeHeight || 1.6;
    this.mouseSensitivity = options.mouseSensitivity || 0.002;

    // State
    this.enabled = false;
    this.rotationY = 0;
    this.rotationX = 0;

    // Setup mouse controls
    this.setupMouseControls();
  }

  setupMouseControls() {
    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;

      this.rotationY -= e.movementX * this.mouseSensitivity;
      this.rotationX -= e.movementY * this.mouseSensitivity;

      // Limit vertical rotation
      this.rotationX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.rotationX));
    });
  }

  enable() {
    this.enabled = true;

    // Note: rotationY will be set by setCameraMode before this is called
    this.rotationX = 0;

    // Hide player when in first-person mode
    this.hidePlayer();
  }

  disable() {
    this.enabled = false;

    // Show player when exiting first-person mode
    this.showPlayer();

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  hidePlayer() {
    // Store current player model visibility state
    this.originalVisibility = [];
    this.player.traverse(child => {
      if (child.isMesh) {
        this.originalVisibility.push({
          object: child,
          visible: child.visible
        });
        child.visible = false;
      }
    });
  }

  showPlayer() {
    // Restore player model visibility
    if (this.originalVisibility) {
      this.originalVisibility.forEach(item => {
        item.object.visible = item.visible;
      });
      this.originalVisibility = null;
    }
  }

  update() {
    if (!this.enabled) return 0;

    // Set player rotation to match camera's horizontal rotation
    this.player.rotation.y = this.rotationY;

    // Position camera at player eye height
    this.camera.position.x = this.player.position.x;
    this.camera.position.y = this.player.position.y + this.eyeHeight;
    this.camera.position.z = this.player.position.z;

    // Set camera rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = this.rotationX;
    this.camera.rotation.y = this.rotationY;

    return this.rotationY;
  }
}

/**
 * BarrelScopeCameraController - Provides a first-person view from the tank's barrel tip
 * for precise aiming with scope overlay
 */
class BarrelScopeCameraController {
  constructor(camera, tank, domElement, options = {}) {
    this.camera = camera;
    this.tank = tank;
    this.domElement = domElement;    // Configuration
    this.mouseSensitivity = options.mouseSensitivity || 0.001; // More precise for scoping
    this.fov = options.fov || 20; // Narrower FOV for better magnification (was 30)
    this.originalFov = this.camera.fov; // Store original FOV to restore later

    // State
    this.enabled = false;
    this.rotationY = 0; // Horizontal rotation (matches turret)
    this.rotationX = 0; // Vertical rotation (matches barrel elevation)
    
    // Scope overlay element
    this.scopeOverlay = null;
    this.crosshair = null;

    // Setup mouse controls
    this.setupMouseControls();
    this.createScopeOverlay();
  }

  setupMouseControls() {
    this.domElement.addEventListener('click', () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || document.pointerLockElement !== this.domElement) return;

      // Apply mouse movement to turret and barrel rotation
      const deltaX = e.movementX * this.mouseSensitivity;
      const deltaY = e.movementY * this.mouseSensitivity;

      // Update turret rotation (horizontal)
      this.tank.rotateTurret(deltaX);
      this.rotationY = this.tank.turretGroup.rotation.y;

      // Update barrel elevation (vertical) - inverted for natural feel
      const elevationChange = -deltaY;
      this.tank.elevateBarrel(elevationChange);
      this.rotationX = -this.tank.barrelElevation; // Negative because barrel rotation is inverted
    });
  }

  createScopeOverlay() {
    // Create scope overlay with green tint and circular scope view
    this.scopeOverlay = document.createElement('div');
    this.scopeOverlay.id = 'scope-overlay';
    this.scopeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000;
      display: none;
      background: radial-gradient(circle at center, rgba(0, 255, 0, 0.5) 55%, rgba(0, 0, 0, 0.95) 22%);
    `;

    // Create circular scope boundary
    const scopeCircle = document.createElement('div');
    scopeCircle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40vmin;
      height: 40vmin;
      margin: -20vmin 0 0 -20vmin;
      border: 2px solid rgba(0, 255, 0, 0.8);
      border-radius: 50%;
      box-shadow: 
        0 0 0 2px rgba(0, 0, 0, 0.8),
        0 0 20px rgba(0, 255, 0, 0.3);
    `;

    // Create simple crosshair
    this.crosshair = document.createElement('div');
    this.crosshair.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      margin: -20px 0 0 -20px;
    `;

    // Vertical line
    const verticalLine = document.createElement('div');
    verticalLine.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 2px;
      height: 40px;
      margin: -20px 0 0 -1px;
      background: rgba(0, 11, 0, 0.8);
    `;

    // Horizontal line  
    const horizontalLine1 = document.createElement('div');
    horizontalLine1.style.cssText = `
      position: absolute;
      top: -150%;
      left: 50%;
      width: 40px;
      height: 2px;
      margin: -1px 0 0 -20px;
      background: rgba(0, 11, 0, 0.8);
    `;
    // Horizontal line  
    const horizontalLine2 = document.createElement('div');
    horizontalLine2.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 2px;
      margin: -1px 0 0 -20px;
      background: rgba(0, 11, 0, 0.8);
    `;
    const horizontalLine3 = document.createElement('div');
    horizontalLine3.style.cssText = `
      position: absolute;
      top: 150%;
      left: 50%;
      width: 40px;
      height: 2px;
      margin: -1px 0 0 -20px;
      background: rgba(0, 11, 0, 0.8);
    `;
    const horizontalLine4 = document.createElement('div');
    horizontalLine4.style.cssText = `
      position: absolute;
      top: 460%;
      left: 50%;
      width: 40px;
      height: 2px;
      margin: -1px 0 0 -20px;
      background: rgba(0, 11, 0, 0.8);
    `;
    const horizontalLine5 = document.createElement('div');
    horizontalLine5.style.cssText = `
      position: absolute;
      top: 800%;
      left: 50%;
      width: 40px;
      height: 2px;
      margin: -1px 0 0 -20px;
      background: rgba(0, 11, 0, 0.8);
    `;

    // Distance meter
    const distanceDisplay = document.createElement('div');
    distanceDisplay.id = 'distance-meter';
    distanceDisplay.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(0, 255, 0, 0.9);
      font-family: 'Courier New', monospace;
      font-size: 16px;
      text-align: center;
      background: rgba(0, 0, 0, 0.3);
      padding: 5px 10px;
      border-radius: 3px;
    `;
    distanceDisplay.textContent = 'DISTANCE: ⚠️SYSTEM MALFUNCTION⚠️';

    this.crosshair.appendChild(verticalLine);
    this.crosshair.appendChild(horizontalLine1);
    this.crosshair.appendChild(horizontalLine2);
    this.crosshair.appendChild(horizontalLine3);
    this.crosshair.appendChild(horizontalLine4);
    this.crosshair.appendChild(horizontalLine5);
    this.scopeOverlay.appendChild(scopeCircle);
    this.scopeOverlay.appendChild(this.crosshair);
    this.scopeOverlay.appendChild(distanceDisplay);

    document.body.appendChild(this.scopeOverlay);
  }
  enable() {
    this.enabled = true;

    // Set initial rotations to match current tank state
    this.rotationY = this.tank.turretGroup.rotation.y;
    this.rotationX = -this.tank.barrelElevation;

    // Apply scope FOV
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // Hide mobile scope overlay first to prevent dual overlay issue
    const mobileScopeOverlay = document.getElementById('mobile-scope-overlay');
    if (mobileScopeOverlay) {
      mobileScopeOverlay.style.display = 'none';
      console.log('Hidden mobile scope overlay before showing desktop overlay');
    }

    // Show scope overlay
    if (this.scopeOverlay) {
      this.scopeOverlay.style.display = 'block';
    }

    // Hide tank model parts that might obstruct view
    this.hideTankParts();

    console.log('Barrel scope camera enabled - barrel visibility:', this.tank.barrel ? this.tank.barrel.visible : 'barrel not found');
  }
  disable() {
    this.enabled = false;

    // Restore original FOV
    this.camera.fov = this.originalFov;
    this.camera.updateProjectionMatrix();

    // Hide scope overlay
    if (this.scopeOverlay) {
      this.scopeOverlay.style.display = 'none';
    }

    // Also ensure mobile scope overlay is hidden (safety check)
    const mobileScopeOverlay = document.getElementById('mobile-scope-overlay');
    if (mobileScopeOverlay && mobileScopeOverlay.style.display !== 'none') {
      mobileScopeOverlay.style.display = 'none';
      console.log('Also hidden mobile scope overlay during barrel scope disable');
    }

    // Show tank parts
    this.showTankParts();

    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }

    console.log('Barrel scope camera disabled - barrel visibility:', this.tank.barrel ? this.tank.barrel.visible : 'barrel not found');
  }

  hideTankParts() {
    // Store original visibility and hide parts that might obstruct the view
    this.originalVisibility = [];
    
    console.log('Hiding tank parts for scope view...');
    
    // Only hide the main barrel mesh itself, not the entire turret group
    // This prevents the barrel from appearing in scope view but keeps turret structure intact
    if (this.tank.barrel) {
      this.originalVisibility.push({
        object: this.tank.barrel,
        visible: this.tank.barrel.visible
      });
      this.tank.barrel.visible = false;
      console.log('Hidden main barrel, original visibility:', this.tank.barrel.visible);
      
      // Also hide any direct children of the barrel that might obstruct view
      this.tank.barrel.children.forEach(child => {
        if (child.isMesh) {
          this.originalVisibility.push({
            object: child,
            visible: child.visible
          });
          child.visible = false;
          console.log('Hidden barrel child mesh');
        }
      });
    }
    
    // Hide muzzle brake and mantlet that are in the barrel group
    if (this.tank.barrelGroup) {
      this.tank.barrelGroup.children.forEach(child => {
        if (child.isMesh && child !== this.tank.barrel) {
          this.originalVisibility.push({
            object: child,
            visible: child.visible
          });
          child.visible = false;
          console.log('Hidden barrel group child mesh');
        }
      });
    }
    
    console.log('Total objects hidden:', this.originalVisibility.length);
  }

  showTankParts() {
    // Restore original visibility
    console.log('Restoring tank parts visibility...');
    
    if (this.originalVisibility && this.originalVisibility.length > 0) {
      this.originalVisibility.forEach((item, index) => {
        if (item.object && typeof item.visible === 'boolean') {
          item.object.visible = item.visible;
          console.log(`Restored object ${index + 1}/${this.originalVisibility.length} to visibility:`, item.visible);
        } else {
          console.warn(`Invalid visibility item at index ${index}:`, item);
        }
      });
      this.originalVisibility = [];
      console.log('Tank parts visibility restored');
    } else {
      console.warn('No visibility data to restore or empty array');
    }
  }  update() {
    if (!this.enabled) return 0;

    // Get barrel scope position and orientation
    // Position camera as a gunner's sight - slightly above and behind the barrel for realistic scope view
    // This provides a view that shows the full barrel while maintaining aiming accuracy
    const scopePosition = new THREE.Vector3(0, 1.1, 1.5); // Positioned above and behind barrel center
    this.tank.barrel.parent.localToWorld(scopePosition); // Use barrel group's transform
    this.tank.barrel.parent.updateMatrixWorld(true);

    // Position camera at scope position
    this.camera.position.copy(scopePosition);

    // Get barrel direction for camera orientation
    // Since barrel is rotated 90 degrees around X, its forward direction is positive Z in local space
    const barrelDirection = new THREE.Vector3(0, 0, 1); // Barrel forward direction in barrel group space
    barrelDirection.transformDirection(this.tank.barrel.parent.matrixWorld);
    barrelDirection.normalize();    // Calculate look-at point
    const lookAtPoint = scopePosition.clone().add(barrelDirection.multiplyScalar(100));
    this.camera.lookAt(lookAtPoint);

    // Apply slight camera shake for realism (very subtle)
    const shakeIntensity = 0.001;
    this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
    this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;

    return this.rotationY;
  }

  // Cleanup method to remove scope overlay when needed
  destroy() {
    if (this.scopeOverlay && this.scopeOverlay.parentNode) {
      this.scopeOverlay.parentNode.removeChild(this.scopeOverlay);
    }
  }
}

export { PlayerController, ThirdPersonCameraController, FirstPersonCameraController, BarrelScopeCameraController };