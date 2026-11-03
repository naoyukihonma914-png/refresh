import type {I18n} from '../content/i18n';
import {nextSeedHand} from '../systems/nextHand';
import type {GameState} from '../systems/state';

export function SeedNextHand({state,i18n,bare=false}:{state:GameState;i18n:I18n;bare?:boolean}) {
 const next=nextSeedHand(state);if(!next)return null;
 const text=next.kind==='seed-launch'?i18n.t('examples.seed.launch'):next.kind==='seed-fit'?i18n.t('examples.seed.fit',{name:i18n.t(`page.part.${next.part}`)}):i18n.t(next.kind==='seed-generate'?'examples.seed.generate':'examples.seed.buy',{pixels:i18n.pixels(Math.ceil(next.missing)),item:i18n.t(`item.${next.item}`)});
 return <section className="seed-next-hand" data-example-next={next.kind} data-example-item={'item' in next?next.item:undefined}>{!bare&&<h2>{i18n.t('examples.next')}</h2>}<p>{text}</p></section>;
}
