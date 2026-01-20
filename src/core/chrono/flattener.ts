import type { WorkoutDef, TimelineSegment, Exercise, WorkoutBlock, ExerciseBlock, RestBlock } from '../types';

/**
 * Flattens a structural Workout Definition into a linear Timeline.
 * Unrolls rounds and calculates absolute start times.
 * 
 * @param workout Defines the structure of the workout (rounds, sets, etc)
 * @param exerciseMap A lookup map of all available exercises by ID
 * @returns A flat array of timeline segments ready for the Chrono Engine
 */
export function flattenWorkout(
    workout: WorkoutDef,
    exerciseMap: Record<string, Exercise>
): TimelineSegment[] {
    const timeline: TimelineSegment[] = [];
    let currentTimeOffset = 0;

    // Add a global prep time? For now, we'll start at 0 or let the caller prepend.
    // Let's iterate the blocks.

    function processBlock(block: WorkoutBlock) {
        if (block.type === 'exercise') {
            const exerciseBlock = block as ExerciseBlock;
            const exercise = exerciseMap[exerciseBlock.exerciseId];
            if (!exercise) {
                console.warn(`Exercise ID ${exerciseBlock.exerciseId} not found in map.`);
            }

            timeline.push({
                id: crypto.randomUUID(),
                startTimeOffset: currentTimeOffset,
                duration: exerciseBlock.duration * 1000, // convert seconds to ms
                type: 'work',
                exercise: exercise,
                audioCue: 'start-work', // Default cue, logic can be more complex later
            });
            currentTimeOffset += (exerciseBlock.duration * 1000);

        } else if (block.type === 'rest') {
            const restBlock = block as RestBlock;
            timeline.push({
                id: crypto.randomUUID(),
                startTimeOffset: currentTimeOffset,
                duration: restBlock.duration * 1000,
                type: 'rest',
                audioCue: 'start-rest',
            });
            currentTimeOffset += (restBlock.duration * 1000);

        } else if (block.type === 'round') {
            // Unroll the round
            const roundBlock = block as any; // Cast to access properties safely if TS complains
            // Re-typing slightly for safety inside function, though BlockType check should suffice if discriminated union is perfect.
            // In types.ts: RoundBlock has rounds: number, blocks: (ExerciseBlock | RestBlock)[]

            for (let r = 0; r < roundBlock.rounds; r++) {
                roundBlock.blocks.forEach((subBlock: WorkoutBlock) => {
                    processBlock(subBlock);
                });
            }
        }
    }

    workout.blocks.forEach(block => {
        processBlock(block);
    });

    // Add a cooldown or finish segment?
    // User didn't strictly request it in types, but useful for the "finished" state.
    // For now, pure translation.

    return timeline;
}
