import { BALANCE } from '../config/balance';

export const SET_IDS = ['common', 'foundation', 'files', 'mail', 'photo', 'bin', 'clock', 'theme', 'terminal', 'manager', 'extras', 'stream'] as const;
export type UiSetId = typeof SET_IDS[number];
export type PartCategory = 'small' | 'medium' | 'large';
export type TestInteraction = 'press' | 'slide' | 'scroll' | 'select' | 'toggle' | 'input' | 'resize';
export type PartKind = 'frame' | 'button' | 'heading' | 'progress' | 'list' | 'surface' | 'slider' | 'input' | 'toggle' | 'select' | 'timer' | 'calendar' | 'table' | 'tabs';
export interface WorkshopRect { x: number; y: number; width: number; height: number }
interface PartSeed { id: WorkshopPartId; kind: PartKind; elements: readonly string[]; testInteraction: TestInteraction; testAlternatives: readonly TestInteraction[]; category: PartCategory }
export type WorkshopPartId = keyof typeof BALANCE.workshop.partRates;
export interface WorkshopPartDefinition extends PartSeed { set: UiSetId; defaultRect: WorkshopRect; minSize: { width:number; height:number }; labelKey: string }

const make = (id: WorkshopPartId, kind: PartKind, elements: readonly string[], testInteraction: TestInteraction, category: PartCategory = 'medium'): PartSeed => ({ id, kind, elements, testInteraction, testAlternatives: testInteraction==='scroll'?['select']:[], category });
const definitions: Record<UiSetId, readonly PartSeed[]> = {
  common: [
    make('common-frame','frame',['title','minimize','maximize','close','track','thumb','arrows'],'press','large'),
    make('common-button','button',['label'],'press','small'),
    make('common-heading','heading',['label','separator'],'select','small'),
    make('common-progress','progress',['track','fill','percent'],'select','small'),
  ],
  foundation: [
    make('foundation-taskbar','surface',['app-slots','resource-area'],'select','large'),
    make('foundation-desktop','surface',['surface','selection'],'select','large'),
    make('foundation-icons','list',['icon','caption'],'select'),
    make('foundation-notification','surface',['message','action'],'press'),
    make('foundation-wallpaper','surface',['image','fit'],'select'),
    make('foundation-upgrades','list',['item','price','purchase'],'press'),
  ],
  files: [
    make('files-list','list',['rows','columns'],'scroll','large'),
    make('files-back','button',['back','label'],'press','small'),
    make('files-sort','select',['sort-key','direction'],'select'),
    make('files-search','input',['query','search'],'input'),
    make('files-large','toggle',['icon','caption'],'toggle'),
    make('files-storage','progress',['used','capacity'],'select','small'),
  ],
  mail: [
    make('mail-list','list',['sender','subject','date'],'scroll','large'),
    make('mail-body','surface',['subject','body'],'scroll','large'),
    make('mail-reply','button',['reply','draft'],'press','small'),
    make('mail-folders','list',['inbox','archive'],'select'),
    make('mail-unread','toggle',['unread','read'],'toggle','small'),
  ],
  photo: [
    make('photo-display','surface',['image','fit'],'select','large'),
    make('photo-brightness','slider',['track','thumb','value'],'slide'),
    make('photo-tone','slider',['track','thumb','value'],'slide'),
    make('photo-wallpaper','button',['image','apply'],'press','small'),
    make('photo-crop','surface',['image','crop-frame'],'resize','large'),
    make('photo-compare','toggle',['before','after'],'toggle'),
    make('photo-switch','select',['previous','next'],'select','small'),
  ],
  bin: [make('bin-list','list',['item','date'],'scroll'),make('bin-undo','button',['item','restore'],'press','small'),make('bin-empty','button',['count','empty'],'press','small')],
  clock: [make('clock-time','surface',['hours','minutes','seconds'],'select','small'),make('clock-timer','timer',['duration','start'],'press'),make('clock-calendar','calendar',['month','days'],'select')],
  theme: [make('theme-mode','toggle',['light','dark'],'toggle'),make('theme-accent','select',['palette','sample'],'select'),make('theme-radius','slider',['track','thumb','sample'],'slide'),make('theme-slideshow','toggle',['images','interval'],'toggle'),make('theme-icons','slider',['track','thumb','icon'],'slide')],
  terminal: [make('terminal-output','surface',['prompt','output'],'scroll','large'),make('terminal-commands','list',['command','description'],'select','large'),make('terminal-interval','select',['interval','unit'],'select'),make('terminal-run','button',['run','stop'],'press'),make('terminal-history','list',['command','result'],'scroll')],
  manager: [make('manager-processes','table',['process','rate','share'],'scroll'),make('manager-performance','surface',['specs','values'],'select')],
  extras: [make('plugin-tabs','tabs',['tab','page'],'select','small'),make('plugin-table','table',['time','pixels'],'scroll','small')],
  stream: [
    make('stream-preview','surface',['source','image'],'select','large'),
    make('stream-sources','select',['source','selection'],'select'),
    make('stream-scenes','tabs',['scene','preview'],'select'),
    make('stream-comments','list',['message','selection'],'scroll'),
  ],
};

export const UI_SETS = SET_IDS.map(id => ({ id, labelKey: `ws.set.${id}`, mainline: ['common','foundation','files','mail'].includes(id), parts: definitions[id].map(p => p.id) }));
const placement = BALANCE.workshop.defaultPlacement;
export const WORKSHOP_PARTS: readonly WorkshopPartDefinition[] = SET_IDS.flatMap(set => definitions[set].map((part, i) => ({
  ...part, set, minSize: BALANCE.workshop.partMinSizes[part.kind], labelKey: `ws.part.${part.id}`,
  // Each set has an independent, real-size target window. Safe defaults leave room for every part.
  defaultRect: part.id==='common-frame'?{x:BALANCE.workshop.canvas.inset,y:BALANCE.workshop.canvas.inset,width:BALANCE.workshop.canvas.width-BALANCE.workshop.canvas.inset*2,height:BALANCE.workshop.canvas.height-BALANCE.workshop.canvas.inset*2}:(BALANCE.workshop.layouts as Partial<Record<WorkshopPartId,WorkshopRect>>)[part.id]??{ x: placement.x + i % placement.columns * placement.columnStep, y: placement.y + Math.floor(i / placement.columns) * placement.rowStep, width: placement.width, height: placement.height },
})));
export const getWorkshopPart = (id: WorkshopPartId): WorkshopPartDefinition => WORKSHOP_PARTS.find(part => part.id === id)!;
export const partsForSet = (set: UiSetId): readonly WorkshopPartDefinition[] => WORKSHOP_PARTS.filter(part => part.set === set);
