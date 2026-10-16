import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './app.css';

// Yakalanan renderer hataları günlük dosyasına iletilir (main süreç redact'lar).
window.addEventListener('error', (e) => {
  window.quatra?.log.rendererError('error', `${e.message} @ ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => {
  window.quatra?.log.rendererError('warn', `unhandledrejection: ${String(e.reason)}`);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
