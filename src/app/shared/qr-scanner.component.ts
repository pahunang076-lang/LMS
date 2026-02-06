import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-scanner.component.html',
  styleUrl: './qr-scanner.component.css',
})
export class QrScannerComponent implements OnInit, OnDestroy {
  /**
   * Simple title rendered above the scanner UI.
   */
  @Input() title = 'Scan QR code';

  /**
   * Optional hint text displayed under the title.
   */
  @Input() hint: string | null = null;

  /**
   * Emitted when a QR code has been successfully decoded.
   */
  @Output() scanned = new EventEmitter<string>();

  /**
   * Emitted when the underlying scanner reports an error while trying to decode.
   * Note: this may fire frequently while the camera is focusing.
   */
  @Output() scanError = new EventEmitter<string>();

  readonly elementId = `qr-scanner-${Math.random().toString(36).slice(2)}`;

  private scanner: any | null = null;
  private isBrowser = typeof window !== 'undefined';

  lastResult: string | null = null;
  hasScanSuccess = false;

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) {
      return;
    }

    const container = document.getElementById(this.elementId);
    if (!container) {
      return;
    }

    try {
      const module = await import('html5-qrcode');
      const Html5QrcodeScanner = (module as any).Html5QrcodeScanner;
      const Html5QrcodeScanType = (module as any).Html5QrcodeScanType;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      };

      this.scanner = new Html5QrcodeScanner(this.elementId, config, false);
      this.scanner.render(
        (decodedText: string) => {
          this.lastResult = decodedText;
          this.hasScanSuccess = true;
          this.scanned.emit(decodedText);

          // Briefly flash the success state.
          setTimeout(() => {
            this.hasScanSuccess = false;
          }, 800);
        },
        (errorMessage: string) => {
          this.scanError.emit(errorMessage);
        }
      );
    } catch (err) {
      console.error('Failed to initialize QR scanner', err);
      this.scanError.emit('Unable to initialize camera scanner.');
    }
  }

  ngOnDestroy(): void {
    if (this.scanner && typeof this.scanner.clear === 'function') {
      this.scanner
        .clear()
        .then(() => undefined)
        .catch(() => undefined);
    }
  }
}

