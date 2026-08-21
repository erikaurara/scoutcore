const QR_VERSION = 4;
const QR_SIZE = QR_VERSION * 4 + 17;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;

type Matrix = boolean[][];

const gfMultiply = (left: number, right: number) => {
  let result = 0;
  let a = left;
  let b = right;
  while (b > 0) {
    if (b & 1) result ^= a;
    b >>>= 1;
    a <<= 1;
    if (a & 0x100) a ^= 0x11d;
  }
  return result;
};

const reedSolomonDivisor = (degree: number) => {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const reedSolomonRemainder = (data: number[], divisor: number[]) => {
  const result = Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
};

const appendBits = (target: number[], value: number, length: number) => {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1);
};

const createCodewords = (value: string) => {
  const bytes = Array.from(new TextEncoder().encode(value));
  if (bytes.length > 78) throw new Error('ScoutCore profile link is too long for this QR code.');

  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    data.push(Number.parseInt(bits.slice(index, index + 8).join(''), 2));
  }
  for (let pad = 0; data.length < DATA_CODEWORDS; pad += 1) data.push(pad % 2 === 0 ? 0xec : 0x11);

  return [...data, ...reedSolomonRemainder(data, reedSolomonDivisor(ECC_CODEWORDS))];
};

const drawFinder = (modules: Matrix, functions: Matrix, centerX: number, centerY: number) => {
  for (let dy = -4; dy <= 4; dy += 1) {
    for (let dx = -4; dx <= 4; dx += 1) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) continue;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      modules[y][x] = distance !== 2 && distance !== 4;
      functions[y][x] = true;
    }
  }
};

const drawAlignment = (modules: Matrix, functions: Matrix, centerX: number, centerY: number) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      modules[centerY + dy][centerX + dx] = distance !== 1;
      functions[centerY + dy][centerX + dx] = true;
    }
  }
};

const drawFormatBits = (modules: Matrix, functions: Matrix, mask: number) => {
  const data = (0b01 << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  const bits = ((data << 10) | remainder) ^ 0x5412;
  const set = (x: number, y: number, index: number) => {
    modules[y][x] = ((bits >>> index) & 1) !== 0;
    functions[y][x] = true;
  };

  for (let i = 0; i <= 5; i += 1) set(8, i, i);
  set(8, 7, 6);
  set(8, 8, 7);
  set(7, 8, 8);
  for (let i = 9; i < 15; i += 1) set(14 - i, 8, i);

  for (let i = 0; i < 8; i += 1) set(QR_SIZE - 1 - i, 8, i);
  for (let i = 8; i < 15; i += 1) set(8, QR_SIZE - 15 + i, i);
  modules[QR_SIZE - 8][8] = true;
  functions[QR_SIZE - 8][8] = true;
};

export const createQrMatrix = (value: string): Matrix => {
  const modules = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false));
  const functions = Array.from({ length: QR_SIZE }, () => Array<boolean>(QR_SIZE).fill(false));

  drawFinder(modules, functions, 3, 3);
  drawFinder(modules, functions, QR_SIZE - 4, 3);
  drawFinder(modules, functions, 3, QR_SIZE - 4);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const dark = index % 2 === 0;
    modules[6][index] = dark;
    functions[6][index] = true;
    modules[index][6] = dark;
    functions[index][6] = true;
  }
  drawAlignment(modules, functions, 26, 26);

  const mask = 0;
  drawFormatBits(modules, functions, mask);
  const codewords = createCodewords(value);
  const dataBits: number[] = [];
  codewords.forEach((byte) => appendBits(dataBits, byte, 8));

  let bitIndex = 0;
  let upward = true;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (functions[y][x]) continue;
        const raw = bitIndex < dataBits.length ? dataBits[bitIndex] === 1 : false;
        const masked = (x + y) % 2 === 0 ? !raw : raw;
        modules[y][x] = masked;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  return modules;
};

