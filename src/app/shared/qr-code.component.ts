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
    // Skip generation in SSR environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      this.dataUrl = null;
      return;
    }

    const trimmed = (this.value ?? '').toString().trim();
    if (!trimmed) {
      this.dataUrl = null;
      return;
    }

    try {
      const zxing = await import('@zxing/library');
      const { QRCodeWriter, EncodeHintType, BarcodeFormat } = zxing;

      // Create canvas element to render the QR code
      const canvas = document.createElement('canvas');
      canvas.width = this.size;
      canvas.height = this.size;

      // Configure encoding hints
      const hints = new Map();
      hints.set(EncodeHintType.MARGIN, 0);
      hints.set(EncodeHintType.ERROR_CORRECTION, 'M');

      // Create writer and encode the data
      const writer = new QRCodeWriter();
      const bitMatrix = writer.encode(
        trimmed,
        BarcodeFormat.QR_CODE,
        this.size,
        this.size,
        hints
      );

      // Draw the QR code on canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, this.size, this.size);

      // Draw QR code (black squares)
      ctx.fillStyle = '#000000';
      const width = bitMatrix.getWidth();
      const height = bitMatrix.getHeight();
      const cellSize = Math.min(this.size / width, this.size / height);

      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          if (bitMatrix.get(x, y)) {
            ctx.fillRect(
              x * cellSize,
              y * cellSize,
              cellSize,
              cellSize
            );
          }
        }
      }

      // Convert canvas to data URL
      this.dataUrl = canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to generate QR code', err);
      this.dataUrl = null;
    }
  }
}

