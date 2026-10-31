import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GameRuntime } from './systems/runtime';
import { browserRoot, createBrowserPlatform } from './platform/browser';
import './style.css';
import './desktop.css';

const platform = createBrowserPlatform();
const runtime = new GameRuntime(platform);
const root = createRoot(browserRoot());
root.render(<App runtime={runtime} debug={platform.launch.debug} />);
void runtime.start();

const unsubscribe = [
  platform.visibility.subscribe(runtime.visibilityChanged),
  platform.lifecycle.onLeave(() => { runtime.leave(); runtime.dispose(); }),
  platform.lifecycle.onRestore(runtime.reload),
];
if (import.meta.hot) import.meta.hot.dispose(() => {
  runtime.leave();
  runtime.dispose();
  unsubscribe.forEach(stop => stop());
  root.unmount();
});
