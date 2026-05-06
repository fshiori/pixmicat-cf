import * as jpeg from "jpeg-js";
import { decode as decodePng } from "fast-png";
import { GifReader } from "omggif";

export type DecodedImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

export function decodeImage(buffer: ArrayBuffer, ext: string): DecodedImage {
  const bytes = new Uint8Array(buffer);
  if (ext === ".jpg") {
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { width: decoded.width, height: decoded.height, data: decoded.data };
  }
  if (ext === ".png") {
    const decoded = decodePng(bytes);
    return { width: decoded.width, height: decoded.height, data: toRgba(decoded.data, decoded.channels) };
  }
  if (ext === ".gif") {
    const reader = new GifReader(bytes);
    const data = new Uint8Array(reader.width * reader.height * 4);
    reader.decodeAndBlitFrameRGBA(0, data);
    return { width: reader.width, height: reader.height, data };
  }
  if (ext === ".bmp") {
    return decodeBmp(bytes);
  }
  throw new Error("Unsupported image format for thumbnail");
}

export function resizeNearest(image: DecodedImage, width: number, height: number): DecodedImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(Math.floor((y * image.height) / height), image.height - 1);
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(Math.floor((x * image.width) / width), image.width - 1);
      const source = (sourceY * image.width + sourceX) * 4;
      const target = (y * width + x) * 4;
      data[target] = image.data[source];
      data[target + 1] = image.data[source + 1];
      data[target + 2] = image.data[source + 2];
      data[target + 3] = image.data[source + 3];
    }
  }
  return { width, height, data };
}

export function encodeJpeg(image: DecodedImage, quality: number): Uint8Array {
  return jpeg.encode({ width: image.width, height: image.height, data: image.data }, quality).data;
}

function toRgba(data: Uint8Array | Uint8ClampedArray | Uint16Array, channels: number): Uint8Array {
  const source = data instanceof Uint8Array ? data : new Uint8Array(data.map((value) => value >> 8));
  if (channels === 4) return source;
  const pixels = source.length / channels;
  const rgba = new Uint8Array(pixels * 4);
  for (let i = 0; i < pixels; i += 1) {
    const sourceOffset = i * channels;
    const targetOffset = i * 4;
    if (channels === 1) {
      rgba[targetOffset] = source[sourceOffset];
      rgba[targetOffset + 1] = source[sourceOffset];
      rgba[targetOffset + 2] = source[sourceOffset];
      rgba[targetOffset + 3] = 255;
    } else if (channels === 2) {
      rgba[targetOffset] = source[sourceOffset];
      rgba[targetOffset + 1] = source[sourceOffset];
      rgba[targetOffset + 2] = source[sourceOffset];
      rgba[targetOffset + 3] = source[sourceOffset + 1];
    } else {
      rgba[targetOffset] = source[sourceOffset];
      rgba[targetOffset + 1] = source[sourceOffset + 1];
      rgba[targetOffset + 2] = source[sourceOffset + 2];
      rgba[targetOffset + 3] = 255;
    }
  }
  return rgba;
}

function decodeBmp(bytes: Uint8Array): DecodedImage {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, false) !== 0x424d) throw new Error("Unsupported BMP");
  const dataOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  const bpp = view.getUint16(28, true);
  if (bpp !== 24 && bpp !== 32) throw new Error("Unsupported BMP depth");
  const rowStride = Math.floor((bpp * width + 31) / 32) * 4;
  const rgba = new Uint8Array(width * height * 4);
  const topDown = rawHeight < 0;
  for (let y = 0; y < height; y += 1) {
    const sourceY = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const source = dataOffset + sourceY * rowStride + x * (bpp / 8);
      const target = (y * width + x) * 4;
      rgba[target] = bytes[source + 2];
      rgba[target + 1] = bytes[source + 1];
      rgba[target + 2] = bytes[source];
      rgba[target + 3] = bpp === 32 ? bytes[source + 3] : 255;
    }
  }
  return { width, height, data: rgba };
}
