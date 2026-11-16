'use strict';
// Two faults found by running a real keyboard race: the finished race was refused by the shared library for
// sub-microsecond rounding, and the race page went blank after the director finalized or deleted the results.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const M=require('../paddock-rich-mapper');
const {s,L}=require('./fixtures/rich-mapper-rounding/keyboard-race.json');
const db=Object.values(s.paddockJournal.captures)[0].configuration.databaseId;

// 1. The recorded race (crossings at 0.1 ms, lap times from the high-resolution clock) is accepted, with its lap times untouched.
const {bundle}=M.measured(s,L,db),race=bundle.race,laps=race.participants.flatMap(p=>p.laps);
assert.equal(laps.length,L.length);
for(const l of laps)assert(L.some(r=>r.time===l.durationMs),'saved lap time kept exactly');
assert.equal(laps.filter(l=>l.trackRecordEligible).length,L.filter(r=>!r.tooSlow&&!r.invalid).length,'record-eligible laps reach the library');
const duration=Date.parse(race.endedAt)-Date.parse(race.startedAt);
assert(race.heats.every(h=>h.endedAtMs<=duration)&&laps.every(l=>l.endedAtMs<=duration),'the session covers its last crossing');
// every lap starts no earlier than the previous one ended (the library rule), moved by far less than a millisecond
const original=new Map();for(const h of s.paddockJournal.heats)for(const e of h.entries)for(const l of e.laps)original.set(e.carId+'#'+l.number,l.at-Math.min(...s.paddockJournal.heats.map(x=>x.startedAt)));
for(const p of race.participants){let prior=null;for(const l of p.laps){if(prior!==null)assert(l.endedAtMs-l.durationMs>=prior);prior=l.endedAtMs;}}
for(const p of race.participants)for(const l of p.laps){const o=[...original].find(([k])=>k.endsWith('#'+l.number)&&Math.abs(original.get(k)-l.endedAtMs)<1);assert(o,'crossing moved by less than 1 ms');}

// 2. A real contradiction (a lap claiming to start 5 ms before the previous crossing) is still refused.
const broken=structuredClone(s),lap=broken.paddockJournal.heats[0].entries[0].laps[3];lap.time+=5;
const rows=structuredClone(L);rows.find(r=>r.carId===broken.paddockJournal.heats[0].entries[0].carId&&r.lapNumber===4).time=lap.time;
assert.throws(()=>M.measured(broken,rows,db),/overlap or are incomplete/);

// 3. Finalize and "Delete all data" return to the race page instead of leaving both pages hidden.
const race_js=require('./source.cjs').flat(require('./source.cjs').code('renderer/race.js')); // (without spaces, see source.cjs)
const close=/functioncloseReview\(\)\{([^}]*)\}/.exec(race_js);
assert(close,'closeReview exists');
for(const part of ["ui('finishreview').hidden=true","ui('raceactive').hidden=false","live.reviewShown=false"])assert(close[1].includes(part),part);
assert(/functionfinalize\(\)\{if\(live\.phase!=='review'\)return;closeReview\(\);/.test(race_js),'finalize shows the race page again');
assert(/asyncfunctiondiscardAll\(\)\{if\(live\.phase!=='review'\)return;closeReview\(\);/.test(race_js),'delete all data shows the race page again');
assert(!/live\.reviewShown=false;(?!live\.rvHtml)/.test(race_js.replace(close[0],'')),'no other place resets only the flag');
console.log('RACING REVIEW FIXES PASSED: rounding-tolerant library delivery, real overlaps refused, finalize/delete show the race page');
