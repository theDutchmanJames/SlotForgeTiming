'use strict';
// Paddock can move the shared library to another folder (Settings > Database) while Timing runs. The engine then answers a call on the handle that was
// opened before the move with LIBRARY_MOVED (details.movedTo: the new file), or LIBRARY_BUSY while the move is still going on (CONTRACT.md, "Moving the
// library"). This handle stands in for the engine's own: it passes every call on, and
//  - on LIBRARY_MOVED closes the old handle, opens the library again (open() follows library.json to the new file) and makes the same call again, with
//    the same input: the engine checks the file before every call, so the refused call did nothing, and its operation ID stays the same;
//  - on LIBRARY_BUSY waits a moment and tries again (for up to half a minute).
// Several calls that meet the move together share one reopening. The database and recovery IDs do not change with a move, so everything else the app
// keeps (receipts, operation IDs, aliases) stays valid. Without it, every call failed until Timing was restarted.
const MOVED = 'LIBRARY_MOVED',
  BUSY = 'LIBRARY_BUSY';

// first: the open engine handle; reopen(): opens the library again; o: { busyWaitMs, busyTries, onMoved(info), wait }
function relocatable(first, reopen, o = {}) {
  let current = first,
    reopening = null,
    closed = false;
  const busyWaitMs = o.busyWaitMs ?? 500,
    busyTries = o.busyTries ?? 60,
    wait = o.wait || (ms => new Promise(r => setTimeout(r, ms)));
  async function follow(stale, error) {
    if (current !== stale) return; // (another call has opened it again already)
    if (!reopening)
      reopening = (async () => {
        try {
          await stale.close();
        } catch {
          /* the old handle may already be gone */
        }
        const next = await reopen();
        if (closed) {
          await next.close().catch(() => {});
          throw Object.assign(Error('Library handle is closed.'), { code: 'LIBRARY_CLOSED' });
        }
        current = next;
        if (o.onMoved) o.onMoved({ movedTo: error?.details?.movedTo || null });
      })().finally(() => {
        reopening = null;
      });
    await reopening;
  }
  // (fn: the function as it was taken from the handle; it is used for as long as that handle is the one in use, so a method that was replaced by
  // a stand-in and called from it does not call the stand-in again)
  async function call(name, args, from, fn) {
    let moves = 0,
      busy = 0;
    for (;;) {
      if (reopening) await reopening.catch(() => {}); // (a call that starts during a reopening waits for the new handle)
      const handle = current;
      try {
        return await (handle === from ? fn : handle[name]).apply(handle, args);
      } catch (e) {
        if (closed) throw e;
        if (e && e.code === MOVED && moves++ < 3) {
          await follow(handle, e);
          continue;
        }
        if (e && e.code === BUSY && busy++ < busyTries) {
          await wait(busyWaitMs);
          continue;
        }
        throw e;
      }
    }
  }
  return new Proxy(
    {},
    {
      get(_, name) {
        if (name === 'close')
          return async () => {
            closed = true;
            if (reopening) await reopening.catch(() => {});
            return current.close();
          };
        if (name === 'then') return undefined; // (not a promise)
        const from = current,
          value = from[name];
        return typeof value === 'function' ? (...args) => call(name, args, from, value) : value;
      },
      has(_, name) {
        return name in current;
      },
      // (a method put on the handle goes on the engine's handle itself, as before: the tests put stand-ins there)
      set(_, name, value) {
        current[name] = value;
        return true;
      },
      deleteProperty(_, name) {
        return delete current[name];
      }
    }
  );
}
module.exports = { relocatable, MOVED, BUSY };
