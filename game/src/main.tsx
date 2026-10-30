import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GameRuntime } from './systems/runtime';
import './style.css';

const params = new URLSearchParams(window.location.search);
const runtime = new GameRuntime(params);
const root = createRoot(document.getElementById('root')!);
root.render(<App runtime={runtime} debug={params.get('debug') === '1'} />);
void runtime.start();

document.addEventListener('visibilitychange', runtime.visibilityChanged);
const onPageHide = () => { runtime.leave(); runtime.dispose(); };
window.addEventListener('pagehide', onPageHide);
// 戻る・進むで凍結した画面が復活した場合は、所有権を取得し直して保存から再開する。
const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) window.location.reload(); };
window.addEventListener('pageshow', onPageShow);
if (import.meta.hot) import.meta.hot.dispose(() => {
  runtime.leave();
  runtime.dispose();
  document.removeEventListener('visibilitychange', runtime.visibilityChanged);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
  root.unmount();
});
