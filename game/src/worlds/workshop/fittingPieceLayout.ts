import { BALANCE } from '../../config/balance';
import type { WorkshopRect } from '../../content/workshopCatalog';

/** Pack loose pieces without changing their socket dimensions. Large pieces grow the tray. */
export function fittingPieceTray(pieces:readonly {piece:string;width:number;height:number}[]) {
 const f=BALANCE.workshop.fitting,padding=8,heading=20,gap=f.tray.pieceGap;
 const width=Math.max(f.trayWidth,...pieces.map(piece=>piece.width+padding*2));
 const rects:Record<string,WorkshopRect>={};
 let x=padding,y=heading,rowHeight=0;
 for(const piece of pieces){
  if(x>padding&&x+piece.width>width-padding){x=padding;y+=rowHeight+gap;rowHeight=0;}
  rects[piece.piece]={x,y,width:piece.width,height:piece.height};
  x+=piece.width+gap;rowHeight=Math.max(rowHeight,piece.height);
 }
 return {width,height:Math.max(f.trayHeight,y+rowHeight+padding),rects};
}
