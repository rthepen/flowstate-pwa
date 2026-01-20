import { AudioManager } from './core/audio/AudioManager';
import { useWorkoutStore } from './core/store/workoutStore';

function App() {
  const { status, timeline, start, pause, resume, reset } = useWorkoutStore();

  const handleStart = async () => {
    // CRITICAL: Unlock audio on user interaction
    await AudioManager.getInstance().unlock();
    start();
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🎧 Audio Engine Core (Mission Alpha)</h1>

      <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Status: {status.toUpperCase()}</h2>
        <p>Timeline Segments: {timeline.length}</p>

        <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
          {status === 'idle' && (
            <button onClick={handleStart} style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer' }}>
              ▶️ Start & Unlock Audio
            </button>
          )}

          {status === 'running' && (
            <button onClick={pause} style={{ padding: '10px 20px' }}>⏸️ Pause</button>
          )}

          {status === 'paused' && (
            <button onClick={resume} style={{ padding: '10px 20px' }}>▶️ Resume</button>
          )}

          <button onClick={reset} style={{ padding: '10px 20px' }}>⏹️ Reset</button>
        </div>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Debug Controls</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => AudioManager.getInstance().unlock()}>
            Force Audio Unlock
          </button>
          <button onClick={() => AudioManager.getInstance().playTestSound('sound-check')}>
            🔊 Test MP3 File
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
