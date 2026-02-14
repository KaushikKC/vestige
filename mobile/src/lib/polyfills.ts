import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { Buffer } from 'buffer';

// Force the full Buffer polyfill globally
(global as any).Buffer = Buffer;

// Anchor/Borsh/buffer-layout call readUIntLE, readUInt32LE, writeUInt32LE, etc.
// on data returned from RPC. In React Native (Hermes), the RPC data may arrive
// as a plain Uint8Array that lacks these Buffer-specific methods.
// Patch the critical methods directly onto Uint8Array.prototype.
const bp = Buffer.prototype as any;
const up = Uint8Array.prototype as any;

const methodsToPatch = [
  // Read methods used by buffer-layout / Borsh / Anchor
  'readUIntLE', 'readUIntBE',
  'readUInt8', 'readUInt16LE', 'readUInt16BE', 'readUInt32LE', 'readUInt32BE',
  'readIntLE', 'readIntBE',
  'readInt8', 'readInt16LE', 'readInt16BE', 'readInt32LE', 'readInt32BE',
  'readFloatLE', 'readFloatBE', 'readDoubleLE', 'readDoubleBE',
  'readBigUInt64LE', 'readBigInt64LE',
  // Write methods used for transaction serialization
  'writeUIntLE', 'writeUIntBE',
  'writeUInt8', 'writeUInt16LE', 'writeUInt16BE', 'writeUInt32LE', 'writeUInt32BE',
  'writeIntLE', 'writeIntBE',
  'writeInt8', 'writeInt16LE', 'writeInt16BE', 'writeInt32LE', 'writeInt32BE',
  'writeFloatLE', 'writeFloatBE', 'writeDoubleLE', 'writeDoubleBE',
  // Utility methods
  'toString', 'toJSON', 'equals', 'compare', 'copy', 'slice',
  'write', 'fill', 'swap16', 'swap32', 'swap64',
  'readUintLE', 'readUintBE', 'writeUintLE', 'writeUintBE',
];

for (const m of methodsToPatch) {
  if (typeof bp[m] === 'function' && typeof up[m] !== 'function') {
    up[m] = bp[m];
  }
}

// Ensure process.env exists (some Solana libs check it)
if (typeof process === 'undefined') {
  (global as any).process = { env: {} };
} else if (!process.env) {
  process.env = {} as any;
}
