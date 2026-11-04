import { groupTool,toolLabel,type WorkshopToolId } from './workshopGroups';
import type { I18n, MessageKey } from './i18n';
import { appName } from '../systems/appearance';
import type { ProducerEntry } from '../systems/economy';
import type { GameState } from '../systems/state';

export function producerName(entry:ProducerEntry,state:GameState,i18n:I18n):string {
 if(entry.kind==='cursor')return i18n.t('manager.cursor');
 if(entry.kind==='job'&&entry.app)return i18n.t('jobs.menu',{app:appName(state,entry.app,i18n)});
 if(entry.kind==='app')return entry.app?appName(state,entry.app,i18n):i18n.t('manager.desktop');
 const source=entry.sourceIds[0]??entry.id;
 if(source.startsWith('tool:')){const id=source.split(':')[1] as WorkshopToolId;if(groupTool(id))return i18n.t(toolLabel(id) as MessageKey);}
 return i18n.t((source.startsWith('seed:')?`item.${source.slice('seed:'.length)}`:`ws.part.${source}`) as MessageKey);
}
