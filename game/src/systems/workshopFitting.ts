import { BALANCE } from '../config/balance';
import { fittingDefinition, type FittingDefinition } from '../content/workshopFitting';
import { getWorkshopPart, type WorkshopPartId } from '../content/workshopCatalog';
import type { PartProduction } from './workshopState';

export interface PartFitting {
  /** Piece identity determines its behavior; the value determines its position. */
  sockets: Record<string, string>;
  spawned: string[];
  /** Payment history survives removal and rearrangement. */
  paid: string[];
  completionPaid: boolean;
  /** Previously paid placement credit is consumed before any new piece income. */
  prepaid?: number;
}
export const emptyFitting = (): PartFitting => ({ sockets: {}, spawned: [], paid: [], completionPaid: false });
export function fittedPieces(production: Pick<PartProduction,'elements'|'fitting'>, id: WorkshopPartId): string[] {
  if (!production.fitting) return [...production.elements];
  const definition = fittingDefinition(id);
  return definition.sockets.flatMap(socket => definition.pieces.filter(piece => production.fitting!.sockets[piece] === socket.id));
}
export const fittingComplete = (production: Pick<PartProduction,'elements'|'fitting'>, id: WorkshopPartId): boolean => fittingDefinition(id).pieces.every(piece => production.fitting ? Object.hasOwn(production.fitting.sockets, piece) : production.elements.includes(piece));
export function defaultPieceSocket(definition: FittingDefinition, fitting: PartFitting, piece: string): string | null {
  return definition.sockets.find(socket => socket.accepts.includes(piece) && (socket.stacked || !Object.entries(fitting.sockets).some(([other, seat]) => other !== piece && seat === socket.id)))?.id ?? null;
}
export function canFitPiece(id: WorkshopPartId, fitting: PartFitting, piece: string, seat: string): boolean {
  const definition = fittingDefinition(id), socket = definition.sockets.find(candidate => candidate.id === seat);
  return definition.pieces.includes(piece) && !!socket?.accepts.includes(piece)
    && (socket.stacked === true || !Object.entries(fitting.sockets).some(([other, value]) => other !== piece && value === seat));
}
export function isPartFitting(value: unknown, id: WorkshopPartId): value is PartFitting {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const f = value as PartFitting, definition = fittingDefinition(id);
  if (!f.sockets || typeof f.sockets !== 'object' || Array.isArray(f.sockets) || !Array.isArray(f.spawned) || !Array.isArray(f.paid) || typeof f.completionPaid !== 'boolean') return false;
  if (![f.spawned, f.paid].every(items => new Set(items).size === items.length && items.every(piece => definition.pieces.includes(piece)))) return false;
  if(!f.paid.every(piece=>f.spawned.includes(piece))||f.completionPaid&&!definition.pieces.every(piece=>f.paid.includes(piece)))return false;
  if(f.prepaid!==undefined&&(!Number.isFinite(f.prepaid)||f.prepaid<0||f.prepaid>BALANCE.workshop.fitting.pieceRewardTotals[getWorkshopPart(id).category]))return false;
  return Object.entries(f.sockets).every(([piece, socket]) => typeof socket === 'string' && f.spawned.includes(piece) && f.paid.includes(piece) && canFitPiece(id, f, piece, socket));
}
/** Convert only live works. Frozen documents and screenshots keep their historical representation. */
export function migrateFittingProduction(production: PartProduction, id: WorkshopPartId, now: number): PartProduction {
  if (production.fitting || id === 'common-scrollbar') return production;
  const definition = fittingDefinition(id), fitting = emptyFitting();
  for (const piece of production.elements) {
    if (!definition.pieces.includes(piece)) continue;
    const socket = defaultPieceSocket(definition, fitting, piece);
    if (socket) { fitting.sockets[piece] = socket; fitting.spawned.push(piece); fitting.paid.push(piece); }
  }
  // Existing completed frames already supplied working scrollbars through the old common material.
  if (id === 'common-frame' && production.step === 4) {
    fitting.sockets.scrollbar = 'scrollbar'; fitting.spawned.push('scrollbar'); fitting.paid.push('scrollbar');
  }
  const complete = definition.pieces.every(piece => Object.hasOwn(fitting.sockets, piece));
  const oldPaid=BALANCE.workshop.categoryStepRewards[getWorkshopPart(id).category].slice(0,production.step).reduce((sum,value)=>sum+value,0);
  const prepaid=Math.max(0,oldPaid-fitting.paid.length*pieceReward(id));
  if(prepaid>0)fitting.prepaid=prepaid;
  fitting.completionPaid = production.step === 4 || complete;
  return { ...production, fitting, elements: fittedPieces({ ...production, fitting }, id),
    step: production.step === 4 || complete ? 4 : 1,
    tested: production.step === 4 || complete,
    completedAt: production.completedAt ?? (complete ? now : null),
  };
}
export function pieceReward(id: WorkshopPartId): number {
  const category = getWorkshopPart(id).category;
  return BALANCE.workshop.fitting.pieceRewardTotals[category] / fittingDefinition(id).pieces.length;
}
