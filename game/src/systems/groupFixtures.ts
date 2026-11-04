import { BALANCE } from '../config/balance';
import { GROUP_IDS, groupTool, type WorkshopToolId } from '../content/workshopGroups';
import { createInitialState } from './state';
import { actWorkshop, enterWorkshop } from './workshop';
export const GROUP_FIXTURE_NAMES=['group-entry-era0','group-entry-era1','group-owned-era0','group-owned-era1','group-catalog-era0','group-catalog-era1'] as const;
export function createGroupFixture(name:string,now:number){
 if(!(GROUP_FIXTURE_NAMES as readonly string[]).includes(name))return null;
 let s=createInitialState(now),era=name.endsWith('1')?1:0;
 s.run.seed.built=BALANCE.w1.items.map(item=>item.id);s.run.seed.autoCursors=8;
 s.resources.pixels=s.run.totalPixelsGenerated=name.includes('catalog')?1e12:1_000_000;
 s.persistent.editorSkills=era?['update']:[];s.persistent.appearance.editor=era as 0|1;if(era)s.persistent.specs.color=BALANCE.release.prototypeColorLevel;
 s=enterWorkshop(s);s.run.workshop.enterMs=0;s.run.workshop.guide.current=null;s.run.workshop.guide.collapsed=true;
 if(!name.includes('entry'))s=actWorkshop(s,{type:'groupBuy',group:'required'},now);
 if(name.includes('catalog')){
  s.persistent.editorSkills=[...new Set([...s.persistent.editorSkills,'extraParts' as const])];
  for(const id of ['files','mail'] as WorkshopToolId[]){
   const tool=groupTool(id);s=actWorkshop(s,{type:'groupPlace',tool:id,at:s.run.workshop.groupPuzzle!.tools[id]!.positions[tool.base]!.at},now);
   for(const piece of tool.pieces.filter(piece=>piece.id!==tool.base))s=actWorkshop(s,{type:'groupFit',tool:id,piece:piece.id},now);
  }
  for(const group of GROUP_IDS.filter(group=>group!=='required'&&group!=='stream'))s=actWorkshop(s,{type:'groupBuy',group},now);
  s=actWorkshop(s,{type:'groupSelect',group:'photo'},now);
 }
 return s;
}
