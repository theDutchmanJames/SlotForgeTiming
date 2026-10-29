const H = require('../renderer/hardware.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
ok('hex', H.hex([0, 15, 255]) === '00 0f ff');
ok('ascii shows dots for unprintable bytes', H.ascii([72, 105, 0, 10]) === 'Hi..');
ok('a log line has time, direction, size, hex and text', H.line(1234, '<-', [65, 66], 'report 1').includes('1.234  <-    2 B  41 42  report 1  |AB|'));
ok('parseHex: spaced, joined, 0x style', H.parseHex('01 0a FF').join() === '1,10,255' && H.parseHex('010aff').join() === '1,10,255' && H.parseHex('0x01, 0x0A').join() === '1,10');
ok('parseHex: rubbish is refused', H.parseHex('xyz') === null && H.parseHex('') === null && H.parseHex('abc') === null);
ok('describe a device', H.describe('serial', { usbVendorId: 0x0403, usbProductId: 0x6001 }) === 'COM port (USB 0403:6001)' && H.describe('hid', { vendorId: 1, productId: 2, productName: 'TM' }).includes('TM (0001:0002)'));
ok('setup commands for 2 lanes, normally closed, debounce 1: A2, C1, D1, I0, S, each ending in LF', H.trackmateInit({ lanes: 2, closed: true, debounce: 1 }).map(b => H.hex(b)).join('|') === '41 32 0a|43 31 0a|44 31 0a|49 30 0a|53 0a');
ok('setup values are limited (1-8 lanes, debounce 0-9, sensor type)', H.trackmateInit({ lanes: 20, closed: false, debounce: 99 }).map(b => String.fromCharCode(...b).trim()).join() === 'A8,C0,D9,I0,S');
ok('power commands: normally closed relay on = R, off = E; normally open is the other way round', H.hex(H.trackmatePower(true, true)) === '52 0a' && H.hex(H.trackmatePower(false, true)) === '45 0a' && H.hex(H.trackmatePower(true, false)) === '45 0a' && H.hex(H.trackmatePower(false, false)) === '52 0a');
ok('notes: Trackcall, lane sensors, time digits', H.trackmateNote([87]) === '[Trackcall button]' && H.trackmateNote([65, 66]) === '[lane 1 sensor, lane 2 sensor]' && H.trackmateNote([0x31, 13]).includes('digit 1'));
{
  const P = H.trackmateParser(), ev = [], bytes = s => Array.from(s, c => c.charCodeAt(0));
  [['2'], ['00\n\r'], ['200\n\r'], ['20'], ['0'], ['\n\r'], ['A'], ['W'], ['200\n\r'], ['187\n\r']].forEach(c => P.feed(bytes(c[0])).forEach(e => ev.push(e)));
  ok('parser: ticks arrive in any pieces', ev.filter(e => e.type === 'tick').map(e => e.ms).join() === '200,200,200,200,187');
  ok('parser: lane A and the Trackcall button are separate events, not part of a tick', ev.some(e => e.type === 'lane' && e.lane === 1) && ev.some(e => e.type === 'call') && ev.length === 7);
  ok('parser: rubbish is reported as unknown', P.feed([0x7e]).map(e => e.type).join() === 'other');
}
// ---- DS Electronics (listening version) ----
ok('the DS models are those of Race Coordinator\'s setup screen, in its order', H.DS_TYPES.map(t => t[1]).join() === 'DS-030,DS-200,DS-200b,DS-300,DS-300 RC' && new Set(H.DS_TYPES.map(t => t[0])).size === 5 && H.DS_TYPES.every(t => /^[a-z0-9]+$/.test(t[0])));
ok('a model id gives its name, anything else gives nothing', H.dsTypeName('ds300') === 'DS-300' && H.dsTypeName('ds300rc') === 'DS-300 RC' && ['', 'ds999', undefined, null, 'constructor', '__proto__'].every(v => H.dsTypeName(v) === ''));
ok('the speeds to choose from go up, and include 9600 and the speeds of old serial devices', H.BAUDS.every((b, i, a) => i === 0 || b > a[i - 1]) && H.BAUDS.includes(9600) && H.BAUDS.includes(1200) && H.BAUDS.includes(115200));
ok('serial settings: 9600 baud, 8 data bits, no parity, 1 stop bit, DTR and RTS on when nothing is said', JSON.stringify(H.serialConfig()) === '{"baud":9600,"data":8,"parity":"none","stop":1,"dtr":true,"rts":true}' && JSON.stringify(H.serialConfig({})) === JSON.stringify(H.serialConfig(null)));
ok('...values from a selection list (they are text) are understood', JSON.stringify(H.serialConfig({ baud: '19200', data: '7', parity: 'odd', stop: '2' })) === '{"baud":19200,"data":7,"parity":"odd","stop":2,"dtr":true,"rts":true}');
ok('...DTR and RTS are off only when they are exactly false', H.serialConfig({ dtr: false }).dtr === false && H.serialConfig({ rts: false }).rts === false && ['', 0, null, undefined, 'no'].every(v => H.serialConfig({ dtr: v, rts: v }).dtr === true && H.serialConfig({ dtr: v, rts: v }).rts === true));
ok('...anything unusual falls back to the standard value', JSON.stringify(H.serialConfig({ baud: 12345, data: 9, parity: 'mark', stop: 3 })) === JSON.stringify(H.serialConfig()) && H.serialConfig({ baud: 'fast' }).baud === 9600 && H.serialConfig({ baud: -9600 }).baud === 9600);
ok('the version of the app is read from the user agent of the window (Electron puts it there), also with the name written differently', H.appVersion('Mozilla/5.0 SlotForge-Timing/0.66.0 Chrome/130.0 Electron/33.0.0 Safari/537.36') === '0.66.0' && H.appVersion('x slotforge-timing/1.2.3 y') === '1.2.3' && H.appVersion('SlotForge Timing/10.20.30') === '10.20.30');
ok('...and nothing is made up when it is not there', ['Mozilla/5.0 Chrome/130 Safari/537.36', '', undefined, null, 'SlotForge-Timing/x.y.z', 'other-app/1.2.3'].every(v => H.appVersion(v) === ''));
{
  const when = new Date(2026, 9, 13, 0, 5, 9), info = { usbVendorId: 0x0403, usbProductId: 0x6001 }, head = H.dsHeader({ version: '0.66.0', when, type: 'ds300', info }).split('\r\n');
  ok('the top of a capture says the app and version, the time it was saved (on this computer), the model and the port', head[0] === 'SlotForge Timing 0.66.0 - DS Electronics capture' && head[1] === 'Saved: 2026-10-13 00:05:09 (the time on this computer)' && head[2] === 'Unit: DS-300' && head[3] === 'Port: COM port (USB 0403:6001)');
  ok('...then explains the columns and the kinds of line, so the person reading it needs to be told nothing else', head.length === 6 && /seconds since connecting/.test(head[4]) && /<-/.test(head[4]) && /hex/.test(head[4]) && /LINES/.test(head[5]) && /NOTE/.test(head[5]) && /connected/.test(head[5]));
  ok('...without a known version the line has no version (and no question mark), without a model or port it says so', H.dsHeader({ when, type: 'ds300', info }).split('\r\n')[0] === 'SlotForge Timing - DS Electronics capture' && /Unit: not chosen/.test(H.dsHeader({ when })) && /Port: no port chosen/.test(H.dsHeader({ when })) && /Saved: \?/.test(H.dsHeader({})) && /Saved: \?/.test(H.dsHeader({ when: new Date('x') })) && H.dsHeader().includes('Unit: not chosen'));
  ok('...a model that does not exist is not named', /Unit: not chosen/.test(H.dsHeader({ type: 'ds999', when })) && !H.dsHeader({ type: '<b>', when }).includes('<b>'));
  const text = H.dsCapture({ version: '0.66.0', when, type: 'ds200b', info }, ['  1.000  <-    1 B  41  |A|', '          -- note --']);
  ok('a saved capture is the top, an empty line, the log lines, all with Windows line ends, and ends with a line end', text.startsWith(H.dsHeader({ version: '0.66.0', when, type: 'ds200b', info }) + '\r\n\r\n  1.000  <-    1 B  41  |A|\r\n          -- note --') && text.endsWith('-- note --\r\n') && !/[^\r]\n/.test(text));
  ok('...an empty log still gives a readable file', H.dsCapture({ when }, []).endsWith('\r\n\r\n') && H.dsCapture({ when }).includes('DS Electronics capture'));
}
ok('the file name has the model in it, and nothing else can get in', H.dsFileName('ds200b') === 'ds-electronics-ds200b-log.txt' && H.dsFileName('ds300rc') === 'ds-electronics-ds300rc-log.txt' && ['', undefined, '../../x', 'ds999', 'ds300/..'].every(v => H.dsFileName(v) === 'ds-electronics-unit-log.txt'));
// ---- 1.39.0: which timing hardware is in use (one at a time) ----
{ const c = H.timingChosen;
  ok('the choices are None, Trackmate, Arduino box, Parallel Port, Phidget and Plugin interface, in this order', H.TIMING.map(t => t[0]).join() === 'none,trackmate,arduino,parallel,phidget,plugin' && H.TIMING.every(t => typeof t[1] === 'string' && t[1]));
  ok('a choice that was made is the answer, whatever else is set up', c({ timingHw: 'none' }) === 'none' && c({ timingHw: 'arduino', tmDevice: { vid: 1 } }) === 'arduino' && c({ timingHw: 'trackmate', abVirtual: true }) === 'trackmate');
  ok('before anything was chosen it is the Trackmate (the only hardware before the Arduino box), also for a Trackmate that was never remembered (a HID one)', c({}) === 'trackmate' && c(undefined) === 'trackmate' && c({ tmDevice: { vid: 1, pid: 2 } }) === 'trackmate');
  ok('...unless the virtual box is ticked, or a box is remembered and no Trackmate is', c({ abVirtual: true }) === 'arduino' && c({ abVirtual: true, tmDevice: { vid: 1 } }) === 'arduino' && c({ abDevice: { vid: 9 } }) === 'arduino' && c({ abDevice: { vid: 9 }, tmDevice: { vid: 1 } }) === 'trackmate' && c({ abVirtual: false }) === 'trackmate');
  ok('...a value that is not one of the choices is ignored', c({ timingHw: 'ds' }) === 'trackmate' && c({ timingHw: '' }) === 'trackmate' && c({ timingHw: 'ds', abVirtual: true }) === 'arduino'); }
console.log(fails ? fails + ' FAILED' : 'hardware: all PASSED'); process.exit(fails ? 1 : 0);
