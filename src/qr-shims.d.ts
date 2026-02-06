// Ambient module declarations so TypeScript / Angular compiler
// can resolve these browser-only QR libraries without TS2307 errors.
// The actual runtime implementations come from the installed npm packages.

declare module 'qrcode-generator';

declare module 'html5-qrcode';

