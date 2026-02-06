import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.css',
})
export class QrCodeComponent implements OnChanges {
  /**
   * Raw value encoded into the QR code.
   * For books this should be the unique book ID (or ISBN).
   */
  @Input() value = '';

  /**
   * Rendered image size in pixels.
   */
  @Input() size = 200;

  dataUrl: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes || 'size' in changes) {
      this.generate();
    }
  }

  private async generate(): Promise<void> {
    const trimmed = (this.value ?? '').toString().trim();
    if (!trimmed) {
      this.dataUrl = null;
      return;
    }

    try {
      const qrcodeModule = await import('qrcode-generator');
      const qrcodeFactory: any =
        (qrcodeModule as any).default ?? (qrcodeModule as any);

      const qr = qrcodeFactory(0, 'M');
      qr.addData(trimmed);
      qr.make();

      // 0 margin for a compact code; caller can add padding via CSS.
      this.dataUrl = qr.createDataURL(this.size, 0);
    } catch (err) {
      console.error('Failed to generate QR code', err);
      this.dataUrl = null;
    }
  }
}

