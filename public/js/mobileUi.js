// Mobile UI JavaScript Improvements
// Add this to your main.js or create a new mobile-ui.js file

class MobileUIOptimizer {
    constructor() {
        this.isMobile = this.detectMobile();
        this.orientation = window.orientation || 0;
        
        if (this.isMobile) {
            this.initializeMobileOptimizations();
        }
    }
    
    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               window.innerWidth <= 768;
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
            
            // Show UI elements again
            const showSelectors = [
                '#controls-info',
                '#action-indicator'
            ];
            
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
}

// Initialize mobile UI optimizer when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileUIOptimizer = new MobileUIOptimizer();
    });
} else {
    window.mobileUIOptimizer = new MobileUIOptimizer();
}

// Add utility functions for mobile detection and optimization
window.isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0) ||
           window.innerWidth <= 768;
};

// Function to enable/disable compact mode manually
window.toggleMobileCompactMode = (enable) => {
    if (window.mobileUIOptimizer) {
        window.mobileUIOptimizer.toggleCompactMode(enable);
    }
};

// Function to adjust UI scale manually
window.adjustMobileUIScale = (scale) => {
    if (window.mobileUIOptimizer) {
        window.mobileUIOptimizer.adjustUIScale(scale);
    }
};