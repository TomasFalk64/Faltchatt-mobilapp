declare module 'upng-js' {
  const UPNG: {
    encode(buffers: ArrayBuffer[], width: number, height: number, cnum?: number): ArrayBuffer;
  };
  export default UPNG;
}

declare module 'utif' {
  export function decode(buffer: ArrayBuffer): unknown[];
  export function decodeImage(buffer: ArrayBuffer, ifd: unknown): void;
  export function toRGBA8(ifd: unknown): Uint8Array;
}

declare module 'base64-js' {
  export function fromByteArray(bytes: Uint8Array): string;
  export function toByteArray(value: string): Uint8Array;
}
