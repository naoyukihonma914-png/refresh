import type { I18n, MessageKey } from '../content/i18n';
import type { AdviceId, AdviceState } from '../systems/advice';

interface Props { memory: AdviceState; i18n: I18n; app: string; onRead: (id: AdviceId | null) => void }

/** Place inside the world's paragraph, editor comment, or mail notification. */
export function AdviceMessage({ memory, i18n, app, onRead }: Props) {
  if (!memory.current) return null;
  return <div className="advice-message" role="status" data-advice={memory.current}>
    <p>{i18n.t(`advice.${memory.current}` as MessageKey, { app })}</p>
    <button onClick={() => onRead(null)}>{i18n.t('guide.close')}</button>
  </div>;
}

export function AdviceHistory({ memory, i18n, app, onRead }: Props) {
  if (!memory.seen.length) return null;
  return <details className="advice-history"><summary>{i18n.t('advice.history' as MessageKey)}</summary>
    <ul>{memory.seen.map(id => <li key={id}><button onClick={() => onRead(id)}>{i18n.t(`advice.${id}` as MessageKey, { app })}</button></li>)}</ul>
  </details>;
}
