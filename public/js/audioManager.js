export class AudioManager {
    constructor() {
        this.sounds = {};
        this.musicVolume = 0.3;
        this.sfxVolume = 0.7;
        this.currentMusic = null;
        this.isInitialized = false;
        this.continuousSounds = {}; // Track playing continuous sounds
        this.mutedSFXVolume = null; // Track SFX volume when muted
        
        // Load all sounds
        this.loadSounds();
    }    async loadSounds() {
        const soundFiles = {
            click: './assets/sounds/click.mp3',
            openingScreen: './assets/sounds/OpeningTune2.mp3',
            gameplayBg: './assets/sounds/OpeningTune.mp3', // Reuse opening tune for background music
            enterTank: './assets/sounds/EnterTank.mp3',
            exitTank: './assets/sounds/ExitTank.mp3',
            turretRotate: './assets/sounds/TurrentRotate.mp3',
            tankMove: './assets/sounds/TankMove.mp3',
            shoot: './assets/sounds/shoot.mp3',
            tankHit: './assets/sounds/HitTank.mp3',
            explosion: './assets/sounds/KaBoom.mp3',
            groundHit: './assets/sounds/HitGround.mp3',
            hitBuilding: './assets/sounds/HitBuilding.mp3',
            hitTree: './assets/sounds/HitTree.mp3'
        };
        
        // Track which audio objects we've already loaded for each path
        const pathToAudio = new Map();
        
        try {
            for (const [name, path] of Object.entries(soundFiles)) {
                // Check if we already have an audio object for this path
                if (pathToAudio.has(path)) {
                    // Reuse the existing audio object
                    this.sounds[name] = pathToAudio.get(path);
                    console.log(`Sound reused: ${name} -> same audio object as path ${path}`);
                } else {
                    // Load new audio object
                    await this.loadSound(name, path);
                    // Store the audio object for reuse
                    pathToAudio.set(path, this.sounds[name]);
                }
            }
            console.log('All sounds loaded successfully');
            this.isInitialized = true;
        } catch (error) {
            console.warn('Some sounds failed to load:', error);
            this.isInitialized = true; // Continue even if sounds fail to load
        }
    }
    
    loadSound(name, path) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(path);
            
            audio.addEventListener('canplaythrough', () => {
                this.sounds[name] = audio;
                console.log(`Sound loaded: ${name}`);
                resolve();
            });
            
            audio.addEventListener('error', (e) => {
                console.warn(`Failed to load sound: ${name} from ${path}`, e);
                // Create a silent audio object as fallback
                this.sounds[name] = {
                    play: () => {},
                    pause: () => {},
                    currentTime: 0,
                    volume: 0,
                    loop: false
                };
                resolve(); // Don't reject to allow game to continue
            });
            
            // Preload the audio
            audio.preload = 'auto';
            audio.load();
        });
    }
      // Initialize audio context (required for autoplay policies)
    async initializeAudioContext() {
        if (this.audioContext || this.isAudioContextInitialized) return;
        
        try {
            // Create audio context to comply with browser autoplay policies
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            this.isAudioContextInitialized = true;
            console.log('Audio context initialized, state:', this.audioContext.state);
            
            // On mobile, we need to ensure audio can play
            // Test if we can play a silent sound
            this.testMobileAudio();
            
        } catch (error) {
            console.warn('Could not initialize audio context:', error);
        }
    }
    
    // Test mobile audio capabilities
    testMobileAudio() {
        if (this.isMobileDevice()) {
            console.log('Mobile device detected, testing audio capabilities');
            
            // Create a brief silent audio to unlock audio on mobile
            const testAudio = new Audio();
            testAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAEAABAAARAAEAIlUAAAAAAAgAAAFmYWN0BAAAAAAAAABkYXRhAAAAAA==';
            testAudio.volume = 0;
            
            const playPromise = testAudio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log('Mobile audio unlocked successfully');
                    testAudio.pause();
                }).catch(error => {
                    console.warn('Mobile audio unlock failed:', error);
                });
            }
        }
    }
    
    // Detect if running on mobile device
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0);
    }    // Play background music (loops)
    playMusic(soundName, fadeIn = true) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`Music not found: ${soundName}`);
            return;
        }
        
        const audio = this.sounds[soundName];
        
        // Check if the same audio object is already playing
        if (this.currentMusic && this.currentMusic === audio && !this.currentMusic.paused) {
            console.log(`Audio object for ${soundName} is already playing, not restarting`);
            // But ensure volume is correct in case it was changed
            this.currentMusic.volume = this.musicVolume;
            return;
        }
        
        // Stop current music
        this.stopMusic();
        
        audio.volume = fadeIn ? 0 : this.musicVolume;
        audio.loop = true;
        audio.currentTime = 0;
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.currentMusic = audio;
                    
                    // Fade in effect
                    if (fadeIn) {
                        this.fadeIn(audio, this.musicVolume, 2000);
                    }
                }).catch(error => {
                    console.warn('Music playback failed:', error);
                });
            }
        } catch (error) {
            console.warn('Could not play music:', error);
        }
    }
      // Stop background music
    stopMusic(fadeOut = true) {
        if (this.currentMusic) {
            if (fadeOut) {
                const musicToStop = this.currentMusic;
                this.currentMusic = null; // Clear reference immediately
                this.fadeOut(musicToStop, 1000, () => {
                    if (musicToStop) {
                        musicToStop.pause();
                        musicToStop.currentTime = 0;
                    }
                });
            } else {
                this.currentMusic.pause();
                this.currentMusic.currentTime = 0;
                this.currentMusic = null;
            }
        }
    }

    // Alias for stopMusic to maintain compatibility
    stopAllMusic(fadeOut = true) {
        this.stopMusic(fadeOut);
    }
    
    // Play sound effect (one-shot)
    playSFX(soundName, volume = null) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`SFX not found: ${soundName}`);
            return;
        }
        
        const audio = this.sounds[soundName].cloneNode ? 
                     this.sounds[soundName].cloneNode() : 
                     this.sounds[soundName];
        
        audio.volume = volume !== null ? volume : this.sfxVolume;
        audio.loop = false;
        audio.currentTime = 0;
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.warn(`SFX playback failed for ${soundName}:`, error);
                });
            }
        } catch (error) {
            console.warn('Could not play SFX:', error);
        }
    }

    // Alias for playSFX to maintain compatibility
    playSound(soundName, volume = null) {
        this.playSFX(soundName, volume);    }

    // Play continuous sound (loops until stopped)
    playContinuousSound(soundName, volume = null) {
        if (!this.isInitialized || !this.sounds[soundName]) {
            console.warn(`Continuous sound not found: ${soundName}`);
            return;
        }

        // If already playing, don't restart
        if (this.isContinuousSoundPlaying(soundName)) {
            console.log(`DEBUG: Continuous sound ${soundName} already playing, skipping`);
            return;
        }

        console.log(`DEBUG: Playing continuous sound: ${soundName}`);

        const audio = this.sounds[soundName].cloneNode ? 
                     this.sounds[soundName].cloneNode() : 
                     this.sounds[soundName];
        
        audio.volume = volume !== null ? volume : this.sfxVolume;
        audio.loop = true;
        audio.currentTime = 0;
          // Add to continuousSounds before playing
        this.continuousSounds[soundName] = audio;
        
        // Add event listener for when sound ends unexpectedly
        audio.addEventListener('ended', () => {
            console.log(`DEBUG: Continuous sound ${soundName} ended unexpectedly`);
            delete this.continuousSounds[soundName];
        });
        
        try {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Check if the sound is still in our continuousSounds (not stopped while loading)
                    if (this.continuousSounds[soundName] === audio) {
                        console.log(`DEBUG: Successfully started continuous sound: ${soundName}`);
                    }
                }).catch(error => {
                    console.warn(`Continuous sound playback failed for ${soundName}:`, error);
                    // Only remove if it's still our audio instance
                    if (this.continuousSounds[soundName] === audio) {
                        delete this.continuousSounds[soundName];
                    }
                });
            } else {
                console.log(`DEBUG: Successfully started continuous sound (no promise): ${soundName}`);
            }
        } catch (error) {
            console.warn(`Error playing continuous sound ${soundName}:`, error);
            // Only remove if it's still our audio instance
            if (this.continuousSounds[soundName] === audio) {
                delete this.continuousSounds[soundName];
            }
        }    }

    // Stop specific continuous sound
    stopContinuousSound(soundName) {
        console.log(`DEBUG: Attempting to stop continuous sound: ${soundName}`);
        if (this.continuousSounds[soundName]) {
            console.log(`DEBUG: Found sound ${soundName}, stopping it`);
            const audio = this.continuousSounds[soundName];
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (error) {
                console.warn(`Error stopping continuous sound ${soundName}:`, error);
            }
            delete this.continuousSounds[soundName];
            console.log(`DEBUG: Successfully stopped ${soundName}`);
        } else {
            console.log(`DEBUG: Sound ${soundName} not found in continuousSounds:`, Object.keys(this.continuousSounds));
        }
    }

    // Stop all continuous sounds
    stopAllContinuousSounds() {
        for (const soundName in this.continuousSounds) {
            this.stopContinuousSound(soundName);
        }
    }

    // Check if a continuous sound is playing
    isContinuousSoundPlaying(soundName) {
        return !!this.continuousSounds[soundName];
    }
      // Fade in audio
    fadeIn(audio, targetVolume, duration) {
        if (!audio) return;
        
        const steps = 50;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            if (audio) {
                audio.volume = Math.min(volumeStep * currentStep, targetVolume);
            }
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
            }
        }, stepTime);
    }
      // Fade out audio
    fadeOut(audio, duration, callback) {
        if (!audio) {
            if (callback) callback();
            return;
        }
        
        const steps = 50;
        const stepTime = duration / steps;
        const startVolume = audio.volume;
        const volumeStep = startVolume / steps;
        let currentStep = 0;
        
        const fadeInterval = setInterval(() => {
            currentStep++;
            if (audio) {
                audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0);
            }
            
            if (currentStep >= steps) {
                clearInterval(fadeInterval);
                if (callback) callback();
            }
        }, stepTime);
    }    // Set volume levels
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        
        // Ensure audio context is active on mobile
        this.ensureAudioContextActive();
        
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
    }
      setSFXVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        
        // Ensure audio context is active on mobile
        this.ensureAudioContextActive();
        
        // Update volume of any currently playing continuous sounds
        for (const soundName in this.continuousSounds) {
            const audio = this.continuousSounds[soundName];
            if (audio && audio.volume !== undefined) {
                audio.volume = this.sfxVolume;
            }
        }
    }
    
    // Ensure audio context is active (important for mobile)
    ensureAudioContextActive() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            console.log('Resuming suspended audio context');
            this.audioContext.resume().catch(error => {
                console.warn('Could not resume audio context:', error);
            });
        }
    }
    
    // Mute/unmute
    muteMusic() {
        if (this.currentMusic) {
            this.currentMusic.volume = 0;
        }
    }
    
    unmuteMusic() {
        if (this.currentMusic) {
            this.currentMusic.volume = this.musicVolume;
        }
    }
    
    // Check if music is currently playing
    isMusicPlaying() {
        return this.currentMusic && !this.currentMusic.paused;
    }

    // Global mute/unmute all sounds
    muteAll() {
        this.muteMusic();
        this.mutedSFXVolume = this.sfxVolume;
        this.sfxVolume = 0;
        
        // Mute all continuous sounds
        for (const soundName in this.continuousSounds) {
            const audio = this.continuousSounds[soundName];
            if (audio && audio.volume !== undefined) {
                audio.volume = 0;
            }
        }
    }

    unmuteAll() {
        this.unmuteMusic();
        if (this.mutedSFXVolume !== undefined) {
            this.sfxVolume = this.mutedSFXVolume;
            delete this.mutedSFXVolume;
        }
        
        // Restore continuous sounds volume
        for (const soundName in this.continuousSounds) {
            const audio = this.continuousSounds[soundName];
            if (audio && audio.volume !== undefined) {
                audio.volume = this.sfxVolume;
            }
        }
    }

    // Check if a sound is available and loaded
    isSoundAvailable(soundName) {
        return this.isInitialized && 
               this.sounds[soundName] && 
               typeof this.sounds[soundName].play === 'function';
    }

    // Get sound info for debugging
    getSoundInfo() {
        const info = {
            initialized: this.isInitialized,
            musicVolume: this.musicVolume,
            sfxVolume: this.sfxVolume,
            currentMusic: this.currentMusic ? 'playing' : 'none',
            continuousSounds: Object.keys(this.continuousSounds),
            loadedSounds: Object.keys(this.sounds)
        };
        return info;
    }

    // Cleanup method for when the game ends
    cleanup() {
        this.stopAllMusic(false);
        this.stopAllContinuousSounds();
        
        // Clear intervals if any are running
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }
    }

    // Play enterTank sound (when starting game or switching tanks)
    playEnterTankSound() {
        this.playSFX('enterTank', 0.6);
    }

    // Play exitTank sound (when game ends or tank is destroyed)  
    playExitTankSound() {
        this.playSFX('exitTank', 0.6);
    }
}
