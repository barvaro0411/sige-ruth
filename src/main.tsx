import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

async function clearDevelopmentServiceWorkers() {
  if (!import.meta.env.DEV) return false;

  try {
    let cleared = false;

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      cleared = registrations.length > 0 || cleared;
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      cleared = cacheKeys.length > 0 || cleared;
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
    }

    return cleared;
  } catch (error) {
    console.warn('[PWA] Failed to clear development service workers:', error);
    return false;
  }
}

async function bootstrap() {
  const hadLegacyPwa = await clearDevelopmentServiceWorkers();

  if (hadLegacyPwa) {
    const reloadKey = 'sige-ruth:dev-pwa-cleaned';
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(reloadKey);
  }

  createRoot(rootElement!).render(
    <App />,
  );
}

void bootstrap();
