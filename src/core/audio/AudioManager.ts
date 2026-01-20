import type { TimelineSegment } from '../types';

const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTSVMAAAAPAAADTGF2ZjU4LjIwLjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV//OEAAAAAAAAAAAAAAAAAAAAAAAAMGF1ZGlvL21wZwAAAABIAAAAAAAAAAAKQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//OECQAAAASBgAAAAAAAAAAAAAAJAAABAAAAAAAAAAAAAAJAAAAAAAAAAAAAA//OECQAAAAAAAAAAAAAAAAAAAAAJAAABAAAAAAAAAAAAAAJAAAAAAAAAAAAAA//OECQAAAAAAAAAAAAAAAAAAAAAJAAABAAAAAAAAAAAAAAJAAAAAAAAAAAAAA';

export class AudioManager {
    private static instance: AudioManager;
    private audioCtx: AudioContext;
    private buffers: Map<string, AudioBuffer>;
    private scheduledNodes: Set<AudioScheduledSourceNode>;
    private scheduledSegmentIds: Set<string>;
    private isUnlocked: boolean = false;
    private _silentNode: AudioBufferSourceNode | null = null;
    private htmlAudioElement: HTMLAudioElement | null = null;

    private constructor() {
        // Create context but it starts in 'suspended' state usually
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        this.buffers = new Map();
        this.scheduledNodes = new Set();
        this.scheduledSegmentIds = new Set();

        // --- HTML5 Audio Heartbeat (iOS Fix) ---
        this.htmlAudioElement = new Audio();
        this.htmlAudioElement.src = SILENT_MP3;
        this.htmlAudioElement.loop = true;
        this.htmlAudioElement.volume = 0.01; // Tiny volume just in case
        this.htmlAudioElement.setAttribute('playsinline', ''); // Critical for iOS
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * Resume the AudioContext. Must be called from a user interaction (click/tap).
     */
    public async unlock(): Promise<void> {
        if (this.isUnlocked) return;

        // Always resume the context first
        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        // --- HTML5 Audio Heartbeat (iOS Fix) ---
        // --- HTML5 Audio Heartbeat (iOS Fix) ---
        // Trigger generic HTML5 audio playback on user gesture
        if (this.htmlAudioElement) {
            // iOS HACK: Append to DOM to prevent garbage collection
            document.body.appendChild(this.htmlAudioElement);
            this.htmlAudioElement.style.position = 'absolute';
            this.htmlAudioElement.style.opacity = '0.001';
            this.htmlAudioElement.style.pointerEvents = 'none';

            this.htmlAudioElement.play().then(() => {
                console.log('❤️ Heartbeat attached to DOM and playing');
            }).catch(e => {
                console.warn('⚠️ HTML5 Audio Heartbeat failed:', e);
            });

            // iOS HACK: Force resume if paused by OS
            this.htmlAudioElement.addEventListener('pause', () => {
                console.log('⚠️ Heartbeat paused by OS - Forcing resume');
                this.htmlAudioElement?.play().catch(e => console.error('Force resume failed', e));
            });
        }

        // --- BACKGROUND SURVIVAL STRATEGY ---
        // 1. Init MediaSession to tell OS we are a media player
        this.initMediaSession();

        // 2. Start a Silent Loop to keep AudioContext processing
        if (!this._silentNode) {
            try {
                const buffer = this.audioCtx.createBuffer(1, this.audioCtx.sampleRate, this.audioCtx.sampleRate);
                // Fill with silence (it's already 0s by default, but to be sure)
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = 0;

                const node = this.audioCtx.createBufferSource();
                node.buffer = buffer;
                node.loop = true;
                node.connect(this.audioCtx.destination);
                node.start(0);
                this._silentNode = node;
                console.log('🔇 Slient Background Loop Started');
            } catch (e) {
                console.warn('⚠️ Failed to start background silent loop', e);
            }
        }

        // 3. Play Immediate Beep (Oscillator) - GUARANTEED FEEDBACK
        // This ensures the user hears *something* instantly while we try to load the MP3
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440; // A4
        gain.gain.value = 0.1;
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(0);
        osc.stop(this.audioCtx.currentTime + 0.1);

        console.log('🔊 Audio Engine Unlocked (Beep)', this.audioCtx.state);
        this.isUnlocked = true;

        // 4. Try to play "Sound Check" (MP3)
        // If not loaded, try to load it now
        const soundCheckId = 'sound-check';
        if (!this.buffers.has(soundCheckId)) {
            try {
                // Determine path (vite public folder)
                await this.loadSingleAsset(soundCheckId, '/sounds/sound_check.mp3');
            } catch (e) {
                console.warn('⚠️ Could not load sound_check.mp3, using beep only.');
            }
        }

        // If loaded (or just loaded), play it
        if (this.buffers.has(soundCheckId)) {
            // Play it slightly after the beep
            this.playBuffer(soundCheckId, this.audioCtx.currentTime + 0.15);
        }
    }

    private initMediaSession() {
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: "FlowState Workout",
                artist: "Ready to train",
                album: "FlowState PWA",
                artwork: [
                    { src: '/vite.svg', sizes: '512x512', type: 'image/svg+xml' }
                ]
            });

            const actionHandlers = [
                ['play', () => console.log('▶️ MediaSession Play')],
                ['pause', () => console.log('⏸️ MediaSession Pause')],
                ['stop', () => console.log('⏹️ MediaSession Stop')],
                ['previoustrack', () => { /* no-op */ }],
                ['nexttrack', () => { /* no-op */ }]
            ] as const;

            for (const [action, handler] of actionHandlers) {
                try {
                    navigator.mediaSession.setActionHandler(action as any, handler);
                } catch (error) {
                    console.warn(`MediaSession action ${action} not supported`);
                }
            }
            console.log("📻 MediaSession Initialized");
        }
    }

    private async loadSingleAsset(id: string, url: string): Promise<void> {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
        this.buffers.set(id, audioBuffer);
        console.log(`✅ Loaded audio asset: ${id}`);
    }

    /**
     * Load audio assets from a map of ID -> URL
     */
    public async loadAssets(manifest: Record<string, string>): Promise<void> {
        const promises = Object.entries(manifest).map(async ([id, url]) => {
            try {
                await this.loadSingleAsset(id, url);
            } catch (err) {
                console.error(`❌ Failed to load asset: ${id}`, err);
            }
        });

        await Promise.all(promises);
    }

    /**
     * Get the current precise hardware time
     */
    public get currentTime(): number {
        return this.audioCtx.currentTime;
    }

    /**
     * Stop all currently scheduled or playing nodes and clear scheduled tracking
     */
    public stopAll(): void {
        this.scheduledNodes.forEach(node => {
            try {
                node.stop();
                node.disconnect();
            } catch (e) {
                // Ignore if already stopped
            }
        });
        this.scheduledNodes.clear();
        this.scheduledSegmentIds.clear();
    }

    /**
     * The Heartbeat: Syncs audio schedule with the workout timer.
     * Call this every ~100ms-500ms from the game loop.
     * 
     * @param timeline - The full workout timeline
     * @param elapsedMs - The current workout time in milliseconds
     */
    public sync(timeline: TimelineSegment[], elapsedMs: number): void {
        const LOOKAHEAD_MS = 5000; // Schedule 5 seconds ahead
        const lookaheadEnd = elapsedMs + LOOKAHEAD_MS;

        // Find segments that start within the lookahead window
        const segmentsToSchedule = timeline.filter(segment => {
            return (
                segment.audioCue && // Has sound
                !this.scheduledSegmentIds.has(segment.id) && // Not yet scheduled
                segment.startTimeOffset >= elapsedMs && // Starts in future
                segment.startTimeOffset < lookaheadEnd // But soon
            );
        });

        segmentsToSchedule.forEach(segment => {
            const delayMs = segment.startTimeOffset - elapsedMs;
            // Convert to AudioContext time (seconds)
            // delayMs / 1000 is the delta from "now"
            // We add that to hardware currentTime
            const targetTime = this.audioCtx.currentTime + (delayMs / 1000);

            if (segment.audioCue) {
                this.playBuffer(segment.audioCue, targetTime);
                this.scheduledSegmentIds.add(segment.id);
            }
        });
    }

    /**
     * Public method to manually trigger a sound functionality.
     * Useful for testing without waiting for the timeline.
     */
    public playTestSound(assetId: string): void {
        this.playBuffer(assetId, this.audioCtx.currentTime);
    }

    private playBuffer(assetId: string, time: number): void {
        const buffer = this.buffers.get(assetId);

        if (!buffer) {
            console.warn(`⚠️ Audio asset not found: ${assetId} -> Playing Fallback`);
            this.playOscillatorFallback(time);
            return;
        }

        // Create buffer source
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);

        // Schedule
        source.start(time);

        // Track node to allow cancellation
        this.scheduledNodes.add(source);
        source.onended = () => {
            this.scheduledNodes.delete(source);
            source.disconnect();
        };

        console.log(`⏱️ Scheduled ${assetId} at ${time.toFixed(3)} (contextTime)`);
    }

    private playOscillatorFallback(time: number): void {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'square'; // Distinct from 'sine' so we know it's fallback
        osc.frequency.value = 880; // High beep
        gain.gain.value = 0.05;

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(time);
        osc.stop(time + 0.1);

        this.scheduledNodes.add(osc);
        osc.onended = () => {
            this.scheduledNodes.delete(osc);
            osc.disconnect();
            gain.disconnect();
        };

        console.log(`⚠️ Scheduled FALLBACK at ${time.toFixed(3)}`);
    }
}
