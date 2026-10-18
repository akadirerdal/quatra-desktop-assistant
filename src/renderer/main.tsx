import ReactDOM from 'react-dom/client';
import { App } from './App';
import './app.css';

// Yakalanan renderer hataları günlük dosyasına iletilir (main süreç redact'lar).
window.addEventListener('error', (e) => {
  window.quatra?.log.rendererError(
    'error',
    `${e.message} @ ${e.filename}:${e.lineno}\n${e.error?.stack ?? ''}`,
  );
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as { stack?: string; message?: string } | undefined;
  window.quatra?.log.rendererError(
    'error',
    `unhandledrejection: ${reason?.stack ?? reason?.message ?? String(e.reason)}`,
  );
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
