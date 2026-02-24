type Md5State = {
  a: number;
  b: number;
  c: number;
  d: number;
  bytes: number;
  buffer: Uint8Array;
  bufferLength: number;
};

const ROTATIONS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const CONSTANTS = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

function leftRotate(x: number, c: number): number {
  return (x << c) | (x >>> (32 - c));
}

function initState(): Md5State {
  return {
    a: 0x67452301,
    b: 0xefcdab89,
    c: 0x98badcfe,
    d: 0x10325476,
    bytes: 0,
    buffer: new Uint8Array(64),
    bufferLength: 0,
  };
}

function transform(state: Md5State, chunk: Uint8Array) {
  const m0 = (chunk[0] | (chunk[1] << 8) | (chunk[2] << 16) | (chunk[3] << 24)) >>> 0;
  const m1 = (chunk[4] | (chunk[5] << 8) | (chunk[6] << 16) | (chunk[7] << 24)) >>> 0;
  const m2 = (chunk[8] | (chunk[9] << 8) | (chunk[10] << 16) | (chunk[11] << 24)) >>> 0;
  const m3 = (chunk[12] | (chunk[13] << 8) | (chunk[14] << 16) | (chunk[15] << 24)) >>> 0;
  const m4 = (chunk[16] | (chunk[17] << 8) | (chunk[18] << 16) | (chunk[19] << 24)) >>> 0;
  const m5 = (chunk[20] | (chunk[21] << 8) | (chunk[22] << 16) | (chunk[23] << 24)) >>> 0;
  const m6 = (chunk[24] | (chunk[25] << 8) | (chunk[26] << 16) | (chunk[27] << 24)) >>> 0;
  const m7 = (chunk[28] | (chunk[29] << 8) | (chunk[30] << 16) | (chunk[31] << 24)) >>> 0;
  const m8 = (chunk[32] | (chunk[33] << 8) | (chunk[34] << 16) | (chunk[35] << 24)) >>> 0;
  const m9 = (chunk[36] | (chunk[37] << 8) | (chunk[38] << 16) | (chunk[39] << 24)) >>> 0;
  const m10 = (chunk[40] | (chunk[41] << 8) | (chunk[42] << 16) | (chunk[43] << 24)) >>> 0;
  const m11 = (chunk[44] | (chunk[45] << 8) | (chunk[46] << 16) | (chunk[47] << 24)) >>> 0;
  const m12 = (chunk[48] | (chunk[49] << 8) | (chunk[50] << 16) | (chunk[51] << 24)) >>> 0;
  const m13 = (chunk[52] | (chunk[53] << 8) | (chunk[54] << 16) | (chunk[55] << 24)) >>> 0;
  const m14 = (chunk[56] | (chunk[57] << 8) | (chunk[58] << 16) | (chunk[59] << 24)) >>> 0;
  const m15 = (chunk[60] | (chunk[61] << 8) | (chunk[62] << 16) | (chunk[63] << 24)) >>> 0;

  const m = [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15] as const;

  let a = state.a;
  let b = state.b;
  let c = state.c;
  let d = state.d;

  for (let i = 0; i < 64; i++) {
    let f = 0;
    let g = 0;

    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (~d & c);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }

    const tmp = d;
    d = c;
    c = b;

    const x = (a + f + CONSTANTS[i] + m[g]) | 0;
    b = (b + leftRotate(x, ROTATIONS[i])) | 0;
    a = tmp;
  }

  state.a = (state.a + a) | 0;
  state.b = (state.b + b) | 0;
  state.c = (state.c + c) | 0;
  state.d = (state.d + d) | 0;
}

function update(state: Md5State, input: Uint8Array) {
  if (input.length === 0) return;

  state.bytes += input.length;

  let offset = 0;

  if (state.bufferLength > 0) {
    const need = 64 - state.bufferLength;
    if (input.length < need) {
      state.buffer.set(input, state.bufferLength);
      state.bufferLength += input.length;
      return;
    }

    state.buffer.set(input.subarray(0, need), state.bufferLength);
    transform(state, state.buffer);
    state.bufferLength = 0;
    offset = need;
  }

  while (offset + 64 <= input.length) {
    transform(state, input.subarray(offset, offset + 64));
    offset += 64;
  }

  if (offset < input.length) {
    state.buffer.set(input.subarray(offset));
    state.bufferLength = input.length - offset;
  }
}

function finalize(state: Md5State): Uint8Array {
  const bytes = state.bytes;
  const bitLow = (bytes << 3) >>> 0;
  const bitHigh = (bytes >>> 29) >>> 0;

  const pad = new Uint8Array(64);
  pad[0] = 0x80;

  const bufferLen = state.bufferLength;
  const padLen = bufferLen < 56 ? 56 - bufferLen : 120 - bufferLen;
  update(state, pad.subarray(0, padLen));

  const lenBytes = new Uint8Array(8);
  lenBytes[0] = bitLow & 0xff;
  lenBytes[1] = (bitLow >>> 8) & 0xff;
  lenBytes[2] = (bitLow >>> 16) & 0xff;
  lenBytes[3] = (bitLow >>> 24) & 0xff;
  lenBytes[4] = bitHigh & 0xff;
  lenBytes[5] = (bitHigh >>> 8) & 0xff;
  lenBytes[6] = (bitHigh >>> 16) & 0xff;
  lenBytes[7] = (bitHigh >>> 24) & 0xff;
  update(state, lenBytes);

  const out = new Uint8Array(16);
  const words = [state.a, state.b, state.c, state.d] as const;
  for (let i = 0; i < words.length; i++) {
    const w = words[i] >>> 0;
    out[i * 4] = w & 0xff;
    out[i * 4 + 1] = (w >>> 8) & 0xff;
    out[i * 4 + 2] = (w >>> 16) & 0xff;
    out[i * 4 + 3] = (w >>> 24) & 0xff;
  }
  return out;
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

function md5HexFromBytes(bytes: Uint8Array): string {
  const state = initState();
  update(state, bytes);
  return hex(finalize(state));
}

export function md5HexFromString(input: string): string {
  return md5HexFromBytes(new TextEncoder().encode(input));
}

async function md5HexFromBlob(blob: Blob): Promise<string> {
  const chunkSize = 2 * 1024 * 1024;
  const state = initState();

  for (let offset = 0; offset < blob.size; offset += chunkSize) {
    const slice = blob.slice(offset, Math.min(blob.size, offset + chunkSize));
    const chunk = new Uint8Array(await slice.arrayBuffer());
    update(state, chunk);
  }

  return hex(finalize(state));
}

function fileKeyForCache(blob: Blob): string | null {
  if (typeof File !== 'undefined' && blob instanceof File) {
    return `${blob.name}:${blob.size}:${blob.lastModified}`;
  }
  return null;
}

const blobCache = new Map<string, Promise<string>>();

export function fingerprintMd5Hex(blob: Blob): Promise<string> {
  const key = fileKeyForCache(blob);
  if (!key) return md5HexFromBlob(blob);

  const cached = blobCache.get(key);
  if (cached) return cached;

  const task = md5HexFromBlob(blob).then((value) => value.toLowerCase());
  blobCache.set(key, task);
  return task;
}
