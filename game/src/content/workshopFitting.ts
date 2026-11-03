import { WORKSHOP_PARTS, getWorkshopPart, type UiSetId, type WorkshopPartId } from './workshopCatalog';

/** The retired scrollbar descriptor remains readable in frozen products and captures. */
export const FITTING_PARTS = WORKSHOP_PARTS.filter(part => part.id !== 'common-scrollbar');
export const fittingPartsForSet = (set: UiSetId) => FITTING_PARTS.filter(part => part.set === set);
export interface FittingSocket { id: string; accepts: readonly string[]; stacked?: boolean }
export interface FittingDefinition { part: WorkshopPartId; pieces: readonly string[]; sockets: readonly FittingSocket[] }

export function fittingDefinition(id: WorkshopPartId): FittingDefinition {
  const pieces = id === 'common-frame'
    ? [...getWorkshopPart(id).elements, 'scrollbar']
    : [...getWorkshopPart(id).elements];
  if (id === 'common-frame') {
    const controls = ['minimize', 'maximize', 'close'];
    return { part: id, pieces, sockets: [
      { id: 'title', accepts: ['title'] },
      ...controls.map((_, index) => ({ id: `control-${index}`, accepts: controls })),
      { id: 'scrollbar', accepts: ['scrollbar'] },
    ] };
  }
  if (id === 'photo-switch') return { part: id, pieces, sockets: pieces.map((_, index) => ({ id: `navigation-${index}`, accepts: pieces })) };
  if (id === 'mail-unread' || id === 'terminal-run') return { part: id, pieces, sockets: [{ id: 'state', accepts: pieces, stacked: true }] };
  return { part: id, pieces, sockets: pieces.map(piece => ({ id: piece, accepts: [piece] })) };
}
