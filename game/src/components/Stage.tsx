import { useEffect, useState, type ReactNode } from 'react';
import type { I18n } from '../content/i18n';
import type { Platform } from '../platform/types';
import { fitViewport, VIEWPORT } from '../systems/viewport';

export function Stage({ children, platform, i18n }: { children: ReactNode; platform: Platform; i18n: I18n }) {
  const measure = () => {
    const { width, height } = platform.viewport.size();
    return fitViewport(width, height);
  };
  const [viewport, setViewport] = useState(measure);
  useEffect(() => {
    const resize = () => setViewport(measure());
    return platform.viewport.subscribe(resize);
  }, [platform]);
  return (
    <>
      <div className="stage-frame" style={{ width: viewport.width, height: viewport.height }}>
        <div className="stage" style={{ width: VIEWPORT.width, height: VIEWPORT.height, transform: `scale(${viewport.scale})` }}>
          {children}
        </div>
      </div>
      {viewport.narrow && <p className="screen-notice">{i18n.t('system.narrowScreen')}</p>}
    </>
  );
}
