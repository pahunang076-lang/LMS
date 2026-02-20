declare module '@zxing/library' {
  export class QRCodeWriter {
    encode(
      contents: string,
      format: any,
      width: number,
      height: number,
      hints?: Map<any, any>
    ): any;
  }

  export class BrowserMultiFormatWriter {
    write(
      contents: string,
      format: any,
      width: number,
      height: number,
      hints?: Map<any, any>,
      element?: HTMLElement
    ): string;
  }

  export class BrowserMultiFormatReader {
    constructor();
    listVideoInputDevices(): Promise<any[]>;
    decodeFromVideoDevice(
      deviceId: string | null,
      videoElementId: string,
      callback: (result: any, err: any) => void
    ): Promise<void>;
    reset(): void;
    stopAsyncDecode(): void;
  }

  export enum EncodeHintType {
    MARGIN = 0,
    ERROR_CORRECTION = 1,
  }

  export enum BarcodeFormat {
    QR_CODE = 0,
  }

  export class NotFoundException extends Error {
    constructor(message?: string);
  }
}
