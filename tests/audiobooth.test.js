'use strict';
// 2.4.0: the audio set editor as a Commentary Booth (renderer/audiobooth.js, audioboothview.js, audiostudio.js, SlotForgeRestyle.md "Commentary Booth"): the voice
// first with the speaker and a sentence to hear, the presets as cards, how every driver's name is said (written as it sounds or recorded), a sample race,
// and the editor that keeps its place.
const test = require('node:test'),
  assert = require('node:assert/strict');
const AB = require('../renderer/audiobooth.js');
const Sound = require('../renderer/sound.js');
const { code, has } = require('./source.cjs');

test('the presets as cards: how many calls each has on, what changes, and the one the set is closest to', () => {
  const ids = Object.keys(Sound.defaultSet().calls);
  const club = Sound.profile(Sound.defaultSet(), 'Club');
  const P = AB.presets(club, Sound.profile, ids);
  assert.deepEqual(
    P.list.map(p => p.name),
    ['Essential', 'Club', 'Broadcast']
  );
  assert.equal(P.closest, 'Club');
  assert.equal(P.list[1].differ, 0, 'a set that is the Club preset: nothing differs');
  assert(P.list[0].on < P.list[1].on && P.list[1].on < P.list[2].on, 'Essential < Club < Broadcast');
  assert(P.list[0].goOff > 0 && P.list[2].comeOn > 0);
  const html = AB.presetCardsHtml(P);
  assert.match(html, /<article class="ab-pre on"><b>Club<\/b>/);
  assert.match(html, /This is your set/);
  assert.match(html, /data-audio-preset="Broadcast">Use Broadcast<\/button>/);
});

test('a name as it is said: written as it sounds, or a recording marked in the sentence, played in pieces', () => {
  const names = { b: { say: 'Byorn', name: 'Bjorn' }, c: { file: 'data:audio/wav;base64,AA', name: 'Chris' } };
  assert.equal(AB.spoken(names, 'b', 'Bjorn'), 'Byorn');
  assert.equal(AB.spoken(names, 'x', 'Anna'), 'Anna', 'as written');
  assert.equal(AB.spoken(names, 'c', 'Chris'), '⟦c⟧');
  assert.deepEqual(AB.pieces('New leader: ⟦c⟧!', names), [
    { text: 'New leader: ' },
    { file: 'data:audio/wav;base64,AA', id: 'c' },
    { text: '!' }
  ]);
  assert.equal(AB.plainText('New leader: ⟦c⟧!', names), 'New leader: Chris!');
  const rows = AB.namesHtml(
    [
      { id: 'b', name: 'Bjorn', callsign: 'BJO' },
      { id: 'c', name: 'Chris' }
    ],
    names
  );
  assert.match(rows, /data-name-say="b" value="Byorn"/);
  assert.match(rows, /data-name-record="b"/);
  assert.match(rows, /✓ Recorded<\/span><button type="button" class="btn sm ghost" data-name-clear="c">/);
});

test('the sound engine plays a recorded name inside a sentence, and the speaker it plays on', async () => {
  const heard = [];
  Sound.state.backend = {
    voices: () => [],
    speak: (t, o, done) => {
      heard.push(t);
      done();
    },
    file: (u, o, done) => {
      heard.push('[file]');
      done();
    },
    stop() {}
  };
  const set = { ...Sound.defaultSet(), names: { c: { file: 'data:audio/wav;base64,AA', name: 'Chris' } } };
  set.calls.newleader = { on: true, lines: [{ text: 'New leader: {driver}!', mode: 'text' }] };
  Sound.say(set, 'newleader', { driver: '⟦c⟧' });
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(heard, ['New leader: ', '[file]', '!']);
  assert.equal(typeof Sound.sink, 'function');
  assert(has(code('renderer/sound.js'), "if (sinkId && a && typeof a.setSinkId === 'function') a.setSinkId(sinkId).catch(() => {});"));
  Sound.stop();
});

test('the sample race: the start, a new leader, a fastest lap, a yellow flag, the last lap and the winner, with the names as they are said', () => {
  const steps = AB.sampleRace(
    [
      { id: 'a', name: 'Anna' },
      { id: 'b', name: 'Bjorn' }
    ],
    { names: { b: { say: 'Byorn' } } }
  );
  assert.deepEqual(
    steps.filter(s => s.title).map(s => s.title),
    ['Before the start', 'Start lights', 'Lights out', 'New leader', 'Fastest lap', 'Yellow flag', 'Last lap', 'Winner']
  );
  assert.equal(steps.find(s => s.id === 'fastestlap').vars.driver, 'Byorn');
  assert.equal(steps.find(s => s.id === 'newleader').vars.driver, 'Anna');
  const html = AB.sampleHtml(steps, 0, { prerace: true, newleader: 'now' });
  assert.match(html, /class="ab-tr done"[^]*Before the start[^]*said/);
  assert.match(html, /class="ab-tr now"[^]*New leader[^]*● speaking/);
});

test('the editor: the booth first, Driver names in the rail, the presets under the voice, the names said in a race, the place kept', () => {
  const st = code('renderer/audiostudio.js'),
    ed = code('renderer/audioedit.js'),
    an = code('renderer/announcer.js'),
    view = code('renderer/audioboothview.js');
  assert(has(st, "let audioView = { tab: 'mix',"), 'the editor opens on the voice and the presets');
  assert(has(st, "railItem('data-audio-tab=\"names\"', 'driver', 'Driver names'"));
  assert(has(st, 'AudioBooth.presetCardsHtml(AudioBooth.presets(d, Sound.profile, Announcer.CALLS.map(c => c.id)))'));
  assert(has(an, "if (n && n.file) return '⟦' + id + '⟧';"), 'the race says a name as the set says it');
  assert(has(ed, "return typeof audioKeepPlace === 'function' ? audioKeepPlace(() => drawAudioSetEditor(box)) : drawAudioSetEditor(box);"));
  assert(has(view, 'const recorder = new MediaRecorder(stream),'), 'a name is recorded with the microphone');
  const html = code('renderer/index.html');
  assert(
    html.indexOf('audiobooth.js') < html.indexOf('audiostudio.js') && html.indexOf('audioboothview.js') < html.indexOf('audioedit.js')
  );
});
