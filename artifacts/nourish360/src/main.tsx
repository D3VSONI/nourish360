import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

// Cache only static shell resources. Session APIs and map tiles are never cached here.
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}demo-worker.js`)
      .then(async () => {
        const { active } = await navigator.serviceWorker.ready;
        const urls = performance.getEntriesByType('resource').filter((resource) => {
          const type = (resource as PerformanceResourceTiming).initiatorType;
          return ['script','link','css','img'].includes(type) && new URL(resource.name).origin === location.origin;
        }).map((resource) => resource.name);
        active?.postMessage({type:'WARM_SHELL',urls});
      }).catch((error) => console.warn('Offline shell could not be initialized:',error));
  }, {once:true});
}
