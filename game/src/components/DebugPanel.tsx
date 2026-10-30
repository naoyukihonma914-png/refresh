import { useRef } from 'react';
import { BALANCE, type SpecKey } from '../config/balance';
import { SCRIPT } from '../content/script';
import type { GameRuntime, RuntimeSnapshot } from '../systems/runtime';
import { canSave } from '../systems/state';

export function DebugPanel({ runtime, snapshot }: { runtime: GameRuntime; snapshot: RuntimeSnapshot }) {
  const input = useRef<HTMLInputElement>(null);
  const download = () => {
    const url = URL.createObjectURL(new Blob([runtime.exportData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '画面の保存データ.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  return (
    <fieldset className="debug-panel">
      <legend>開発用・段階1</legend>
      {runtime.fixture && <p>固定状態（実際の保存データには影響しません）</p>}
      <p>状態・保存・時間・表示だけを確認します。</p>
      <div className="debug-actions">
        <button onClick={runtime.addDebugPixels}>ピクセルを足す</button>
        <button onClick={runtime.enableDebugSave} disabled={canSave(snapshot.state)}>保存済みの状態を試す</button>
        <button onClick={runtime.persist} disabled={!canSave(snapshot.state)}>いま保存する</button>
      </div>
      {(['color', 'refresh', 'storage'] as SpecKey[]).map(key => (
        <label key={key}>
          {({ color: '色深度', refresh: 'リフレッシュレート', storage: 'ストレージ' } as Partial<Record<SpecKey, string>>)[key]}
          <select value={snapshot.state.persistent.specs[key]} onChange={event => runtime.changeDebugSpec(key, Number(event.target.value))}>
            {BALANCE.spec[key].map((spec, index) => <option value={index} key={spec.name}>{spec.name}</option>)}
          </select>
        </label>
      ))}
      <div className="debug-actions">
        <button onClick={download}>データを書き出す</button>
        <button onClick={() => input.current?.click()}>データを読み込む</button>
        <button onClick={() => {
          if (window.confirm(SCRIPT.confirmReset) && window.confirm(SCRIPT.confirmResetAgain)) runtime.reset();
        }}>最初からやり直す</button>
      </div>
      <input ref={input} hidden type="file" accept=".json,application/json" onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file && window.confirm(SCRIPT.confirmImport)) runtime.importData(await file.text());
      }} />
    </fieldset>
  );
}
