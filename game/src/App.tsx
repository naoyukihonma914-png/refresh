import { Desktop } from './worlds/Desktop';
import { useMemo, useSyncExternalStore } from 'react';
import { DebugPanel } from './components/DebugPanel';
import { Stage } from './components/Stage';
import { createI18n } from './content/i18n';
import type { GameRuntime } from './systems/runtime';
import { Foundation } from './worlds/Foundation';
import { Kumiki } from './worlds/Kumiki';
import { Intro } from './worlds/Intro';
import { Release } from './worlds/Release';

export function App({ runtime, debug }: { runtime: GameRuntime; debug: boolean }) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot);
  const i18n = useMemo(() => createI18n(snapshot.language, {numberNotation:snapshot.state.persistent.numberNotation}), [snapshot.language,snapshot.state.persistent.numberNotation]);
  return (
    <>
      <Stage platform={runtime.platform} i18n={i18n}>
        {snapshot.status === 'starting' && <p className="system-message">{i18n.t('system.loading')}</p>}
        {snapshot.status === 'blocked' && <div className="system-message" role="alert">
          <p>{i18n.t('system.otherTab')}</p>
          <button onClick={runtime.reload}>{i18n.t('system.reload')}</button>
        </div>}
        {snapshot.status === 'corrupt' && <div className="system-message" role="alert">
          <p>{i18n.t('save.corrupt')}</p>
          <button onClick={() => runtime.requestReset(true)}>{i18n.t('system.startNew')}</button>
        </div>}
        {snapshot.status === 'ready' && (snapshot.introVisible
          ? <Intro i18n={i18n} onStart={runtime.startGame} />
          : snapshot.state.run.world === 'release'
          ? <Release snapshot={snapshot} i18n={i18n} runtime={runtime} />
          : snapshot.state.run.world === 'desktop'
          ? <Desktop key={snapshot.state.createdAt} snapshot={snapshot} i18n={i18n} runtime={runtime} />
          : snapshot.state.run.world === 'kumiki'
          ? <Kumiki key={snapshot.state.createdAt} snapshot={snapshot} i18n={i18n} runtime={runtime} />
          : <Foundation snapshot={snapshot} i18n={i18n} runtime={runtime} />)}
        {snapshot.notice && <p className="runtime-notice" role="alert">{i18n.t(snapshot.notice)}</p>}
      </Stage>
      {debug && snapshot.status === 'ready' && <DebugPanel runtime={runtime} snapshot={snapshot} i18n={i18n} />}
    </>
  );
}
