/**
 * Mobile Touch Controls Handler
 * Provides mobile touch button controls for mobile devices
 */

export class MobileControls {
    constructor(game) {
        this.game = game;
        this.isEnabled = this.isMobileDevice();

        console.log('Mobile device detection:', this.isEnabled);
        console.log('User agent:', navigator.userAgent);
        console.log('Window width:', window.innerWidth);
        console.log('Touch support:', 'ontouchstart' in window);

        // Button states for D-pad controls
        this.buttonStates = {
            moveForward: false,
            moveBackward: false,
            rotateLeft: false,
            rotateRight: false,
            turretLeft: false,
            turretRight: false,
            barrelUp: false,
            barrelDown: false,
            powerUp: false,
            powerDown: false,
            fire: false
        };

        // Touch tracking
        this.activeTouches = new Map();

        // Mobile scope state and controls
        this.scopeState = {
            isActive: false,
            touchStartX: 0,
            touchStartY: 0,
            lastTouchX: 0,
            lastTouchY: 0,
            sensitivity: 0.002, // Touch sensitivity for scope aiming
            overlay: null,
            exitButton: null
        };

        if (this.isEnabled) {
            this.setupMobileControls();
            this.setupMobileScopeUI();
        } else {
            console.log('Mobile controls not enabled - not a mobile device');
        }
    } isMobileDevice() {
        // Check user agent for mobile devices
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // Check for touch capabilities (be more strict - both conditions needed)
        const hasTouchScreen = ('ontouchstart' in window) && (navigator.maxTouchPoints > 0);

        // Check screen size (use the same threshold as main.js)
        const isSmallScreen = window.innerWidth <= 768;

        // For testing purposes, also enable if localStorage has a flag
        const forceEnable = localStorage.getItem('forceMobileControls') === 'true';

        // Mobile device = mobile user agent OR (touch + small screen) OR force enabled
        const isMobile = isMobileUserAgent || (hasTouchScreen && isSmallScreen) || forceEnable;

        console.log('Mobile detection results:', {
            isMobileUserAgent,
            hasTouchScreen,
            isSmallScreen,
            forceEnable,
            finalResult: isMobile,
            userAgent: navigator.userAgent,
            windowWidth: window.innerWidth,
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints
        });

        return isMobile;
    } setupMobileControls() {
        console.log('=== Setting up mobile controls ===');

        // Show mobile controls
        const mobileControls = document.getElementById('mobile-controls');
        console.log('Mobile controls element found:', !!mobileControls);

        if (mobileControls) {
            console.log('Current display style:', mobileControls.style.display);
            console.log('Current computed style:', window.getComputedStyle(mobileControls).display);

            mobileControls.style.display = 'flex';
            mobileControls.style.visibility = 'visible';
            mobileControls.classList.add('force-enable'); // Add class for CSS targeting

            console.log('After setting display:flex - computed style:', window.getComputedStyle(mobileControls).display);
            console.log('Mobile controls classes:', mobileControls.className);
            console.log('Mobile controls enabled and displayed');
        } else {
            console.error('Mobile controls element not found in DOM');
            console.log('Available elements with mobile:',
                Array.from(document.querySelectorAll('[id*="mobile"]')).map(el => el.id));
        }

        // Add body class for mobile styling since mobile controls are enabled
        document.body.classList.add('mobile-device');
        console.log('Body classes:', document.body.className); this.setupMovementButtons();
        this.setupActionButtons();
        this.setupTouchCamera();

        console.log('=== Mobile controls setup complete ===');
    } setupMovementButtons() {
        console.log('Setting up movement button controls');

        // Setup directional movement buttons
        this.setupButton('move-up-btn', 'moveForward');
        this.setupButton('move-down-btn', 'moveBackward');
        this.setupButton('rotate-left-btn', 'rotateLeft');
        this.setupButton('rotate-right-btn', 'rotateRight');

        console.log('Movement buttons setup complete');
    } setupActionButtons() {
        // Turret controls
        this.setupButton('turret-left-btn', 'turretLeft');
        this.setupButton('turret-right-btn', 'turretRight');

        // Barrel controls
        this.setupButton('barrel-up-btn', 'barrelUp');
        this.setupButton('barrel-down-btn', 'barrelDown');

        // Power controls
        this.setupButton('power-up-btn', 'powerUp');
        this.setupButton('power-down-btn', 'powerDown');        // Fire button
        this.setupButton('fire-btn', 'fire');
        // Scope button - special handling for toggle
        this.setupScopeButton('scope-btn');
    }
    setupButton(buttonId, actionName) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.error(`Button not found: ${buttonId}`);
            return;
        }

        console.log(`Setting up button: ${buttonId} for action: ${actionName}`);
        // Touch start
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            console.log(`Touch start on ${buttonId}`);

            // Play button press sound for all buttons except fire (fire has its own sound)
            if (this.game.audioManager && actionName !== 'click') {
                this.game.audioManager.playSound('click', 0.1);
            }

            this.setButtonState(actionName, true);
            button.classList.add('active');
        });

        // Touch end
        button.addEventListener('touchend', (e) => {
            e.preventDefault();
            console.log(`Touch end on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });

        // Touch cancel (when finger moves off button)
        button.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            console.log(`Touch cancel on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });

        // Mouse events for testing on desktop
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            console.log(`Mouse down on ${buttonId}`);
            this.setButtonState(actionName, true);
            button.classList.add('active');
        });

        button.addEventListener('mouseup', (e) => {
            e.preventDefault();
            console.log(`Mouse up on ${buttonId}`);
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });

        button.addEventListener('mouseleave', (e) => {
            this.setButtonState(actionName, false);
            button.classList.remove('active');
        });
    } setButtonState(actionName, active) {
        this.buttonStates[actionName] = active;
        console.log(`DEBUG: Setting ${actionName} to ${active}`);

        // Special debug logging for turret controls
        if (actionName === 'turretLeft' || actionName === 'turretRight') {
            console.log(`DEBUG: Turret button ${actionName} state changed to ${active}`);
        }        // Map to game input states
        switch (actionName) {
            case 'moveForward':
                this.game.inputStates.moveForward = active;
                break;
            case 'moveBackward':
                this.game.inputStates.moveBackward = active;
                break;
            case 'rotateLeft':
                this.game.inputStates.rotateLeft = active;
                break;
            case 'rotateRight':
                this.game.inputStates.rotateRight = active;
                break;
            case 'turretLeft':
                this.game.inputStates.turretLeft = active;
                console.log(`DEBUG: Set game.inputStates.turretLeft = ${active}`);
                break;
            case 'turretRight':
                this.game.inputStates.turretRight = active;
                console.log(`DEBUG: Set game.inputStates.turretRight = ${active}`);
                break;
            case 'barrelUp':
                this.game.inputStates.barrelUp = active;
                break;
            case 'barrelDown':
                this.game.inputStates.barrelDown = active;
                break;
            case 'powerUp':
                this.game.inputStates.increasePower = active;
                break;
            case 'powerDown':
                this.game.inputStates.decreasePower = active;
                break;
            case 'fire':
                if (active && !this.game.playerTank.hasFiredThisTurn) {
                    this.game.inputStates.fire = true;
                    console.log('Fire button pressed, setting fire state to true');
                }
                break;
        }
    }

    setupTouchCamera() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;

        let lastTouchDistance = 0;
        let lastTouchCenter = { x: 0, y: 0 };
        let cameraRotation = 0;

        // Handle pinch-to-zoom and camera rotation
        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                // Two-finger gesture
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];

                lastTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );

                lastTouchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            } else if (e.touches.length === 1) {
                // Single finger camera rotation
                const touch = e.touches[0];
                lastTouchCenter = { x: touch.clientX, y: touch.clientY };
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling

            if (e.touches.length === 2) {
                // Pinch to zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];

                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );

                const scale = currentDistance / lastTouchDistance;
                if (this.game.cameraController && this.game.cameraController.camera) {
                    // Adjust camera distance
                    if (this.game.cameraController.distance) {
                        this.game.cameraController.distance = Math.max(3, Math.min(15,
                            this.game.cameraController.distance / scale));
                    }
                }

                lastTouchDistance = currentDistance;
            } else if (e.touches.length === 1) {
                // Single finger camera rotation
                const touch = e.touches[0];
                const deltaX = touch.clientX - lastTouchCenter.x;

                if (this.game.cameraController && this.game.cameraController.rotation !== undefined) {
                    this.game.cameraController.rotation -= deltaX * 0.01;
                }

                lastTouchCenter = { x: touch.clientX, y: touch.clientY };
            }
        });
    }

    // Update method called from game loop
    update(deltaTime) {
        if (!this.isEnabled) return;
    }

    // Enable/disable mobile controls
    enable() {
        this.isEnabled = true;
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'flex';
        }
    } disable() {
        this.isEnabled = false;
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'none';
            mobileControls.classList.remove('force-enable');
        }

        // Remove mobile-device class if it was added
        document.body.classList.remove('mobile-device');

        this.clearAllInputStates();
    }

    clearAllInputStates() {
        // Clear all movement input states
        this.game.inputStates.moveForward = false;
        this.game.inputStates.moveBackward = false;
        this.game.inputStates.rotateLeft = false;
        this.game.inputStates.rotateRight = false;

        // Clear all button states
        Object.keys(this.buttonStates).forEach(key => {
            this.buttonStates[key] = false;
        });
    }// Force enable mobile controls for testing
    forceEnable() {
        console.log('Force enabling mobile controls');
        localStorage.setItem('forceMobileControls', 'true');
        this.isEnabled = true;
        this.setupMobileControls();

        // Also make sure the controls are visible
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.style.display = 'flex';
            mobileControls.classList.add('force-enable');
            console.log('Mobile controls should now be visible!');
        }
    }

    setupScopeButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.error(`Scope button not found: ${buttonId}`);
            return;
        }

        console.log(`Setting up scope button: ${buttonId}`);

        // Handle scope toggle on tap/click with mobile enhancements
        const handleScopeToggle = (e) => {
            e.preventDefault();
            console.log('Scope button pressed');

            // Enhanced mobile scope handling
            if (this.scopeState.isActive) {
                // Exit mobile scope mode
                this.exitMobileScope();
            } else {
                // Enter scope mode - first activate through main app
                if (window.mainApp && window.mainApp.switchCameraMode) {
                    window.mainApp.switchCameraMode();
                    // Then activate mobile scope overlay
                    setTimeout(() => this.activateMobileScope(), 100);
                } else if (this.game && this.game.mainApp && this.game.mainApp.switchCameraMode) {
                    this.game.mainApp.switchCameraMode();
                    setTimeout(() => this.activateMobileScope(), 100);
                } else {
                    console.warn('Could not access camera switching function');
                }
            }
        };

        // Touch events
        button.addEventListener('touchstart', handleScopeToggle);

        // Mouse events for desktop testing
        button.addEventListener('click', handleScopeToggle);
    }

    /**
     * Setup mobile-specific scope UI and controls
     */
    setupMobileScopeUI() {
        console.log('Setting up mobile scope UI...');

        // Create mobile scope overlay
        this.createMobileScopeOverlay();

        // Setup touch-based scope aiming
        this.setupTouchScopeControls();
    }

    /**
     * Create simple mobile scope overlay with green tint and circular scope
     */  createMobileScopeOverlay() {
    // Create scope overlay with green tint and circular scope view
    this.scopeOverlay = document.createElement('div');
    this.scopeOverlay.id = 'mobile-scope-overlay';  // Use unique ID for mobile
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
    this.scopeOverlay.appendChild(distanceDisplay);    document.body.appendChild(this.scopeOverlay);
    
    // Assign the created overlay to scopeState for touch controls
    this.scopeState.overlay = this.scopeOverlay;
  }

    /**
     * Setup touch-based scope aiming controls
     */
    setupTouchScopeControls() {
        const overlay = this.scopeState.overlay;
        if (!overlay) return;

        // Touch start handler
        overlay.addEventListener('touchstart', (e) => {
            if (!this.scopeState.isActive) return;

            e.preventDefault();
            const touch = e.touches[0];
            this.scopeState.touchStartX = touch.clientX;
            this.scopeState.touchStartY = touch.clientY;
            this.scopeState.lastTouchX = touch.clientX;
            this.scopeState.lastTouchY = touch.clientY;
        }, { passive: false });

        // Touch move handler for aiming
        overlay.addEventListener('touchmove', (e) => {
            if (!this.scopeState.isActive) return;

            e.preventDefault();
            const touch = e.touches[0];

            // Calculate movement delta
            const deltaX = touch.clientX - this.scopeState.lastTouchX;
            const deltaY = touch.clientY - this.scopeState.lastTouchY;

            // Apply sensitivity
            const adjustedDeltaX = deltaX * this.scopeState.sensitivity;
            const adjustedDeltaY = deltaY * this.scopeState.sensitivity;

            // Apply to tank controls if game is available
            if (this.game && this.game.playerTank) {
                // Horizontal movement controls turret rotation
                this.game.playerTank.rotateTurret(adjustedDeltaX);

                // Vertical movement controls barrel elevation (inverted for natural feel)
                this.game.playerTank.elevateBarrel(-adjustedDeltaY);
            }

            // Update last touch position
            this.scopeState.lastTouchX = touch.clientX;
            this.scopeState.lastTouchY = touch.clientY;
        }, { passive: false });

        // Touch end handler
        overlay.addEventListener('touchend', (e) => {
            if (!this.scopeState.isActive) return;
            e.preventDefault();
        }, { passive: false });
    }    /**
     * Activate mobile scope mode
     */
    activateMobileScope() {
        console.log('Activating mobile scope mode...');

        this.scopeState.isActive = true;

        // Hide desktop scope overlay first to prevent dual overlay issue
        const desktopScopeOverlay = document.getElementById('scope-overlay');
        if (desktopScopeOverlay) {
            desktopScopeOverlay.style.display = 'none';
            console.log('Hidden desktop scope overlay before showing mobile overlay');
        }

        // Show mobile scope overlay
        if (this.scopeState.overlay) {
            this.scopeState.overlay.style.display = 'block';
        }        // Keep mobile controls visible but add scope-active class for higher z-index
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.add('scope-active');
            // Only show mobile controls if this is actually a mobile device
            if (this.isEnabled) {
                mobileControls.style.display = 'flex';
                mobileControls.style.zIndex = '30000';
            }
        }

        // Add scope-active class to body for additional CSS targeting
        document.body.classList.add('scope-active');

        console.log('Mobile scope activated - controls remain visible');
    }/**
     * Exit mobile scope mode
     */
    exitMobileScope() {
        console.log('Exiting mobile scope mode...');

        this.scopeState.isActive = false;

        // Hide mobile scope overlay immediately
        if (this.scopeState.overlay) {
            this.scopeState.overlay.style.display = 'none';
        }

        // Also ensure desktop scope overlay is hidden to prevent dual overlay issue
        const desktopScopeOverlay = document.getElementById('scope-overlay');
        if (desktopScopeOverlay) {
            desktopScopeOverlay.style.display = 'none';
            console.log('Hidden desktop scope overlay to prevent dual overlay issue');
        }        // Remove scope-active classes and reset z-index
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.remove('scope-active');
            // Only show mobile controls if this is actually a mobile device
            if (this.isEnabled) {
                mobileControls.style.display = 'flex';
                mobileControls.style.zIndex = '25000'; // Reset to default high value
            } else {
                // Ensure mobile controls stay hidden on desktop
                mobileControls.style.display = 'none';
            }
        }

        // Remove scope-active class from body
        document.body.classList.remove('scope-active');

        // Exit scope mode through main app (this should handle camera switching)
        if (window.mainApp && window.mainApp.exitBarrelScope) {
            window.mainApp.exitBarrelScope();
        } else if (this.game && this.game.mainApp && this.game.mainApp.exitBarrelScope) {
            this.game.mainApp.exitBarrelScope();
        }

        console.log('Mobile scope exited - both overlays hidden');
    }

    setupSettingsButton(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button) {
            console.error(`Settings button not found: ${buttonId}`);
            return;
        }

        console.log(`Setting up settings button: ${buttonId}`);

        // Handle settings toggle on tap/click
        const handleSettingsToggle = (e) => {
            e.preventDefault();
            console.log('Settings button pressed');

            // Play button press sound
            if (this.game.audioManager) {
                this.game.audioManager.playSound('click', 0.1);
            }

            // Toggle settings menu
            this.toggleSettingsMenu();
        };

        // Touch events
        button.addEventListener('touchstart', handleSettingsToggle);

        // Mouse events for desktop testing
        button.addEventListener('click', handleSettingsToggle);
    }

    /**
     * Toggle the settings menu visibility
     */
    toggleSettingsMenu() {
        console.log('Toggling settings menu...');

        // Check if settings menu exists, if not create it
        let settingsMenu = document.getElementById('mobile-settings-menu');

        if (!settingsMenu) {
            this.createSettingsMenu();
            settingsMenu = document.getElementById('mobile-settings-menu');
        }

        // Toggle visibility
        if (settingsMenu.style.display === 'none' || !settingsMenu.style.display) {
            settingsMenu.style.display = 'block';
            console.log('Settings menu opened');
        } else {
            settingsMenu.style.display = 'none';
            console.log('Settings menu closed');
        }
    }

    /**
     * Create the mobile settings menu overlay
     */
    createSettingsMenu() {
        console.log('Creating mobile settings menu...');

        // Create settings menu overlay
        const settingsMenu = document.createElement('div');
        settingsMenu.id = 'mobile-settings-menu';
        settingsMenu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 300px;
            max-width: 90vw;
            background: linear-gradient(135deg, rgba(35, 45, 25, 0.95), rgba(25, 35, 20, 0.9));
            border: 3px solid #4a5d23;
            border-radius: 15px;
            padding: 20px;
            z-index: 3002;
            display: none;
            box-shadow: 
                0 10px 30px rgba(0, 0, 0, 0.8),
                0 0 20px rgba(74, 93, 35, 0.4),
                inset 0 2px 8px rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            color: #00ff41;
            font-family: 'Rajdhani', monospace;
        `;

        // Settings header
        const header = document.createElement('div');
        header.style.cssText = `
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #00ff41;
            text-shadow: 0 0 5px rgba(0, 255, 65, 0.5);
        `;
        header.innerHTML = '⚙️ SETTINGS';
        settingsMenu.appendChild(header);

        // Audio settings section
        const audioSection = document.createElement('div');
        audioSection.style.cssText = `margin-bottom: 15px;`;
        audioSection.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">Audio Settings:</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>Master Volume:</span>
                <input type="range" id="master-volume" min="0" max="100" value="50" style="width: 120px;">
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>SFX Volume:</span>
                <input type="range" id="sfx-volume" min="0" max="100" value="50" style="width: 120px;">
            </div>
        `;
        settingsMenu.appendChild(audioSection);

        // Controls settings section
        const controlsSection = document.createElement('div');
        controlsSection.style.cssText = `margin-bottom: 15px;`;
        controlsSection.innerHTML = `
            <div style="margin-bottom: 10px; font-weight: bold;">Controls:</div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span>Touch Sensitivity:</span>
                <input type="range" id="touch-sensitivity" min="0.001" max="0.005" step="0.001" value="0.002" style="width: 120px;">
            </div>
        `;
        settingsMenu.appendChild(controlsSection);

        // Close button
        const closeButton = document.createElement('button');
        closeButton.style.cssText = `
            width: 100%;
            padding: 10px;
            background: linear-gradient(135deg, rgba(220, 53, 69, 0.9), rgba(185, 43, 58, 0.9));
            border: 2px solid #dc3545;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: 'Rajdhani', monospace;
        `;
        closeButton.innerHTML = 'CLOSE';
        closeButton.addEventListener('click', () => {
            settingsMenu.style.display = 'none';

            // Play button press sound
            if (this.game.audioManager) {
                this.game.audioManager.playSound('click', 0.1);
            }
        });
        closeButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            settingsMenu.style.display = 'none';

            // Play button press sound
            if (this.game.audioManager) {
                this.game.audioManager.playSound('click', 0.1);
            }
        });
        settingsMenu.appendChild(closeButton);

        // Add event listeners for settings changes
        this.setupSettingsEventListeners(settingsMenu);

        document.body.appendChild(settingsMenu);
        console.log('Mobile settings menu created');
    }

    /**
     * Setup event listeners for settings controls
     */
    setupSettingsEventListeners(settingsMenu) {
        // Touch sensitivity control
        const touchSensitivity = settingsMenu.querySelector('#touch-sensitivity');
        if (touchSensitivity) {
            touchSensitivity.addEventListener('input', (e) => {
                this.scopeState.sensitivity = parseFloat(e.target.value);
                console.log('Touch sensitivity updated:', this.scopeState.sensitivity);
            });
        }

        // Master volume control
        const masterVolume = settingsMenu.querySelector('#master-volume');
        if (masterVolume) {
            masterVolume.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value) / 100;
                if (this.game.audioManager) {
                    this.game.audioManager.setMasterVolume(volume);
                    console.log('Master volume updated:', volume);
                }
            });
        }

        // SFX volume control
        const sfxVolume = settingsMenu.querySelector('#sfx-volume');
        if (sfxVolume) {
            sfxVolume.addEventListener('input', (e) => {
                const volume = parseInt(e.target.value) / 100;
                if (this.game.audioManager) {
                    this.game.audioManager.setSfxVolume(volume);
                    console.log('SFX volume updated:', volume);
                }
            });
        }
    }
}
