import type { TimelineSegment } from '../types';

export class AudioManager {
    private static instance: AudioManager;
    private audioCtx: AudioContext;
    private buffers: Map<string, AudioBuffer>;
    private scheduledNodes: Set<AudioScheduledSourceNode>;
    private isUnlocked: boolean = false;

    private constructor() {
        // Create context but it starts in 'suspended' state usually
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        this.buffers = new Map();
        this.scheduledNodes = new Set();
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
        if (this.isUnlocked && this.audioCtx.state === 'running') return;

        if (this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
        }

        // Play a silent buffer to fully wake up the audio thread on iOS
        const buffer = this.audioCtx.createBuffer(1, 1, 22050);
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);

        this.isUnlocked = true;
        console.log('🔊 Audio Engine Unlocked', this.audioCtx.state);
    }

    /**
     * Load audio assets from a map of ID -> URL
     */
    public async loadAssets(manifest: Record<string, string>): Promise<void> {
        const promises = Object.entries(manifest).map(async ([id, url]) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                this.buffers.set(id, audioBuffer);
                console.log(`✅ Loaded audio asset: ${id}`);
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

    private scheduledSegmentIds: Set<string> = new Set();

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

    private playBuffer(assetId: string, time: number): void {
        const buffer = this.buffers.get(assetId);
        if (!buffer) {
            console.warn(`⚠️ Audio asset not found: ${assetId}`);
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
}
