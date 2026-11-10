/**
 * Donanım barkod okuyucu algılama ("klavye kaması" / keyboard wedge).
 *
 * El terminalleri (ТСД: Urovo, Zebra, Mertech, Honeywell…) ve USB/Bluetooth okuyucular okuttuğu kodu
 * çok hızlı klavye vuruşları olarak gönderir ve sonuna Enter (veya Tab) ekler. İnsan bu hızda yazamaz;
 * bu sınıf vuruşlar arası süreye bakarak okuyucu girişini elle yazılandan ayırır.
 *
 * DataMatrix'teki GS (0x1D) ayırıcısı bazı cihazlarda F8 / Ctrl+] olarak gelir; bunlar GS'ye çevrilir.
 */
export interface WedgeOptions {
  /** İki vuruş arasında izin verilen en uzun süre (ms). */
  maxGapMs?: number;
  /** Kod sayılması için en az karakter. */
  minLength?: number;
}

export class WedgeBuffer {
  private buf = '';
  private last = 0;
  private readonly maxGap: number;
  private readonly minLength: number;

  constructor(private onScan: (code: string) => void, opts: WedgeOptions = {}) {
    this.maxGap = opts.maxGapMs ?? 60;
    this.minLength = opts.minLength ?? 4;
  }

  /** @returns true ise tuş okuyucuya aittir ve varsayılan davranış engellenmelidir. */
  key(key: string, time: number, ctrl = false): boolean {
    if (time - this.last > this.maxGap) this.buf = '';
    this.last = time;
    if (key === 'Enter' || key === 'Tab') {
      const code = this.buf;
      this.buf = '';
      if (code.length >= this.minLength) {
        this.onScan(code);
        return true;
      }
      return false;
    }
    if (key === 'F8' || (ctrl && key === ']')) {
      this.buf += '\u001d';
      return true;
    }
    if (key.length === 1) {
      this.buf += key;
      return this.buf.length > 1;
    }
    return false;
  }

  reset() { this.buf = ''; }
}
