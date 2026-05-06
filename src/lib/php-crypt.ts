import bcrypt from "bcryptjs";
import apacheMd5 from "apache-md5";
import { sha256 } from "js-sha256";
import unixCrypt from "unix-crypt-td-js";
import { sha512 } from "sha512-crypt-ts";

export function verifyPhpCrypt(password: string, hash: string): boolean {
  if (!hash) return false;
  if (hash.startsWith("$2a$") || hash.startsWith("$2x$") || hash.startsWith("$2y$") || hash.startsWith("$2b$")) {
    const normalized = hash.replace(/^\$2[xy]\$/, "$2a$");
    return bcrypt.compareSync(password, normalized);
  }
  if (hash.startsWith("$1$")) {
    return apacheMd5(password, hash) === hash;
  }
  if (hash.startsWith("$apr1$")) {
    return apacheMd5(password, hash) === hash;
  }
  if (hash.startsWith("$6$")) {
    return sha512.crypt(password, hash) === hash;
  }
  if (hash.startsWith("$5$")) {
    return sha256Crypt(password, hash) === hash;
  }
  if (/^[./0-9A-Za-z]{2}/.test(hash)) {
    return unixCrypt(password, hash.slice(0, 2)) === hash;
  }
  return false;
}

function sha256Crypt(password: string, saltInput: string): string {
  const parsed = parseShaCryptSalt(saltInput, "$5$");
  const passwordBytes = encode(password);
  const saltBytes = encode(parsed.salt);

  const digestB = hash256(concat(passwordBytes, saltBytes, passwordBytes));
  let inputA = concat(passwordBytes, saltBytes, repeatToLength(digestB, passwordBytes.length));
  for (let count = passwordBytes.length; count > 0; count >>= 1) {
    inputA = concat(inputA, (count & 1) !== 0 ? digestB : passwordBytes);
  }
  let digest = hash256(inputA);

  const p = repeatToLength(hash256(repeatBytes(passwordBytes, passwordBytes.length)), passwordBytes.length);
  const s = repeatToLength(hash256(repeatBytes(saltBytes, 16 + digest[0])), saltBytes.length);

  for (let i = 0; i < parsed.rounds; i += 1) {
    let roundInput = (i & 1) !== 0 ? p : digest;
    if (i % 3 !== 0) roundInput = concat(roundInput, s);
    if (i % 7 !== 0) roundInput = concat(roundInput, p);
    roundInput = concat(roundInput, (i & 1) !== 0 ? digest : p);
    digest = hash256(roundInput);
  }

  const encoded = [
    cryptBase64(digest[0], digest[10], digest[20], 4),
    cryptBase64(digest[21], digest[1], digest[11], 4),
    cryptBase64(digest[12], digest[22], digest[2], 4),
    cryptBase64(digest[3], digest[13], digest[23], 4),
    cryptBase64(digest[24], digest[4], digest[14], 4),
    cryptBase64(digest[15], digest[25], digest[5], 4),
    cryptBase64(digest[6], digest[16], digest[26], 4),
    cryptBase64(digest[27], digest[7], digest[17], 4),
    cryptBase64(digest[18], digest[28], digest[8], 4),
    cryptBase64(digest[9], digest[19], digest[29], 4),
    cryptBase64(0, digest[31], digest[30], 3)
  ].join("");

  return `${parsed.prefix}${parsed.salt}$${encoded}`;
}

function parseShaCryptSalt(input: string, magic: "$5$"): { prefix: string; rounds: number; salt: string } {
  let value = input.startsWith(magic) ? input.slice(magic.length) : input;
  let rounds = 5000;
  let prefix: string = magic;
  const roundsMatch = /^rounds=(\d+)\$/.exec(value);
  if (roundsMatch) {
    rounds = Math.min(999999999, Math.max(1000, Number(roundsMatch[1])));
    prefix = `${magic}rounds=${rounds}$`;
    value = value.slice(roundsMatch[0].length);
  }
  const salt = value.split("$")[0].slice(0, 16);
  return { prefix, rounds, salt };
}

function hash256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(sha256.array(bytes));
}

function encode(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function repeatBytes(bytes: Uint8Array, count: number): Uint8Array {
  const output = new Uint8Array(bytes.length * count);
  for (let i = 0; i < count; i += 1) output.set(bytes, i * bytes.length);
  return output;
}

function repeatToLength(bytes: Uint8Array, length: number): Uint8Array {
  const output = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += bytes.length) {
    output.set(bytes.slice(0, Math.min(bytes.length, length - offset)), offset);
  }
  return output;
}

function cryptBase64(byte2: number, byte1: number, byte0: number, count: number): string {
  const alphabet = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let value = (byte2 << 16) | (byte1 << 8) | byte0;
  let output = "";
  for (let i = 0; i < count; i += 1) {
    output += alphabet[value & 0x3f];
    value >>= 6;
  }
  return output;
}
