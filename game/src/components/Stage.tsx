import { useEffect, useState, type ReactNode } from 'react';
import { SCRIPT } from '../content/script';
import { fitViewport, VIEWPORT } from '../systems/viewport';

export function Stage({ children }: { children: ReactNode }) {
  const measure = () => fitViewport(window.innerWidth, window.innerHeight);
  const [viewport, setViewport] = useState(measure);
  useEffect(() => {
    const resize = () => setViewport(measure());
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return (
    <>
      <div className="stage-frame" style={{ width: viewport.width, height: viewport.height }}>
        <div className="stage" style={{ width: VIEWPORT.width, height: VIEWPORT.height, transform: `scale(${viewport.scale})` }}>
          {children}
        </div>
      </div>
      {viewport.narrow && <p className="screen-notice">{SCRIPT.narrowScreen}</p>}
    </>
  );
}
