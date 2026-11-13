'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checksum, decodeFrame, FrameStream } = require('../renderer/dsprotocol.js');
// Reconstructed examples, NOT serial captures or hardware certification.
const hex = s => Buffer.from(s.replaceAll(' ', ''), 'hex');
const lap = hex('e0 01 15 03 00 00 00 1b a7 a8 80 00 02 00 00 10 50 00 33 ce eb');
const reaction = hex('e0 00 15 00 00 00 00 1b a7 a8 80 00 01 00 aa ab aa aa 77 ce eb');
const minute = hex('e0 02 15 03 00 00 00 1b a7 a8 01 00 12 00 01 23 45 67 35 ce eb');
const hour = hex('e0 03 15 03 00 00 00 1b a7 a8 40 12 34 01 02 03 04 56 39 ce eb');
const ds200 = hex('e0 04 15 02 00 00 00 1b a7 a8 02 00 02 00 00 10 50 00 b7 ce eb');
const start = hex('e0 05 15 03 00 00 00 00 a3 a8 80 00 01 00 aa ab aa aa 60 ce eb');
test('serial bytes from another JavaScript realm are accepted, unrelated views rejected',()=>{
 const vm=require('node:vm'),bytes=vm.runInNewContext('Uint8Array.from('+JSON.stringify([...lap])+')');
 assert.equal(new FrameStream('ds300').push(bytes)[0].timeTicks,105000);
 assert.throws(()=>new FrameStream('ds300').push(new Uint16Array(21)),/Expected bytes/);
});
function altered(index, value, input = lap) {
  const bytes = Buffer.from(input);
  bytes[index] = value;
  bytes[18] = checksum(bytes);
  return bytes;
}
test('10.5000 s remains 105000 integer ticks', () => {
  assert.deepEqual(decodeFrame(lap, 'ds300'), { sequence: 1, type: 27, deviceByte: 3,
    kind: 'lap', lane: 1, counter: 2, timeTicks: 105000 });
});
test('minutes and four decimal digits', () => {
  assert.equal(decodeFrame(minute, 'ds300').timeTicks, 834567);
});
test('hours and BCD lap counter', () => {
  const event = decodeFrame(hour, 'ds300');
  assert.equal(event.timeTicks, 37230456);
  assert.equal(event.counter, 1234);
});
test('first crossing marker cannot turn into a fastest lap', () => {
  assert.equal(decodeFrame(reaction, 'ds300').kind, 'first-crossing-marker');
  assert.equal(decodeFrame(reaction, 'ds300').timeTicks, null);
});
test('model-specific lane mappings', () => {
  assert.equal(decodeFrame(ds200, 'ds200').lane, 2);
  assert.equal(decodeFrame(ds200, 'ds300').lane, 7);
  assert.equal(decodeFrame(altered(10, 1, ds200), 'ds200').lane, 1);
  for (let lane = 1; lane <= 8; lane++) {
    assert.equal(decodeFrame(altered(10, 128 >> (lane - 1)), 'ds300').lane, lane);
  }
});
test('start, finish, pause, resume and abort remain distinct', () => {
  const actions = ['start-phase-1', 'start-phase-2', 'start-phase-3', 'end', 'pause', 'end-pause', 'abort'];
  actions.forEach((action, i) => assert.equal(decodeFrame(altered(8, 161 + i, start), 'ds300').action, action));
});
test('final-record and unknown frames are not ordinary laps', () => {
  assert.equal(decodeFrame(altered(7, 28), 'ds300').kind, 'other');
  assert.equal(decodeFrame(altered(7, 255), 'ds300').kind, 'other');
});
test('checksum failure is rejected', () => {
  const damaged = Buffer.from(lap); damaged[15] ^= 1;
  assert.throws(() => decodeFrame(damaged, 'ds300'), /checksum/);
});
test('word length and end marker are validated', () => {
  for (const bytes of [altered(2, 20), altered(20, 0), altered(0, 0), lap.subarray(1)]) {
    assert.throws(() => decodeFrame(bytes, 'ds300'));
  }
});
test('bad BCD cannot become a plausible result', () => {
  for (const field of [11, 12, 13, 14, 15, 16, 17]) {
    assert.throws(() => decodeFrame(altered(field, 0xfa), 'ds300'), /BCD/);
  }
});
test('invalid minute and second values rejected', () => {
  assert.throws(() => decodeFrame(altered(14, 0x60), 'ds300'), /time/);
  assert.throws(() => decodeFrame(altered(15, 0x60), 'ds300'), /time/);
});
test('unknown or combined lane codes rejected', () => {
  for (const code of [0, 3, 255]) assert.throws(() => decodeFrame(altered(10, code), 'ds300'), /lane/);
});
test('DS030 and DS0045 are not assumed to use this format', () => {
  for (const model of ['ds030', 'ds0045', undefined]) assert.throws(() => decodeFrame(lap, model), /model/);
});
test('all serial chunk split positions', () => {
  for (let split = 1; split < lap.length; split++) {
    const stream = new FrameStream('ds300');
    assert.deepEqual(stream.push(lap.subarray(0, split)), []);
    assert.deepEqual(stream.push(lap.subarray(split)), [decodeFrame(lap, 'ds300')]);
  }
});
test('byte-at-a-time and concatenated packets', () => {
  const bytes = Buffer.concat([reaction, lap, minute]);
  const stream = new FrameStream('ds300');
  const events = Array.from(bytes).flatMap(byte => stream.push(Uint8Array.of(byte)));
  assert.deepEqual(events.map(e => e.kind), ['first-crossing-marker', 'lap', 'lap']);
  assert.deepEqual(new FrameStream('ds300').push(bytes), events);
});
test('noise and corrupt candidate do not consume the next valid packet', () => {
  const damaged = Buffer.from(lap); damaged[18] ^= 1;
  const stream = new FrameStream('ds300');
  const events = stream.push(Buffer.concat([hex('01 02 e0 99'), damaged, lap]));
  assert.deepEqual(events, [decodeFrame(lap, 'ds300')]);
  assert.ok(stream.rejectedCandidates >= 2);
});
test('markers inside the payload are not treated as unconditional delimiters', () => {
  assert.equal(new FrameStream('ds300').push(altered(1, 0xe0)).length, 1);
  assert.equal(new FrameStream('ds300').push(altered(1, 0xeb)).length, 1);
});
test('retained partial input stays bounded', () => {
  const stream = new FrameStream('ds300');
  assert.deepEqual(stream.push(Buffer.alloc(100000, 0xe0)), []);
  assert.ok(stream.pending.length < 21);
  assert.equal(stream.push(lap).length, 1);
});
test('invalid values in a checksum-valid frame do not leave payload fragments behind', () => {
  const stream = new FrameStream('ds300');
  const invalid = altered(10, 3, altered(1, 0xe0));
  assert.deepEqual(stream.push(invalid), []);
  assert.equal(stream.pending.length, 0);
  assert.equal(stream.rejectedCandidates, 1);
  assert.deepEqual(stream.push(lap), [decodeFrame(lap, 'ds300')]);
});
test('corruption and chunking preserve every subsequent valid frame', () => {
  const damaged = Buffer.from(lap); damaged[18] ^= 1;
  const bytes = Buffer.concat([damaged, reaction, minute, hour, start]);
  const expected = [reaction, minute, hour, start].map(b => decodeFrame(b, 'ds300'));
  for (let size = 1; size <= 50; size++) {
    const stream = new FrameStream('ds300'), got = [];
    for (let offset = 0; offset < bytes.length; offset += size) got.push(...stream.push(bytes.subarray(offset, offset + size)));
    assert.deepEqual(got, expected);
  }
});
