// A virtual DS-200 / DS-300 box (2.3.0), for trying DS race timing without the hardware. It sends what a real box sends on the wire: 21-byte frames,
// a first-crossing marker for each lane, then one frame per lap with the lap counter and the lap time the box measured. Imaginary cars lap with a little
// noise; it never stops on its own (as a real DS cannot switch off the track). Nothing it is sent changes it: Timing sends the DS no commands.
// Pure apart from asPort(): tick(now) moves the cars, onData(cb) gets the bytes; asPort() makes it look like a Web Serial port for the DS page.
(function (root) {
  const SIZE = 21,
    RESERVED = [0xe0, 0xeb];
  const LANE_CODES = { ds200: [1, 2], ds300: [128, 64, 32, 16, 8, 4, 2, 1] };
  const bcd = n => ((Math.floor(n / 10) % 10) << 4) | (n % 10);
  const checksum = f => {
    let sum = f[19];
    for (let i = 1; i < 18; i++) sum += f[i];
    return sum & 255;
  };
  // one frame: { model, seq, lane (1..), counter, ms (the lap time) | marker: true }
  function frame(o) {
    const f = new Uint8Array(SIZE),
      codes = LANE_CODES[o.model] || LANE_CODES.ds300;
    f[0] = 0xe0;
    f[1] = o.seq & 255;
    f[2] = SIZE;
    f[3] = o.model === 'ds200' ? 2 : 3;
    f[7] = 0x1b;
    f[10] = codes[o.lane - 1];
    const n = Math.max(0, Math.floor(o.counter)) % 10000;
    f[11] = bcd(Math.floor(n / 100));
    f[12] = bcd(n % 100);
    if (o.marker) [0, 0xaa, 0xab, 0xaa, 0xaa].forEach((v, i) => (f[13 + i] = v));
    else {
      const t = Math.max(1, Math.round(o.ms * 10)); // (ten-thousandths of a second)
      const h = Math.floor(t / 36e6),
        m = Math.floor(t / 6e5) % 60,
        s = Math.floor(t / 1e4) % 60,
        hund = Math.floor(t / 100) % 100,
        tenk = t % 100;
      [h, m, s, hund, tenk].forEach((v, i) => (f[13 + i] = bcd(v)));
    }
    f[18] = checksum(f);
    while (RESERVED.includes(f[18]) || RESERVED.includes(f[19])) {
      f[19] = (f[19] + 1) & 255;
      f[18] = checksum(f);
    }
    f[20] = 0xeb;
    return f;
  }
  const BASE = [5200, 5450, 5050, 5700, 5350, 5900, 5600, 5150];
  function createSim(o = {}) {
    const model = o.model === 'ds200' ? 'ds200' : 'ds300',
      max = LANE_CODES[model].length,
      lanes = Math.max(1, Math.min(max, Math.floor(Number(o.lanes)) || (model === 'ds200' ? 2 : 4))),
      clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now())),
      rnd = o.random || Math.random,
      listeners = new Set();
    const S = {
      model,
      lanes,
      cars: Array.from({ length: lanes }, (_, i) => ({
        lane: i + 1,
        lapMs: BASE[i % BASE.length],
        noise: 250,
        next: null,
        counter: 0,
        marked: false
      })),
      seq: 0,
      running: false,
      sent: 0
    };
    const send = bytes => {
      S.sent++;
      listeners.forEach(f => f(bytes));
    };
    S.onData = f => {
      listeners.add(f);
      return () => listeners.delete(f);
    };
    S.write = () => {}; // (a DS takes no commands from Timing)
    const lapMs = c => Math.max(1500, Math.round(c.lapMs + (rnd() * 2 - 1) * c.noise));
    S.start = (t = clock()) => {
      S.running = true;
      S.cars.forEach((c, i) => (c.next = t + 1200 + i * 180)); // (the cars set off one after another, so the first crossings do not all come at once)
    };
    S.stop = () => {
      S.running = false;
    };
    S.tick = (t = clock()) => {
      if (!S.running) return;
      S.cars.forEach(c => {
        while (c.next !== null && t >= c.next) {
          S.seq = (S.seq + 1) & 255;
          if (RESERVED.includes(S.seq)) S.seq = (S.seq + 1) & 255;
          const ms = lapMs(c);
          if (!c.marked) {
            c.marked = true;
            send(frame({ model, seq: S.seq, lane: c.lane, counter: 0, marker: true }));
          } else {
            c.counter++;
            send(frame({ model, seq: S.seq, lane: c.lane, counter: c.counter, ms: c.lastMs }));
          }
          c.lastMs = ms;
          c.next += ms;
        }
      });
    };
    S.asPort = (tickMs = 20) => {
      let ctrl = null,
        timer = null,
        off = null;
      const port = {
        virtual: true,
        getInfo: () => ({ virtual: true }),
        async open() {
          port.readable = new ReadableStream({
            start(c) {
              ctrl = c;
              off = S.onData(b => {
                try {
                  ctrl.enqueue(b);
                } catch (x) {
                  /* closed */
                }
              });
            },
            cancel() {
              if (off) off();
            }
          });
          port.writable = new WritableStream({ write() {} });
          if (!S.running) S.start();
          timer = setInterval(() => S.tick(), tickMs);
        },
        async close() {
          clearInterval(timer);
          timer = null;
          if (off) {
            off();
            off = null;
          }
          try {
            if (ctrl) ctrl.close();
          } catch (x) {
            /* already closed */
          }
          ctrl = null;
          port.readable = null;
          port.writable = null;
        },
        async setSignals() {},
        async getSignals() {
          return { clearToSend: true, dataSetReady: true, dataCarrierDetect: false, ringIndicator: false };
        },
        readable: null,
        writable: null,
        sim: S
      };
      return port;
    };
    return S;
  }
  const api = { createSim, frame };
  root.DsSim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
