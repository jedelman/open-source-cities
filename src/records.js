// Record builders for the open-source pothole flow:
//   report → same → proposal → claim → done → signoff
// Each builder returns the record body (no $type) ready for createRecord.
// The lexicon JSON in ../lexicons is the schema; these builders add the rules
// a schema can't say: area-only reports carry no coordinate, photos carry alt
// text, each step points at the right kind of record, a reject gives reasons.

import { latLngToCell } from 'h3-js';

export const NSID = {
  report: 'org.jason-edelman.oscity.report',
  same: 'org.jason-edelman.oscity.same',
  proposal: 'org.jason-edelman.oscity.proposal',
  claim: 'org.jason-edelman.oscity.claim',
  done: 'org.jason-edelman.oscity.done',
  signoff: 'org.jason-edelman.oscity.signoff',
  geo: 'community.lexicon.location.geo',
  address: 'community.lexicon.location.address',
  hthree: 'community.lexicon.location.hthree',
};

// Resolution 8 cells average about 0.7 km², roughly a few city blocks.
export const AREA_RESOLUTION = 8;

const nowIso = () => new Date().toISOString();

function text(value, field, { required = false } = {}) {
  const t = typeof value === 'string' ? value.trim() : '';
  if (required && !t) throw new Error(`${field} is required.`);
  return t || undefined;
}

function coordinate(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error('Latitude and longitude must be real coordinates.');
  }
}

// Where a report is. precision 'exact' publishes the point (and optional
// address); 'area' publishes only the H3 cell that contains it, and nothing else.
export function placeOf({ lat, lng, address, precision = 'exact' }) {
  if (precision === 'area') {
    if (address) throw new Error('An area-only report cannot carry a street address.');
    coordinate(lat, lng);
    return { $type: NSID.hthree, value: latLngToCell(lat, lng, AREA_RESOLUTION) };
  }
  if (precision !== 'exact') throw new Error(`Unknown precision "${precision}".`);
  if (address) {
    const country = text(address.country, 'address.country', { required: true });
    const out = { $type: NSID.address, country };
    for (const k of ['region', 'locality', 'street', 'postalCode', 'name']) {
      const v = text(address[k], `address.${k}`);
      if (v) out[k] = v;
    }
    return out;
  }
  coordinate(lat, lng);
  return { $type: NSID.geo, latitude: lat.toFixed(6), longitude: lng.toFixed(6) };
}

// A strongRef must point at the kind of record the step expects.
export function refTo(ref, collection, field) {
  const uri = ref?.uri;
  const m = typeof uri === 'string' && /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(uri);
  if (!m) throw new Error(`${field} must be a strongRef with an at:// URI to a record.`);
  if (m[2] !== collection) throw new Error(`${field} must point at a ${collection}, not ${m[2]}.`);
  if (typeof ref.cid !== 'string' || !ref.cid) throw new Error(`${field} needs the record's cid.`);
  return { uri, cid: ref.cid };
}

export function money({ amount, currency }) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('amount must be a whole number of minor units (e.g. cents), 0 or more.');
  if (!/^[A-Z]{3}$/.test(currency || '')) throw new Error('currency must be an ISO 4217 code like USD.');
  return { amount, currency };
}

export function cityRef({ system, id, url }) {
  const out = { system: text(system, 'cityRef.system', { required: true }), id: text(id, 'cityRef.id', { required: true }) };
  if (url) {
    if (!/^https:\/\//.test(url)) throw new Error('cityRef.url must be an https link.');
    out.url = url;
  }
  return out;
}

function images(list = []) {
  if (!Array.isArray(list)) throw new Error('images must be a list.');
  if (list.length > 4) throw new Error('At most 4 photos.');
  return list.map((img, i) => {
    const alt = text(img?.alt, `images[${i}].alt`);
    if (!alt) throw new Error('Every photo needs alt text describing it.');
    if (!img.image) throw new Error(`images[${i}] has no uploaded blob.`);
    return { image: img.image, alt };
  });
}

function withOptional(out, extra) {
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  return out;
}

export function makeReport({ place, category, text: body, images: imgs, cityRef: ref, createdAt = nowIso() }) {
  const c = text(category, 'category', { required: true }).toLowerCase();
  return withOptional(
    { location: placeOf(place), category: c, createdAt },
    { text: text(body, 'text'), images: images(imgs), cityRef: ref ? cityRef(ref) : undefined },
  );
}

export function makeSame({ subject, others = [], text: body, createdAt = nowIso() }) {
  const s = refTo(subject, NSID.report, 'subject');
  const o = others.map((r, i) => refTo(r, NSID.report, `others[${i}]`));
  if (o.some((r) => r.uri === s.uri)) throw new Error('others must not repeat the subject.');
  return withOptional({ subject: s, createdAt }, { others: o, text: text(body, 'text') });
}

export function makeProposal({ reports, title, text: body, estimate, createdAt = nowIso() }) {
  if (!Array.isArray(reports) || reports.length === 0) throw new Error('A proposal fixes at least one report.');
  return withOptional(
    {
      reports: reports.map((r, i) => refTo(r, NSID.report, `reports[${i}]`)),
      title: text(title, 'title', { required: true }),
      text: text(body, 'text', { required: true }),
      createdAt,
    },
    { estimate: estimate ? money(estimate) : undefined },
  );
}

export function makeClaim({ subject, terms, price, createdAt = nowIso() }) {
  return withOptional(
    { subject: refTo(subject, NSID.proposal, 'subject'), createdAt },
    { terms: text(terms, 'terms'), price: price ? money(price) : undefined },
  );
}

export function makeDone({ subject, text: body, images: imgs, createdAt = nowIso() }) {
  return withOptional(
    { subject: refTo(subject, NSID.claim, 'subject'), createdAt },
    { text: text(body, 'text'), images: images(imgs) },
  );
}

export function makeSignoff({ subject, verdict, text: body, images: imgs, createdAt = nowIso() }) {
  if (verdict !== 'approve' && verdict !== 'reject') throw new Error('verdict is approve or reject.');
  const why = text(body, 'text');
  if (verdict === 'reject' && !why) throw new Error('A reject needs reasons, so the work can be fixed.');
  return withOptional(
    { subject: refTo(subject, NSID.done, 'subject'), verdict, createdAt },
    { text: why, images: images(imgs) },
  );
}
