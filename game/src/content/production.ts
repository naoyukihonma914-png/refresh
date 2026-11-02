import type { I18n, MessageKey } from './i18n';
import { appName } from '../systems/appearance';
import type { ProducerEntry } from '../systems/economy';
import type { GameState } from '../systems/state';

export function producerName(entry:ProducerEntry,state:GameState,i18n:I18n):string {
 if(entry.kind==='cursor')return i18n.t('manager.cursor');
 if(entry.kind==='job'&&entry.app)return i18n.t('jobs.menu',{app:appName(state,entry.app,i18n)});
 if(entry.kind==='app')return entry.app?appName(state,entry.app,i18n):i18n.t('manager.desktop');
 const source=entry.sourceIds[0]??entry.id;
 return i18n.t((source.startsWith('seed:')?`item.${source.slice('seed:'.length)}`:`ws.part.${source}`) as MessageKey);
}
