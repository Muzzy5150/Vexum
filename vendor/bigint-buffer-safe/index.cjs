'use strict';
// Independent implementation of the public four-function API. No native addon,
// allocation of uninitialized output, input mutation, or silent truncation.
const MAX_BYTES = 1024 * 1024;
function input(value) {
  if (!(value instanceof Uint8Array)) throw new TypeError('Expected byte array');
  if (value.byteLength > MAX_BYTES) throw new RangeError('Integer buffer exceeds 1 MiB');
  return Buffer.from(value);
}
function toBigIntBE(value) {
  const bytes=input(value);
  return bytes.length ? BigInt('0x'+bytes.toString('hex')) : 0n;
}
function toBigIntLE(value) {
  const bytes=input(value);bytes.reverse();
  return bytes.length ? BigInt('0x'+bytes.toString('hex')) : 0n;
}
function toBufferBE(value,width) {
  if (typeof value!=='bigint') throw new TypeError('Expected BigInt');
  if (!Number.isSafeInteger(width)||width<0||width>MAX_BYTES) throw new RangeError('Invalid integer width');
  if (value<0n||value>>(BigInt(width)*8n)) throw new RangeError('Integer does not fit unsigned width');
  if (!width) return Buffer.alloc(0);
  return Buffer.from(value.toString(16).padStart(width*2,'0'),'hex');
}
function toBufferLE(value,width) {return toBufferBE(value,width).reverse();}
module.exports={toBigIntLE,toBigIntBE,toBufferLE,toBufferBE};
