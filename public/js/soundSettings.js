// Sound Settings UI Component
export class SoundSettings {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.isVisible = false;
        this.settingsPanel = null;
        this.musicSlider = null;
        this.sfxSlider = null;
        this.masterMuteButton = null;
        
        this.createSettingsPanel();
        this.setupEventListeners();
    }
    
    createSettingsPanel() {
        // Create settings panel
        this.settingsPanel = document.createElement('div');
        this.settingsPanel.id = 'sound-settings-panel';
        this.settingsPanel.className = 'sound-settings-panel hidden';
        
        this.settingsPanel.innerHTML = `
            <div class="settings-content">
                <div class="settings-header">
                    <h3>🔊 Audio Settings</h3>
                    <button class="close-btn" id="close-sound-settings">✕</button>
                </div>
                
                <div class="volume-controls">
                    <div class="volume-group">
                        <label for="music-volume">🎵 Music Volume</label>
                        <div class="slider-container">
                            <input type="range" id="music-volume" 
                                   min="0" max="100" value="30" 
                                   class="volume-slider">
                            <span class="volume-value" id="music-value">30%</span>
                        </div>
                    </div>
                    
                    <div class="volume-group">
                        <label for="sfx-volume">🔫 SFX Volume</label>
                        <div class="slider-container">
                            <input type="range" id="sfx-volume" 
                                   min="0" max="100" value="70" 
                                   class="volume-slider">
                            <span class="volume-value" id="sfx-value">70%</span>
                        </div>
                    </div>
                    
                    <div class="volume-group">
                        <button id="master-mute" class="master-mute-btn">
                            🔊 Mute All Sounds
                        </button>
                    </div>
                    
                    <div class="sound-test">
                        <button id="test-music" class="test-btn">🎵Stop / Play Music</button>
                    </div>
                </div>
                
                <div class="sound-info">
                    <small>Settings are saved automatically</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.settingsPanel);
        
        // Get references to controls
        this.musicSlider = document.getElementById('music-volume');
        this.sfxSlider = document.getElementById('sfx-volume');
        this.masterMuteButton = document.getElementById('master-mute');
        
        // Load saved settings
        this.loadSettings();
    }
    
    setupEventListeners() {
        // Close button
        document.getElementById('close-sound-settings').addEventListener('click', () => {
            this.hide();
        });        // Music volume slider
        this.musicSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioManager.setMusicVolume(volume);
            document.getElementById('music-value').textContent = e.target.value + '%';
            this.saveSettings();
        });
        
        // Add mobile-specific events for music slider
        this.musicSlider.addEventListener('change', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioManager.setMusicVolume(volume);
            document.getElementById('music-value').textContent = e.target.value + '%';
            this.saveSettings();
        });
          // SFX volume slider
        this.sfxSlider.addEventListener('input', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioManager.setSFXVolume(volume);
            document.getElementById('sfx-value').textContent = e.target.value + '%';
            this.saveSettings();
        });
        
        // Add mobile-specific events for SFX slider
        this.sfxSlider.addEventListener('change', (e) => {
            const volume = parseInt(e.target.value) / 100;
            this.audioManager.setSFXVolume(volume);
            document.getElementById('sfx-value').textContent = e.target.value + '%';
            this.saveSettings();
        });
        
        // Master mute button
        this.masterMuteButton.addEventListener('click', () => {
            if (this.audioManager.sfxVolume > 0 || this.audioManager.currentMusic) {
                this.audioManager.muteAll();
                this.masterMuteButton.textContent = '🔇 Unmute All';
                this.masterMuteButton.classList.add('muted');
            } else {
                this.audioManager.unmuteAll();
                this.masterMuteButton.textContent = '🔊 Mute All';
                this.masterMuteButton.classList.remove('muted');
                // Update sliders to reflect restored volumes
                this.updateSlidersFromAudioManager();
            }
            this.saveSettings();
        });        // Test buttons
        document.getElementById('test-music').addEventListener('click', () => {
            if (this.audioManager.isMusicPlaying()) {
                this.audioManager.stopMusic();
            } else {
                this.audioManager.playMusic('openingScreen');
            }
        });
        
        // Click outside to close
        this.settingsPanel.addEventListener('click', (e) => {
            if (e.target === this.settingsPanel) {
                this.hide();
            }
        });
        
        // Keyboard shortcut to close (ESC)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    show() {
        this.isVisible = true;
        this.settingsPanel.classList.remove('hidden');
        this.settingsPanel.classList.add('visible');
        this.updateSlidersFromAudioManager();
        this.updateMuteButtonState();
        
        // Play opening sound
        if (this.audioManager) {
            this.audioManager.playSound('click', 0.3);
        }
    }
    
    hide() {
        this.isVisible = false;
        this.settingsPanel.classList.remove('visible');
        this.settingsPanel.classList.add('hidden');
        
        // Play closing sound
        if (this.audioManager) {
            this.audioManager.playSound('click', 0.2);
        }
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    updateSlidersFromAudioManager() {
        // Update music slider
        const musicPercent = Math.round(this.audioManager.musicVolume * 100);
        this.musicSlider.value = musicPercent;
        document.getElementById('music-value').textContent = musicPercent + '%';
        
        // Update SFX slider
        const sfxPercent = Math.round(this.audioManager.sfxVolume * 100);
        this.sfxSlider.value = sfxPercent;
        document.getElementById('sfx-value').textContent = sfxPercent + '%';
    }
    
    updateMuteButtonState() {
        const isMuted = this.audioManager.sfxVolume === 0 && (!this.audioManager.currentMusic || this.audioManager.currentMusic.volume === 0);
        
        if (isMuted) {
            this.masterMuteButton.textContent = '🔇 Unmute All';
            this.masterMuteButton.classList.add('muted');
        } else {
            this.masterMuteButton.textContent = '🔊 Mute All';
            this.masterMuteButton.classList.remove('muted');
        }
    }
    
    saveSettings() {
        const settings = {
            musicVolume: this.audioManager.musicVolume,
            sfxVolume: this.audioManager.sfxVolume,
            isMuted: this.audioManager.sfxVolume === 0
        };
        
        localStorage.setItem('tankGameSoundSettings', JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const saved = localStorage.getItem('tankGameSoundSettings');
            if (saved) {
                const settings = JSON.parse(saved);
                
                // Apply saved volumes
                if (settings.musicVolume !== undefined) {
                    this.audioManager.setMusicVolume(settings.musicVolume);
                }
                if (settings.sfxVolume !== undefined) {
                    this.audioManager.setSFXVolume(settings.sfxVolume);
                }
                
                // Update sliders to match
                this.updateSlidersFromAudioManager();
                this.updateMuteButtonState();
            }
        } catch (error) {
            console.warn('Could not load sound settings:', error);
        }
    }
}
