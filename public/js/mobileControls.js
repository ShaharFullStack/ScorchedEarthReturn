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
    }    isMobileDevice() {
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
    }setupMobileControls() {
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
                Array.from(document.querySelectorAll('[id*="mobile"]')).map(el => el.id));        }

        // Add body class for mobile styling since mobile controls are enabled
        document.body.classList.add('mobile-device');
        console.log('Body classes:', document.body.className);        this.setupMovementButtons();
        this.setupActionButtons();
        this.setupTouchCamera();
        
        console.log('=== Mobile controls setup complete ===');
    }    setupMovementButtons() {
        console.log('Setting up movement button controls');

        // Setup directional movement buttons
        this.setupButton('move-up-btn', 'moveForward');
        this.setupButton('move-down-btn', 'moveBackward');
        this.setupButton('rotate-left-btn', 'rotateLeft');
        this.setupButton('rotate-right-btn', 'rotateRight');

        console.log('Movement buttons setup complete');
    }    setupActionButtons() {
        // Turret controls
        this.setupButton('turret-left-btn', 'turretLeft');
        this.setupButton('turret-right-btn', 'turretRight');

        // Barrel controls
        this.setupButton('barrel-up-btn', 'barrelUp');
        this.setupButton('barrel-down-btn', 'barrelDown');

        // Power controls
        this.setupButton('power-up-btn', 'powerUp');
        this.setupButton('power-down-btn', 'powerDown');

        // Fire button
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

                lastTouchDistance = currentDistance;            } else if (e.touches.length === 1) {
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
    }    disable() {
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
     * Create enhanced mobile scope overlay with mobile-friendly controls
     */
    createMobileScopeOverlay() {
        // Create mobile scope overlay container
        this.scopeState.overlay = document.createElement('div');
        this.scopeState.overlay.id = 'mobile-scope-overlay';
        this.scopeState.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 1500;
            display: none;
            background: radial-gradient(circle at center, transparent 18%, rgba(0,0,0,0.95) 22%);
        `;

        // Create mobile crosshair - larger for touch devices
        const mobileCrosshair = document.createElement('div');
        mobileCrosshair.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 60px;
            height: 60px;
            margin: -30px 0 0 -30px;
            border: 3px solid rgba(0, 255, 65, 0.9);
            border-radius: 50%;
            box-shadow: 
                0 0 0 2px rgba(0, 0, 0, 0.8),
                0 0 20px rgba(0, 255, 65, 0.5);
        `;

        // Mobile crosshair lines - thicker for visibility
        const verticalLine = document.createElement('div');
        verticalLine.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 4px;
            height: 30px;
            margin: -15px 0 0 -2px;
            background: rgba(0, 255, 65, 0.9);
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.8);
        `;

        const horizontalLine = document.createElement('div');
        horizontalLine.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            width: 30px;
            height: 4px;
            margin: -2px 0 0 -15px;
            background: rgba(0, 255, 65, 0.9);
            box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.8);
        `;

        mobileCrosshair.appendChild(verticalLine);
        mobileCrosshair.appendChild(horizontalLine);
        this.scopeState.overlay.appendChild(mobileCrosshair);

        // Create mobile scope info panel
        const scopeInfo = document.createElement('div');
        scopeInfo.style.cssText = `
            position: absolute;
            bottom: 120px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid rgba(0, 255, 65, 0.7);
            border-radius: 10px;
            padding: 15px 20px;
            color: rgba(0, 255, 65, 0.9);
            font-family: 'Orbitron', 'Arial', sans-serif;
            font-size: 16px;
            text-align: center;
            text-shadow: 0 0 5px rgba(0, 255, 65, 0.7);
            pointer-events: none;
        `;
        scopeInfo.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px;">🔭 SCOPE VIEW</div>
            <div style="font-size: 14px; opacity: 0.8;">Touch & drag to aim</div>
        `;
        this.scopeState.overlay.appendChild(scopeInfo);

        // Create mobile exit scope button
        this.scopeState.exitButton = document.createElement('button');
        this.scopeState.exitButton.style.cssText = `
            position: absolute;
            top: 30px;
            right: 30px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, rgba(220, 53, 69, 0.9), rgba(185, 43, 58, 0.9));
            border: 3px solid rgba(255, 255, 255, 0.8);
            border-radius: 50%;
            color: white;
            font-size: 24px;
            font-weight: bold;
            cursor: pointer;
            pointer-events: auto;
            box-shadow: 
                0 4px 8px rgba(0, 0, 0, 0.4),
                0 0 15px rgba(220, 53, 69, 0.5);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
        `;
        this.scopeState.exitButton.innerHTML = '✕';
        this.scopeState.exitButton.title = 'Exit Scope';

        // Exit button touch effects
        this.scopeState.exitButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.scopeState.exitButton.style.transform = 'scale(0.9)';
        });

        this.scopeState.exitButton.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.scopeState.exitButton.style.transform = 'scale(1)';
            this.exitMobileScope();
        });

        this.scopeState.overlay.appendChild(this.scopeState.exitButton);

        // Create touch area for aiming
        const touchArea = document.createElement('div');
        touchArea.style.cssText = `
            position: absolute;
            top: 25%;
            left: 25%;
            width: 50%;
            height: 50%;
            border: 2px dashed rgba(0, 255, 65, 0.3);
            border-radius: 20px;
            pointer-events: auto;
            background: rgba(0, 255, 65, 0.05);
        `;
        this.scopeState.overlay.appendChild(touchArea);

        document.body.appendChild(this.scopeState.overlay);
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
    }

    /**
     * Activate mobile scope mode
     */
    activateMobileScope() {
        console.log('Activating mobile scope mode...');
        
        this.scopeState.isActive = true;
        
        // Show mobile scope overlay
        if (this.scopeState.overlay) {
            this.scopeState.overlay.style.display = 'block';
        }
        
        // Keep mobile controls visible but add scope-active class for higher z-index
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.add('scope-active');
            // Ensure they stay visible
            mobileControls.style.display = 'flex';
            mobileControls.style.zIndex = '30000';
        }
        
        // Add scope-active class to body for additional CSS targeting
        document.body.classList.add('scope-active');
        
        console.log('Mobile scope activated - controls remain visible');
    }

    /**
     * Exit mobile scope mode
     */
    exitMobileScope() {
        console.log('Exiting mobile scope mode...');
        
        this.scopeState.isActive = false;
        
        // Hide mobile scope overlay
        if (this.scopeState.overlay) {
            this.scopeState.overlay.style.display = 'none';
        }
        
        // Remove scope-active classes and reset z-index
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) {
            mobileControls.classList.remove('scope-active');
            mobileControls.style.display = 'flex';
            mobileControls.style.zIndex = '25000'; // Reset to default high value
        }
        
        // Remove scope-active class from body
        document.body.classList.remove('scope-active');
        
        // Exit scope mode through main app
        if (window.mainApp && window.mainApp.exitBarrelScope) {
            window.mainApp.exitBarrelScope();
        } else if (this.game && this.game.mainApp && this.game.mainApp.exitBarrelScope) {
            this.game.mainApp.exitBarrelScope();
        }
        
        console.log('Mobile scope exited');
    }
}
