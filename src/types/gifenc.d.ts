/**
 * Minimal ambient declarations for `gifenc` — the package ships no
 * types of its own and DefinitelyTyped doesn't have it either. We
 * only use three exports; declare them narrowly so a real misuse
 * trips the typechecker.
 */
declare module "gifenc" {
  export type Palette = number[][];

  export interface FrameOptions {
    palette?: Palette;
    /** Frame display time in centiseconds (1 = 10ms). 400 = 4 seconds. */
    delay?: number;
    /** 0 = no disposal, 1 = leave in place, 2 = restore to background. */
    dispose?: number;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    first?: boolean;
  }

  export interface QuantizeOptions {
    format?: "rgb444" | "rgb565" | "rgba4444";
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  export interface GifEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: FrameOptions,
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(): GifEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ): Palette;

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: "rgb444" | "rgb565" | "rgba4444",
  ): Uint8Array;
}
