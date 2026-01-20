import { useWorkoutStore } from '../store/workoutStore';
import { AudioManager } from './AudioManager';

export function initAudioEngine() {
    const audioManager = AudioManager.getInstance();

    // 1. Load Assets (Placeholder for now)
    audioManager.loadAssets({
        'beep-low': 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg',
        'beep-high': 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg', // Duplicate for demo
        // Add more mapped assets here
    });

    // 2. Subscribe to Store Changes (Reset/Seek handling)
    useWorkoutStore.subscribe((state, prevState) => {
        // If we switched from running to anything else, or startTime changed (seek)
        if (
            (prevState.status === 'running' && state.status !== 'running') ||
            (state.startTime !== prevState.startTime)
        ) {
            console.log('🔄 Audio resync/stop triggered via Store change');
            audioManager.stopAll();
        }
    });

    // 3. The Sync Loop (Game Loop)
    const tick = () => {
        const { status, startTime, timeline } = useWorkoutStore.getState();

        if (status === 'running' && startTime !== null) {
            const now = Date.now();
            const elapsed = now - startTime;

            // Sync Audio
            audioManager.sync(timeline, elapsed);

            // Also tick the store if needed (optional, purely for UI updates if store doesn't have its own loop)
            // useWorkoutStore.getState().tick(now);
        }

        requestAnimationFrame(tick);
    };

    // Start the loop
    requestAnimationFrame(tick);
    console.log('🎧 Audio Engine Initialized');
}
