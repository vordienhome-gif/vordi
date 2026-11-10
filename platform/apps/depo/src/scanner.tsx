import { lazy, useEffect, useRef } from 'react';
import { WedgeBuffer } from './wedge.ts';

/**
 * Donanım okuyucuyu dinler (el terminali, USB/Bluetooth okuyucu). Bir input odakta olsa bile
 * hızlı gelen vuruşlar okutma sayılır; elle yazılan normal metin etkilenmez.
 */
export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    const w = new WedgeBuffer((code) => cb.current(code));
    const handler = (e: KeyboardEvent) => {
      if (w.key(e.key, e.timeStamp, e.ctrlKey) && (e.key === 'Enter' || e.key === 'Tab' || e.key === 'F8')) e.preventDefault();
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled]);
}

/** Kamera bileşeni (zxing) yalnızca kamera açıldığında yüklenir: uygulama ilk açılışta hızlı kalır. */
export const CameraScanner = lazy(() => import('./camera.tsx'));
