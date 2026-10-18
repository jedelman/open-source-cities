import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lexicons, jsonToLex } from '@atproto/lexicon';
import { cellToLatLng, getResolution } from 'h3-js';
import {
  NSID, AREA_RESOLUTION, placeOf, makeReport, makeSame, makeProposal, makeClaim, makeDone, makeSignoff,
} from '../src/records.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'lexicons');

function loadLexicons(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return loadLexicons(p);
    return name.endsWith('.json') ? [{ path: p, doc: JSON.parse(readFileSync(p, 'utf8')) }] : [];
  });
}

const files = loadLexicons(ROOT);
const strongRef = {
  lexicon: 1,
  id: 'com.atproto.repo.strongRef',
  defs: { main: { type: 'object', required: ['uri', 'cid'], properties: { uri: { type: 'string', format: 'at-uri' }, cid: { type: 'string', format: 'cid' } } } },
};
// Lexicons rewrites the docs it is given (adds lex: prefixes), so hand it copies.
const lex = new Lexicons(structuredClone([...files.map((f) => f.doc), strongRef]));
const valid = (nsid, body) => lex.assertValidRecord(nsid, { $type: nsid, ...body });

// Test fixtures only: never published. Norfolk is the fixture city.
const DID = 'did:plc:5y6kop75jnvkbujbubrhj6e3';
const CID = 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm';
const ref = (nsid, rkey) => ({ uri: `at://${DID}/${nsid}/${rkey}`, cid: CID });
// An uploaded blob as getRecord returns it (raw codec CID), parsed the way a client would.
const blob = jsonToLex({ $type: 'blob', ref: { $link: 'bafkreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm' }, mimeType: 'image/jpeg', size: 123456 });
const COLLEY_AVE = { lat: 36.868712, lng: -76.302158 };

describe('lexicon files', () => {
  test('each id matches its path, and every record keys on tid', () => {
    for (const { path, doc } of files) {
      const expected = relative(ROOT, path).replace(/\.json$/, '').split('/').join('.');
      assert.equal(doc.id, expected, path);
      if (doc.defs.main?.type === 'record') assert.equal(doc.defs.main.key, 'tid', doc.id);
    }
  });
  test('every ref resolves to a loaded definition', () => {
    const ids = new Set([...files.map((f) => f.doc.id), strongRef.id]);
    const defs = new Set(files.flatMap((f) => Object.keys(f.doc.defs).map((k) => `${f.doc.id}#${k}`)));
    const refs = [];
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (node.type === 'ref') refs.push(node.ref);
      if (node.type === 'union') refs.push(...node.refs);
      Object.values(node).forEach(walk);
    };
    files.forEach((f) => walk(f.doc.defs));
    for (const r of refs) assert.ok(r.includes('#') ? defs.has(r) : ids.has(r), `unresolved ref ${r}`);
  });
});

describe('report', () => {
  test('exact: publishes the point', () => {
    const r = makeReport({ place: COLLEY_AVE, category: ' Pothole ', text: 'Deep one by the crosswalk.' });
    valid(NSID.report, r);
    assert.deepEqual(r.location, { $type: NSID.geo, latitude: '36.868712', longitude: '-76.302158' });
    assert.equal(r.category, 'pothole');
  });

  test('area: publishes only the H3 cell, and no coordinate anywhere', () => {
    const r = makeReport({ place: { ...COLLEY_AVE, precision: 'area' }, category: 'drainage' });
    valid(NSID.report, r);
    assert.equal(r.location.$type, NSID.hthree);
    assert.equal(getResolution(r.location.value), AREA_RESOLUTION);
    const json = JSON.stringify(r);
    for (const leak of ['36.8687', '-76.3021', 'latitude', 'longitude', 'street']) assert.ok(!json.includes(leak), `leaked ${leak}`);
    // The cell still contains the point, so the report lands on the right blocks.
    const [lat, lng] = cellToLatLng(r.location.value);
    assert.ok(Math.abs(lat - COLLEY_AVE.lat) < 0.02 && Math.abs(lng - COLLEY_AVE.lng) < 0.02);
  });

  test('area refuses a street address', () => {
    assert.throws(() => placeOf({ ...COLLEY_AVE, precision: 'area', address: { country: 'US', street: '1 Main St' } }), /area-only/);
  });

  test('address, photos with alt text, and a city reference validate', () => {
    const r = makeReport({
      place: { address: { country: 'US', region: 'VA', locality: 'Norfolk', street: 'Colley Ave & W 21st St' } },
      category: 'flooding',
      images: [{ image: blob, alt: 'Water over the curb at the corner.' }],
      cityRef: { system: 'socrata:data.norfolk.gov/qzfe-wj25', id: 'fixture-0001', url: 'https://data.norfolk.gov/d/qzfe-wj25' },
    });
    valid(NSID.report, r);
  });

  test('refuses photos without alt text, impossible coordinates, and an empty category', () => {
    assert.throws(() => makeReport({ place: COLLEY_AVE, category: 'litter', images: [{ image: blob, alt: '  ' }] }), /alt text/);
    assert.throws(() => makeReport({ place: { lat: 91, lng: 0 }, category: 'litter' }), /real coordinates/);
    assert.throws(() => makeReport({ place: COLLEY_AVE, category: '   ' }), /category/);
  });
});

describe('the chain: report → same → proposal → claim → done → signoff', () => {
  const report = ref(NSID.report, '3m2aaaaaaaa22');
  const other = ref(NSID.report, '3m2bbbbbbbb22');
  const proposal = ref(NSID.proposal, '3m2cccccccc22');
  const claim = ref(NSID.claim, '3m2dddddddd22');
  const done = ref(NSID.done, '3m2eeeeeeee22');

  test('every step validates against its lexicon', () => {
    valid(NSID.same, makeSame({ subject: report, others: [other], text: 'Same hole, opposite lane.' }));
    valid(NSID.proposal, makeProposal({ reports: [report, other], title: 'Patch and fix the drain under it', text: 'The hole keeps coming back because the catch basin is blocked.', estimate: { amount: 45000, currency: 'USD' } }));
    valid(NSID.claim, makeClaim({ subject: proposal, terms: 'Saturday morning, cold patch.', price: { amount: 30000, currency: 'USD' } }));
    valid(NSID.done, makeDone({ subject: claim, text: 'Patched; basin cleared.', images: [{ image: blob, alt: 'Fresh patch, dry gutter.' }] }));
    valid(NSID.signoff, makeSignoff({ subject: done, verdict: 'approve' }));
    valid(NSID.signoff, makeSignoff({ subject: done, verdict: 'reject', text: 'Patch is already cracking at the edge.' }));
  });

  test('each step must point at the right kind of record', () => {
    assert.throws(() => makeSame({ subject: proposal }), /must point at a org\.jason-edelman\.oscity\.report/);
    assert.throws(() => makeClaim({ subject: report }), /proposal/);
    assert.throws(() => makeDone({ subject: proposal }), /claim/);
    assert.throws(() => makeSignoff({ subject: claim, verdict: 'approve' }), /done/);
    assert.throws(() => makeProposal({ reports: [] }), /at least one report/);
    assert.throws(() => makeSame({ subject: { uri: 'https://example.com', cid: CID } }), /at:\/\//);
  });

  test('a reject needs reasons; money is whole minor units in a real currency code', () => {
    assert.throws(() => makeSignoff({ subject: done, verdict: 'reject' }), /reasons/);
    assert.throws(() => makeSignoff({ subject: done, verdict: 'maybe' }), /approve or reject/);
    assert.throws(() => makeClaim({ subject: proposal, price: { amount: 12.5, currency: 'USD' } }), /whole number/);
    assert.throws(() => makeClaim({ subject: proposal, price: { amount: 100, currency: 'dollars' } }), /ISO 4217/);
    assert.throws(() => makeSame({ subject: report, others: [report] }), /repeat/);
  });
});
