export const VIEWPORT = { width: 1920, height: 1080, minWidth: 1280, minHeight: 720 } as const;

export interface LogicalSize {width:number;height:number}
export function fitViewport(width: number, height: number, logical:LogicalSize=VIEWPORT) {
  const scale = Math.max(0, Math.min(width / logical.width, height / logical.height));
  return {
    scale,
    width: logical.width * scale,
    height: logical.height * scale,
    narrow: width < VIEWPORT.minWidth || height < VIEWPORT.minHeight || height > width,
  };
}
