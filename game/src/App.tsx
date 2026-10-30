import { useSyncExternalStore } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { Stage } from './components/Stage';
import { SCRIPT } from './content/script';
import type { GameRuntime } from './systems/runtime';
import { Foundation } from './worlds/Foundation';

export function App({ runtime, debug }: { runtime: GameRuntime; debug: boolean }) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  return (
    <>
      <Stage>
        {snapshot.status === 'starting' && <p className="system-message">読み込んでいます。</p>}
        {snapshot.status === 'blocked' && <p className="system-message" role="alert">{SCRIPT.otherTab}</p>}
        {snapshot.status === 'corrupt' && <div className="system-message" role="alert">
          <p>{SCRIPT.corruptSave}</p>
          <button onClick={() => { if (window.confirm(SCRIPT.confirmCorruptReset)) runtime.reset(); }}>新しく始める</button>
        </div>}
        {snapshot.status === 'ready' && <Foundation snapshot={snapshot} />}
        {snapshot.notice && <p className="runtime-notice" role="alert">{snapshot.notice}</p>}
      </Stage>
      {debug && snapshot.status === 'ready' && <DebugPanel runtime={runtime} snapshot={snapshot} />}
    </>
  );
}
