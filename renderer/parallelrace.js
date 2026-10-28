// A race uses the same crossing, pit, flag and power actions as the other timing interfaces.
(function (root) {
  function bind(o) {
    const L = o.link; let closed = false, lease = null, ownedLease = null, acquiring = false, wantPower = o.setup.startPower !== 'off', last = '', lastCount = 0, lastPhase = '', connectionVersion = 0, beep = false, beepTimer = null;
    const blocked = new Set(), report = x => { if (!closed && o.onError) o.onError(x); };
    const carOf = lane => o.cars().findIndex(c => c && c.lane === lane);
    const enabled = () => !closed && (!o.enabled || o.enabled());
    function clearPits() { for (const lane of blocked) { const i = carOf(lane); if (i >= 0) o.unblockCar(i); } blocked.clear(); }
    function sync() {
      if (!enabled() || !L.connected || lease === null) return;
      const phase = o.phase(), count = phase === 'countdown' ? Math.max(0, Math.min(5, o.lights() | 0)) : 0, flag = o.flag(), running = phase === 'running', finished = ['finished', 'review', 'between'].includes(phase);
      if (o.resetInputsOnRun && running && lastPhase !== 'running') L.rearm({ keepBlocked: [...blocked] });
      if ((phase === 'countdown' && count > lastCount) || (running && lastPhase === 'countdown')) {
        beep = true; clearTimeout(beepTimer); beepTimer = setTimeout(() => { beep = false; sync(); }, running ? 300 : 120);
      }
      lastCount = count; lastPhase = phase;
      const power = wantPower && !finished && (!o.powerAllowed || o.powerAllowed());
      const wants = { master: power, power, go: running && !flag, yellow: flag === 'yellow', red: flag === 'red' || phase === 'paused' || finished, buzzer: beep };
      for (let i = 1; i <= 5; i++) wants['start' + i] = phase === 'countdown' && count >= i;
      for (let lane = 0; lane < L.config.lanes; lane++) { const car = o.cars().find(c => c && c.lane === lane); wants['relay' + (lane + 1)] = power && !!car && !car.retired && !car.dq && (!o.laneAllowed || o.laneAllowed(lane)); }
      const key = JSON.stringify(wants); if (key === last) return; last = key;
      Promise.resolve(o.outputs(wants, lease)).catch(x => { last = ''; report(x); });
      L.setPower(power);
    }
    async function acquire() {
      if (!enabled() || !L.connected || lease !== null || acquiring) return;
      acquiring = true; const version = connectionVersion;
      try {
        const result = await o.acquire(ownedLease);
        if (!enabled()) { await o.release(result.lease); return; }
        ownedLease = result.lease;
        if (!L.connected || version !== connectionVersion) return;
        lease = result.lease; L.rearm(); last = ''; sync();
      } catch (x) { report(x); } finally { acquiring = false; if (version !== connectionVersion && enabled() && L.connected && lease === null) acquire(); }
    }
    const off = L.on(e => {
      if (!enabled() || lease === null) return;
      const phase = o.phase(), i = carOf(e.lane);
      if (e.type === 'call') { o.trackcall(); return; }
      if (phase !== 'running' || i < 0) { if (i >= 0 && (e.type === 'free' || (e.type === 'pit' && !e.in)) && blocked.has(e.lane)) { o.unblockCar(i, e.at); blocked.delete(e.lane); } return; }
      if (e.type === 'hit') o.crossCar(i, e.at, e.shared === true && !o.tokens);
      else if (!o.tokens && (e.type === 'block' || (e.type === 'pit' && e.in))) { blocked.add(e.lane); if (e.type === 'block') o.holdCar(i, e.at); else o.blockCar(i, e.at); }
      else if (!o.tokens && (e.type === 'free' || (e.type === 'pit' && !e.in))) { blocked.delete(e.lane); o.unblockCar(i, e.at); }
    });
    let wasConnected = L.connected;
    const offStatus = L.onStatus(() => { const disconnected = wasConnected && !L.connected; if (wasConnected !== L.connected) connectionVersion++; wasConnected = L.connected; if (!L.connected) { lease = null; last = ''; if (disconnected && o.onDisconnected) { wantPower = false; o.onDisconnected(); } clearPits(); } else acquire(); });
    L.setHold(o.pitMs); acquire();
    return { sync, power: on => { wantPower = !!on; sync(); }, ready: () => lease !== null, off: () => { closed = true; off(); offStatus(); clearTimeout(beepTimer); clearPits(); const old = ownedLease; lease = ownedLease = null; if (old !== null) Promise.resolve(o.release(old)).catch(report); } };
  }
  const api = { bind }; root.ParallelRace = api; if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
