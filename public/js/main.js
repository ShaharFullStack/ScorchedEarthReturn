import * as THREE from 'three';
import { ThirdPersonCameraController, FirstPersonCameraController, BarrelScopeCameraController } from './controls.js';
import { Game } from './game.js';
import { setupScene } from './sceneSetup.js';
import { UI } from './ui.js';
import { AudioManager } from './audioManager.js';
import { AuthManager } from './auth.js';

class MainApp {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500); // Extended far plane for larger map
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        this.thirdPersonController = null;
        this.activeCameraTarget = null;
        this.audioManager = new AudioManager();
        this.ui = new UI(this.audioManager);
        this.isMobile = this.detectMobile();
        this.orientation = window.orientation || 0;

        this.game = null;
        
        // Initialize authentication system
        this.authManager = new AuthManager((user) => this.onAuthStateChanged(user));

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Better shadow quality
        document.body.appendChild(this.renderer.domElement);        setupScene(this.scene);
        // Position camera initially for a good overview of larger map
        this.camera.position.set(0, 35, 40);
        this.camera.lookAt(0, 0, 0);
        
        this.game = new Game(this.scene, this.camera, this.renderer, this.ui, this.audioManager);
          // Make game instance available globally for debugging
        window.gameInstance = this.game;
        
        // Make main app instance available globally for mobile controls
        window.mainApp = this;
        
        // Initialize audio on first user interaction
        this.initializeAudio();
          // Set up difficulty selection handler (called after login)
        this.ui.onDifficultyChange = async (difficulty) => {
            await this.game.startGameInitialization();
            this.activeCameraTarget = this.game.playerTank.mesh;
            this.setupControllers();
            this.setupCameraControls();
            this.game.setCameraController(this.thirdPersonController);
            this.animate();
        };window.addEventListener('resize', this.onWindowResize.bind(this), false);
        
        if (this.isMobile) {
            this.initializeMobileOptimizations();
        }
    }
    
    onAuthStateChanged(user) {
        if (user) {
            // User is logged in, proceed to difficulty selection
            console.log('User authenticated:', user.displayName);
            this.ui.setPlayerName(user.displayName);
            this.ui.showDifficultySelector();
        } else {
            // User logged out, authentication screen will be shown by AuthManager
            console.log('User logged out');
        }
    }

    async initializeAudio() {
        // Initialize audio context on first user interaction (required by browsers)
        const initAudio = async () => {
            await this.audioManager.initializeAudioContext();
            
            // Start playing opening music
            this.audioManager.playMusic('openingScreen');
            
            // Remove event listeners after first interaction
            document.removeEventListener('click', initAudio);
            document.removeEventListener('touchstart', initAudio);
            document.removeEventListener('keydown', initAudio);
        };

        // Add event listeners for user interaction
        document.addEventListener('click', initAudio);
        document.addEventListener('touchstart', initAudio);
        document.addEventListener('keydown', initAudio);
    }    setupControllers() {
        if (!this.activeCameraTarget) {
            console.error("Cannot setup ThirdPersonCameraController without an active target.");
            return;
        }
        this.thirdPersonController = new ThirdPersonCameraController(this.camera, this.activeCameraTarget, this.renderer.domElement, {
            distance: 20, // Increased distance for larger map
            height: 15,   // Higher camera for better overview
            rotationSpeed: 0.003
        });
        this.firstPersonController = new FirstPersonCameraController(this.camera, this.activeCameraTarget, this.renderer.domElement, {
            height: 1.5,
            rotationSpeed: 0.003
        });
        
        // Initialize barrel scope controller when player tank is available
        if (this.game && this.game.playerTank) {
            this.barrelScopeController = new BarrelScopeCameraController(
                this.camera, 
                this.game.playerTank, 
                this.renderer.domElement, 
                {
                    mouseSensitivity: 0.001,
                    fov: 30
                }
            );
            console.log('Barrel scope controller initialized');
        } else {
            this.barrelScopeController = null;
        }
        
        // Track current camera mode
        this.currentCameraMode = 'third-person';
        
        // Set up initial camera controller
        this.thirdPersonController.enable();
    }
      onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }    animate() {
        requestAnimationFrame(this.animate.bind(this));
        const deltaTime = this.clock.getDelta();

        if (this.game) {
            this.game.update(deltaTime);
        }
        
        // Update the appropriate camera controller based on current mode
        if (this.currentCameraMode === 'third-person' && this.thirdPersonController && this.thirdPersonController.enabled) {
            // Ensure the camera target is always up-to-date
            if (this.game && this.game.activeTank && this.thirdPersonController.target !== this.game.activeTank.mesh) {
                this.thirdPersonController.target = this.game.activeTank.mesh;
            }
            this.thirdPersonController.update();
        } else if (this.currentCameraMode === 'first-person' && this.firstPersonController && this.firstPersonController.enabled) {
            this.firstPersonController.update();
        } else if (this.currentCameraMode === 'barrel-scope' && this.barrelScopeController && this.barrelScopeController.enabled) {
            this.barrelScopeController.update();
        }

        this.renderer.render(this.scene, this.camera);
    }detectMobile() {
        // First check user agent for mobile devices
        const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check for touch capabilities (but be more strict)
        const hasTouchScreen = ('ontouchstart' in window) && (navigator.maxTouchPoints > 0);
        
        // Check screen size (but don't rely on it alone)
        const isSmallScreen = window.innerWidth <= 768;
        
        // For a device to be considered mobile, it should have mobile user agent OR (touch + small screen)
        return isMobileUserAgent || (hasTouchScreen && isSmallScreen);
    }
    
    initializeMobileOptimizations() {
        // Prevent zoom on double tap
        this.preventZoom();
        
        // Optimize UI based on screen size
        this.optimizeUIForScreen();
        
        // Handle orientation changes
        this.handleOrientationChange();
        
        // Improve touch responsiveness
        this.improveTouchResponse();
        
        // Auto-hide UI elements when not needed
        this.setupAutoHideUI();
        
        // Optimize performance for mobile
        this.optimizeMobilePerformance();
    }
    
    preventZoom() {
        // Prevent zoom on double tap for game area
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
        
        // Prevent zoom on input focus
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        }
    }
    
    optimizeUIForScreen() {
        const screenHeight = window.innerHeight;
        const screenWidth = window.innerWidth;
        
        // Adjust UI based on available space
        if (screenHeight < 600) {
            // Very small screen - ultra compact mode
            document.body.classList.add('ultra-compact');
            this.enableUltraCompactMode();
        } else if (screenHeight < 800) {
            // Medium screen - compact mode
            document.body.classList.add('compact-mobile');
        }
        
        // Adjust for screen ratio
        if (screenWidth / screenHeight > 1.5) {
            // Very wide screen - adjust layout
            document.body.classList.add('wide-mobile');
        }
    }
    
    enableUltraCompactMode() {
        // Hide even more UI elements for tiny screens
        const elementsToHide = [
            '#controls-info',
            '.mobile-hidden',
            '#action-indicator'
        ];
        
        elementsToHide.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // Make remaining UI even smaller
        const uiContainer = document.getElementById('ui-container');
        if (uiContainer) {
            uiContainer.style.fontSize = '8px';
            uiContainer.style.padding = '2px 4px';
        }
    }
    
    handleOrientationChange() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.optimizeUIForScreen();
                this.adjustControlsForOrientation();
            }, 500); // Wait for orientation change to complete
        });
        
        window.addEventListener('resize', () => {
            this.optimizeUIForScreen();
        });
    }
    
    adjustControlsForOrientation() {
        const isLandscape = window.innerWidth > window.innerHeight;
        const mobileControls = document.getElementById('mobile-controls');
        
        if (mobileControls) {
            if (isLandscape) {
                mobileControls.style.height = '140px';
                mobileControls.style.padding = '8px 12px 12px 12px';
            } else {
                mobileControls.style.height = '180px';
                mobileControls.style.padding = '15px 20px 20px 20px';
            }
        }
    }
    
    improveTouchResponse() {
        // Improve touch responsiveness by reducing delay
        const style = document.createElement('style');
        style.textContent = `
            .mobile-btn, .dpad-btn, .action-btn {
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                user-select: none;
            }
        `;
        document.head.appendChild(style);
        
        // Add haptic feedback if available
        this.addHapticFeedback();
    }
    
    addHapticFeedback() {
        if ('vibrate' in navigator) {
            const mobileButtons = document.querySelectorAll('.mobile-btn');
            mobileButtons.forEach(button => {
                button.addEventListener('touchstart', () => {
                    navigator.vibrate(10); // Very short vibration
                });
            });
            
            const fireButton = document.getElementById('fire-btn');
            if (fireButton) {
                fireButton.addEventListener('touchstart', () => {
                    navigator.vibrate(20); // Slightly longer for fire button
                });
            }
        }
    }
    
    setupAutoHideUI() {
        let hideTimer;
        let isUIVisible = true;
        
        const uiElements = [
            document.getElementById('ui-container'),
            document.getElementById('controls-info')
        ];
        
        const showUI = () => {
            if (!isUIVisible) {
                uiElements.forEach(el => {
                    if (el) {
                        el.style.opacity = '1';
                        el.style.pointerEvents = 'auto';
                    }
                });
                isUIVisible = true;
            }
            
            clearTimeout(hideTimer);
            hideTimer = setTimeout(hideUI, 8000); // Hide after 8 seconds of inactivity
        };
        
        const hideUI = () => {
            uiElements.forEach(el => {
                if (el && el.id !== 'ui-container') { // Keep main UI visible
                    el.style.opacity = '0.3';
                    el.style.pointerEvents = 'none';
                }
            });
            isUIVisible = false;
        };
        
        // Show UI on any touch
        document.addEventListener('touchstart', showUI);
        document.addEventListener('click', showUI);
        
        // Initial hide timer
        hideTimer = setTimeout(hideUI, 8000);
    }
    
    optimizeMobilePerformance() {
        // Reduce rendering quality for mobile if needed
        if (window.gameInstance && window.gameInstance.renderer) {
            const renderer = window.gameInstance.renderer;
            
            // Reduce pixel ratio for better performance
            if (window.devicePixelRatio > 2) {
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            }
            
            // Reduce shadow map size for mobile
            renderer.shadowMap.mapSize.width = 1024;
            renderer.shadowMap.mapSize.height = 1024;
        }
        
        // Throttle resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.gameInstance) {
                    window.gameInstance.onWindowResize();
                }
            }, 250);
        });
    }
    
    // Method to toggle full compact mode
    toggleCompactMode(enable = true) {
        const body = document.body;
        
        if (enable) {
            body.classList.add('mobile-compact-mode');
            
            // Hide all non-essential UI
            const hideSelectors = [
                '#controls-info',
                '#action-indicator',
                '.mobile-hidden'
            ];
            
            hideSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = 'none');
            });
              } else {
            body.classList.remove('mobile-compact-mode');
            
            // Show UI elements again, but NOT on mobile devices
            const isMobile = this.detectMobile();
            
            const showSelectors = [
                '#action-indicator'
            ];
            
            // Only show controls-info on desktop
            if (!isMobile) {
                showSelectors.push('#controls-info');
            }
            
            showSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.display = '');
            });
        }
    }
    
    // Method to adjust UI scale dynamically
    adjustUIScale(scale = 1) {
        const uiContainer = document.getElementById('ui-container');
        const mobileControls = document.getElementById('mobile-controls');
        
        if (uiContainer) {
            uiContainer.style.transform = `scale(${scale})`;
            uiContainer.style.transformOrigin = 'top left';
        }
        
        if (mobileControls) {
            mobileControls.style.transform = `scale(${scale})`;
            mobileControls.style.transformOrigin = 'bottom center';
        }
    }
    
    setupCameraControls() {
        // Handle camera switching with V key
        document.addEventListener('keydown', (event) => {
            if (event.code === 'KeyV' && this.game && this.game.gameState === 'PLAYER_TURN') {
                this.switchCameraMode();
            }
            // Handle right-click or Escape to exit scope view
            if ((event.code === 'Escape') && this.currentCameraMode === 'barrel-scope') {
                this.exitBarrelScope();
            }
        });

        // Handle right-click to exit scope view
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            if (this.currentCameraMode === 'barrel-scope') {
                event.preventDefault();
                this.exitBarrelScope();
            }
        });
    }

    switchCameraMode() {
        if (!this.game || !this.game.playerTank) return;

        // Ensure barrel scope controller is initialized
        if (!this.barrelScopeController) {
            this.barrelScopeController = new BarrelScopeCameraController(
                this.camera, 
                this.game.playerTank, 
                this.renderer.domElement, 
                {
                    mouseSensitivity: 0.001,
                    fov: 30
                }
            );
        }

        // Cycle through camera modes: third-person -> barrel-scope -> third-person
        switch (this.currentCameraMode) {
            case 'third-person':
                this.activateBarrelScope();
                break;
            case 'barrel-scope':
                this.exitBarrelScope();
                break;
        }
    }

    activateBarrelScope() {
        console.log('Switching to barrel scope view');
        
        // Disable current camera controller
        if (this.thirdPersonController && this.thirdPersonController.enabled) {
            this.thirdPersonController.disable();
        }
        if (this.firstPersonController && this.firstPersonController.enabled) {
            this.firstPersonController.disable();
        }

        // Enable barrel scope controller
        this.barrelScopeController.enable();
        this.game.setCameraController(this.barrelScopeController);
        this.currentCameraMode = 'barrel-scope';

        // Show scope activation message
        this.ui.showMessage('Barrel Scope Active - V to exit', 2000);
    }

    exitBarrelScope() {
        console.log('Exiting barrel scope view');
        
        // Disable barrel scope controller
        if (this.barrelScopeController && this.barrelScopeController.enabled) {
            this.barrelScopeController.disable();
        }

        // Return to third-person view
        this.thirdPersonController.enable();
        this.game.setCameraController(this.thirdPersonController);
        this.currentCameraMode = 'third-person';
    }
}

// Add utility functions for mobile detection and optimization
window.isMobileDevice = () => {
    // First check user agent for mobile devices
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check for touch capabilities (but be more strict)
    const hasTouchScreen = ('ontouchstart' in window) && (navigator.maxTouchPoints > 0);
    
    // Check screen size (but don't rely on it alone)
    const isSmallScreen = window.innerWidth <= 768;
    
    // For a device to be considered mobile, it should have mobile user agent OR (touch + small screen)
    return isMobileUserAgent || (hasTouchScreen && isSmallScreen);
};

// Function to enable/disable compact mode manually
window.toggleMobileCompactMode = (enable) => {
    if (window.mainApp) {
        window.mainApp.toggleCompactMode(enable);
    }
};

// Function to adjust UI scale manually
window.adjustMobileUIScale = (scale) => {
    if (window.mainApp) {
        window.mainApp.adjustUIScale(scale);
    }
};

// Function to force enable mobile controls for testing
window.forceMobileControls = function() {
    console.log('Force enabling mobile controls for testing...');
    localStorage.setItem('forceMobileControls', 'true');
    
    if (window.gameInstance && window.gameInstance.mobileControls) {
        window.gameInstance.mobileControls.forceEnable();
    }
    
    // Also manually show controls
    const controlsElement = document.getElementById('mobile-controls');
    if (controlsElement) {
        controlsElement.style.display = 'flex';
        controlsElement.style.visibility = 'visible';
        controlsElement.classList.add('force-enable');
        console.log('Mobile controls manually enabled');
    }
    
    alert('Mobile controls enabled! Check the bottom of the screen.');
};

// Note: Test mobile button removed as mobile controls redesign is complete

// Initialize the main application
window.mainApp = new MainApp();