'use strict';
// 2.4.0: on Node.js 24.22 (a newer SQLite) the JSON made by a sub-query, such as the list of participants built with json_group_array inside
// json_object, came out as text: the reads of the car library failed with "participants.some is not a function". json(...) around the
// sub-query keeps it JSON on every SQLite version.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOTS = [path.join(__dirname, '..', 'vendor', 'slotforge-library', 'engine', 'src'), path.join(__dirname, '..')];
const files = () =>
  ROOTS.flatMap(dir =>
    fs
      .readdirSync(dir)
      .filter(f => /\.c?js$/.test(f))
      .map(f => path.join(dir, f))
  );

test("no value inside json_object comes straight from a sub-query's json_group_array: it is wrapped in json(...)", () => {
  const bad = [];
  for (const file of files()) {
    const text = fs.readFileSync(file, 'utf8');
    if (/',\s*\(SELECT json_group_(array|object)\(/.test(text)) bad.push(path.basename(file));
  }
  assert.deepEqual(bad, []);
});

test('with json(...) the participants are a list on this SQLite as well', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE s(json TEXT); INSERT INTO s VALUES('{"payload":{"participants":[{"id":"a"},{"id":"b"}]}}')`);
  const row = db
    .prepare(
      `SELECT json_object('participants',json((SELECT json_group_array(json_object('id',json_extract(p.value,'$.id'))) FROM json_each(s.json,'$.payload.participants') p))) json FROM s`
    )
    .get();
  assert.deepEqual(JSON.parse(row.json).participants, [{ id: 'a' }, { id: 'b' }]);
  db.close();
});
