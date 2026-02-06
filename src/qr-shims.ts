// Ambient module declarations so the Angular compiler / TypeScript
// can resolve these browser-only QR libraries without TS2307 errors.
// The actual implementations are provided at runtime by the npm packages.

declare module 'qrcode-generator';

declare module 'html5-qrcode';

