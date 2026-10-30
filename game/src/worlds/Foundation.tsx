import { SCRIPT } from '../content/script';
import { canSave } from '../systems/state';
import type { RuntimeSnapshot } from '../systems/runtime';

const formatNumber = (value: number) => Math.floor(value).toLocaleString('ja-JP');

export function Foundation({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const { state, offline } = snapshot;
  return (
    <main className="foundation">
      <p><b>目標</b>：{SCRIPT.goal}</p>
      <p>ピクセル: {formatNumber(state.resources.pixels)}</p>
      <p className="save-status">
        {canSave(state) && state.lastSavedAt !== null
          ? `保存しました ${new Date(state.lastSavedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          : SCRIPT.noSave}
      </p>
      {offline && <p role="status">留守の間に {offline.creditedMs < 60_000
        ? `${Math.floor(offline.creditedMs / 1_000)}秒`
        : `${Math.floor(offline.creditedMs / 60_000)}分`}ぶん作業しました（+{formatNumber(offline.pixels)}）</p>}
    </main>
  );
}
