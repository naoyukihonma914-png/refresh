import type { CSSProperties } from 'react';

export function ReleaseProgress({ done, total }: { done: number; total: number }) {
  return <svg className="release-progress-ring" viewBox="0 0 24 24" aria-hidden="true" style={{ '--release-progress': done / total } as CSSProperties}>
    <circle className="ring-track" cx="12" cy="12" r="9" />
    <circle className="ring-value" cx="12" cy="12" r="9" pathLength="1" />
  </svg>;
}
