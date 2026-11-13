// DS-200/DS-300 21-byte protocol, independently expressed from interoperability research.
// Synthetic replay verified; physical DS hardware qualification is still outstanding.
(function(root) {
'use strict';
const SIZE = 21;
const isBytes = value => ArrayBuffer.isView(value) && Object.prototype.toString.call(value) === '[object Uint8Array]';
function checksum(bytes) {
  let sum = bytes[19];
  for (let i = 1; i < 18; i++) sum += bytes[i];
  return sum & 255;
}
function bcd(byte) {
  const hi = byte >>> 4, lo = byte & 15;
  if (hi > 9 || lo > 9) throw new Error('Invalid BCD');
  return hi * 10 + lo;
}
function decodeFrame(bytes, model) {
  if (model !== 'ds200' && model !== 'ds300') throw new Error('Unsupported DS timing model');
  if (!isBytes(bytes) || bytes.length !== SIZE) throw new Error('Expected 21 bytes');
  if (bytes[0] !== 0xe0 || bytes[20] !== 0xeb || bytes[2] !== SIZE) throw new Error('Invalid framing');
  if (checksum(bytes) !== bytes[18]) throw new Error('Invalid checksum');
  const base = { sequence: bytes[1], type: bytes[7], deviceByte: bytes[3] };
  // Preserve control codes rather than giving them authority over a real race.
  if (bytes[7] === 0) {
    const names = { 161: 'start-phase-1', 162: 'start-phase-2', 163: 'start-phase-3',
      164: 'end', 165: 'pause', 166: 'end-pause', 167: 'abort' };
    return { ...base, kind: 'control', code: bytes[8], action: names[bytes[8]] || 'unknown' };
  }
  if (bytes[7] !== 0x1b) return { ...base, kind: 'other' };
  const codes = model === 'ds200' ? [1, 2] : [128, 64, 32, 16, 8, 4, 2, 1];
  const lane = codes.indexOf(bytes[10]) + 1;
  if (!lane) throw new Error('Invalid lane');
  const counter = bcd(bytes[11]) * 100 + bcd(bytes[12]);
  const reaction = [0, 0xaa, 0xab, 0xaa, 0xaa].every((v, i) => bytes[13 + i] === v);
  if (reaction) return { ...base, kind: 'first-crossing-marker', lane, counter, timeTicks: null };
  const [hours, minutes, seconds, hundredths, tenThousandths] = Array.from(bytes.slice(13, 18), bcd);
  if (minutes >= 60 || seconds >= 60) throw new Error('Invalid time');
  const timeTicks = ((hours * 60 + minutes) * 60 + seconds) * 10000 + hundredths * 100 + tenThousandths;
  return { ...base, kind: 'lap', lane, counter, timeTicks };
}
class FrameStream {
  constructor(model) {
    if (!['ds200', 'ds300'].includes(model)) throw new Error('Unsupported DS timing model');
    this.model = model;
    this.pending = [];
    this.rejectedCandidates = 0;
  }
  push(chunk) {
    if (!isBytes(chunk)) throw new Error('Expected bytes');
    const events = [];
    for (const byte of chunk) {
      if (!this.pending.length && byte !== 0xe0) continue;
      this.pending.push(byte);
      // Reject an impossible length immediately. Noise is an ordinary input condition,
      // not an exception per byte (important for noisy serial streams).
      if (this.pending.length >= 3 && this.pending[2] !== SIZE) {
        this.rejectedCandidates++;
        const next = this.pending.indexOf(0xe0, 1);
        this.pending = next < 0 ? [] : this.pending.slice(next);
        continue;
      }
      if (this.pending.length < SIZE) continue;
      if (this.pending[20] !== 0xeb || checksum(this.pending) !== this.pending[18]) {
        this.rejectedCandidates++;
        const next = this.pending.indexOf(0xe0, 1);
        this.pending = next < 0 ? [] : this.pending.slice(next);
        continue;
      }
      try {
        events.push(decodeFrame(Uint8Array.from(this.pending), this.model));
      } catch {
        // A complete, checksum-valid frame with unsupported/invalid values still
        // owns its payload. Do not reinterpret an embedded E0 as a fresh packet.
        this.rejectedCandidates++;
      }
      this.pending.length = 0;
    }
    return events;
  }
}

const api = { checksum, decodeFrame, FrameStream };
root.DsProtocol=api;
if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
