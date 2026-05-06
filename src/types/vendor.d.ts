declare module "omggif" {
  export class GifReader {
    constructor(buffer: Uint8Array);
    width: number;
    height: number;
    numFrames(): number;
    decodeAndBlitFrameRGBA(frameNum: number, pixels: Uint8Array): void;
  }
}

declare module "unix-crypt-td-js" {
  export default function unixCrypt(password: string | number[], salt: string | number[], returnBytes?: boolean): string;
}

declare module "apache-md5" {
  export default function apacheMd5(password: string, salt?: string): string;
}
