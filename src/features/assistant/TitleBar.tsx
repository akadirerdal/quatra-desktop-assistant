/**
 * Başlık çubuğu — sürükleme alanı + pencere kontrolleri.
 * Windows/Linux: çerçevesiz pencere; küçült / büyüt-geri al / kapat buradadır.
 * macOS: yerel trafik ışıkları kullanılır (hiddenInset) — özel düğmeler GÖSTERİLMEZ;
 * kopya düğme göstermek yanıltıcı olurdu.
 */
export function TitleBar(): React.JSX.Element {
  const isMac = window.quatra?.platform === 'darwin';
  return (
    <div className={isMac ? 'titlebar mac' : 'titlebar'}>
      <div className="titlebarDrag">
        <span className="titlebarTitle">Quatra</span>
      </div>
      {!isMac && (
        <div className="titlebarControls">
          <button
            className="winBtn"
            title="Küçült"
            aria-label="Küçült"
            onClick={() => window.quatra?.window.minimize()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            className="winBtn"
            title="Büyüt / Geri al"
            aria-label="Büyüt veya geri al"
            onClick={() => window.quatra?.window.toggleMaximize()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect
                x="1.5"
                y="1.5"
                width="7"
                height="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
              />
            </svg>
          </button>
          <button
            className="winBtn close"
            title="Kapat"
            aria-label="Kapat"
            onClick={() => window.quatra?.window.close()}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
