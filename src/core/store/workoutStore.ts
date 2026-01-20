import { create } from 'zustand';
import type { TimelineSegment, WorkoutDef, Exercise } from '../types';
import { flattenWorkout } from '../chrono/flattener';

export type WorkoutStatus = 'idle' | 'running' | 'paused' | 'completed';

interface WorkoutState {
    timeline: TimelineSegment[];
    status: WorkoutStatus;
    startTime: number | null; // Timestamp when 'running' started (adjusted for pauses)
    currentSegmentIndex: number;

    // Computed/Derived helpers could be here or selectors

    // Actions
    loadWorkout: (def: WorkoutDef, exerciseMap: Record<string, Exercise>) => void;
    start: () => void;
    pause: () => void;
    resume: () => void;
    reset: () => void;
    tick: (now: number) => void; // Optional, to update progress manually if not using a hook-based timer
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
    timeline: [],
    status: 'idle',
    startTime: null,
    currentSegmentIndex: 0,

    loadWorkout: (def, exerciseMap) => {
        const segments = flattenWorkout(def, exerciseMap);
        set({
            timeline: segments,
            status: 'idle',
            currentSegmentIndex: 0,
            startTime: null
        });
    },

    start: () => {
        const { status } = get();
        if (status === 'idle') {
            set({
                status: 'running',
                startTime: Date.now()
            });
        }
    },

    pause: () => {
        set({ status: 'paused' });
        // Logic for pausing: we need to freeze the "elapsed" time? 
        // In a real chrono engine, "startTime" usually shifts when resuming.
        // For now, simple status flag.
    },

    resume: () => {
        set({ status: 'running' });
        // If we were paused, we need to adjust startTime so that the "gap" is ignored.
        // This is complex logic for a robust timer. 
        // For this task, we define *Interfaces* and *Store Structure*.
        // I will leave a TODO for the robust ticker implementation.
    },

    reset: () => {
        set({
            status: 'idle',
            currentSegmentIndex: 0,
            startTime: null
        });
    },

    tick: (_now: number) => {
        // Implementation of segment transition logic would go here
        // checking if (now - startTime) > segment.end
    }
}));
