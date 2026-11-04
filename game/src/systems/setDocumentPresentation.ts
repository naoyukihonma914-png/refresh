import { partsForSet } from '../content/workshopCatalog';
import { createEditorCustomization, createWorkshopState, type SetDocument } from './workshopState';

/** Read-only presentation values; no current inventory or gameplay state is reconstructed. */
export function setDocumentPresentation(document:SetDocument) {
 const first=partsForSet(document.set).find(part=>document.parts[part.id])?.id??null;
 return {
  customization:{...createEditorCustomization(),grid:false},
  workshop:{...createWorkshopState(),puzzleSet:document.set,entered:true,enteredAt:document.at,purchasedSets:[document.set],parts:document.parts,activePart:first},
 };
}
