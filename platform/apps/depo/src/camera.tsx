import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n.ts';

const hints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.CODE_128, BarcodeFormat.UPC_A,
    BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE, BarcodeFormat.CODE_39, BarcodeFormat.ITF]],
  [DecodeHintType.TRY_HARDER, true],
]);

/** Telefon kamerasıyla okutma (EAN, Code128, DataMatrix/Честный знак, QR). HTTPS gerektirir. */
export default function CameraScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const last = useRef({ code: '', at: 0 });
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let stopped = false;
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
    reader
      .decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (result) => {
        if (!result) return;
        const code = result.getText();
        const now = Date.now();
        // Aynı kod kamera önünde dururken tekrar tekrar sayılmasın.
        if (code === last.current.code && now - last.current.at < 2000) return;
        last.current = { code, at: now };
        cb.current(code);
      })
      .then((c) => { controls = c; if (stopped) c.stop(); })
      .catch(() => setError(true));
    return () => { stopped = true; controls?.stop(); };
  }, []);

  return (
    <div className="camera">
      {error ? <p className="error">{t.cameraError}</p> : <video ref={video} muted playsInline />}
      <div className="camera-frame" />
      <button className="btn secondary wide" onClick={onClose}>{t.closeCamera}</button>
    </div>
  );
}
