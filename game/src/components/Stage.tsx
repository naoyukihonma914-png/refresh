import { useEffect, useState, type ReactNode } from 'react';
import type { I18n } from '../content/i18n';
import type { Platform } from '../platform/types';
import { fitViewport, VIEWPORT, type LogicalSize } from '../systems/viewport';

export function Stage({ children, platform, i18n, logical=VIEWPORT,desktop=false }: { children: ReactNode; platform: Platform; i18n: I18n;logical?:LogicalSize;desktop?:boolean }) {
  const [size,setSize]=useState(()=>platform.viewport.size());
  const viewport=fitViewport(size.width,size.height,logical);
  useEffect(()=>platform.viewport.subscribe(()=>setSize(platform.viewport.size())),[platform]);
  return <div className={`viewport-shell ${desktop?'viewport-desktop':''}`}>
    <div className="stage-frame" style={{width:viewport.width,height:viewport.height}}>
      <div className="stage" style={{width:logical.width,height:logical.height,transform:`scale(${viewport.scale})`}}>{children}</div>
    </div>
    {viewport.narrow&&<p className="screen-notice">{i18n.t('system.narrowScreen')}</p>}
  </div>;
}
