import type { CSSProperties } from 'react';
import { BALANCE } from '../config/balance';
import './WorldTransition.css';

/** The new version is already mounted beneath this brief white opening. */
export function VersionTransition({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return <div inert aria-hidden="true" className={`version-transition ${reducedMotion ? 'reduced-motion' : ''}`}
    style={{ '--version-opening-ms': `${BALANCE.release.restartMs}ms` } as CSSProperties} />;
}
