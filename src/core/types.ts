/**
 * Core Data Models
 */

// 1. Static Data (From Database)
export interface Exercise {
    id: string;
    name: string;          // Maps to 'exercise_name'
    category: string;
    material: string;      // Maps to 'material_name'
    description?: string;  // Maps to 'material_description' if needed, or generic description
    instructions: string;
    videoUrl?: string;     // Maps to 'video_search_url'
    thumbnailUrl?: string; // Maps to 'thumbnail'
}

// 2. Workout Definitions (High-Level Plan)
export type BlockType = 'exercise' | 'rest' | 'round';

export interface BaseBlock {
    type: BlockType;
}

export interface ExerciseBlock extends BaseBlock {
    type: 'exercise';
    exerciseId: string;
    duration: number; // in seconds
}

export interface RestBlock extends BaseBlock {
    type: 'rest';
    duration: number; // in seconds
}

export interface RoundBlock extends BaseBlock {
    type: 'round';
    rounds: number;
    blocks: (ExerciseBlock | RestBlock)[];
}

export type WorkoutBlock = ExerciseBlock | RestBlock | RoundBlock;

export interface WorkoutDef {
    id: string;
    name: string;
    blocks: WorkoutBlock[];
}

// 3. Chrono Engine Models (Runtime)
export type SegmentType = 'work' | 'rest' | 'prep' | 'cooldown';

export interface TimelineSegment {
    id: string;             // Unique ID for this specific segment instance
    startTimeOffset: number; // Milliseconds from workout start
    duration: number;        // Milliseconds
    type: SegmentType;
    exercise?: Exercise;     // Populated if type === 'work'
    audioCue?: string;       // ID of audio asset to play at start
}
