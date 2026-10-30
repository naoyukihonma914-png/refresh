export const VIEWPORT = { width: 1920, height: 1080, minWidth: 1280, minHeight: 720 } as const;

export function fitViewport(width: number, height: number) {
  const scale = Math.max(0, Math.min(width / VIEWPORT.width, height / VIEWPORT.height));
  return {
    scale,
    width: VIEWPORT.width * scale,
    height: VIEWPORT.height * scale,
    narrow: width < VIEWPORT.minWidth || height < VIEWPORT.minHeight || height > width,
  };
}
