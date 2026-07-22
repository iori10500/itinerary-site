#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const CATALOG_PATH = path.join(ROOT, 'data/sources/explora/catalog.json');
const OUTPUT_PATH = path.join(ROOT, 'data/sources/explora/details.json');
const CACHE_DIR = path.join(ROOT, '.cache/explora-details');
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.EXPLORA_CONCURRENCY || 4)));

function decodeHtml(value = '') {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity);
}

function parseJsonAttribute(html, attribute) {
  const match = html.match(new RegExp(`${attribute}="([^"]+)"`));
  if (!match) return null;
  return JSON.parse(decodeHtml(match[1]));
}

function normalizeName(value = '') {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');
}

function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function computeMetrics(days, overnightEvents) {
  const timedCalls = days.filter((day) => timeToMinutes(day.arrival_time) !== null && timeToMinutes(day.departure_time) !== null);
  return {
    itinerary_days: days.length,
    port_days: days.filter((day) => !day.at_sea).length,
    sea_days: days.filter((day) => day.at_sea).length,
    timed_calls: timedCalls.length,
    late_departures: timedCalls.filter((day) => timeToMinutes(day.departure_time) >= 18 * 60).length,
    full_day_calls: timedCalls.filter((day) => timeToMinutes(day.arrival_time) <= 10 * 60 && timeToMinutes(day.departure_time) >= 18 * 60).length,
    tender_calls: days.filter((day) => !day.at_sea && day.arrival_method === 'TENDER').length,
    gateway_candidates: days.filter((day) => !day.at_sea && /\([^)]*\)/.test(day.port_name || '')).length,
    overnight_events: overnightEvents.length,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': 'WR-Journeys-Detail-Ingestion/1.0',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 650);
    }
  }
  throw lastError;
}

function portRecord(port, eventTenderMode) {
  return {
    code: port.code,
    official_name: port.name,
    country: port.country?.name || '',
    country_code: port.country?.code || '',
    cities: [...new Set((port.cities || []).map(({ name }) => name).filter(Boolean))].sort(),
    arrival_methods: [...new Set([port.tenderMode, eventTenderMode].filter((method) => method && method !== 'DEFAULT'))].sort(),
  };
}

function mergePort(target, incoming) {
  if (!target) return incoming;
  if (target.official_name !== incoming.official_name) {
    target.aliases = [...new Set([...(target.aliases || []), incoming.official_name])].sort();
  }
  target.cities = [...new Set([...target.cities, ...incoming.cities])].sort();
  target.arrival_methods = [...new Set([...target.arrival_methods, ...incoming.arrival_methods])].sort();
  return target;
}

function parseDetail(html, departure) {
  const activities = parseJsonAttribute(html, 'data-attr-sailActivities');
  const itinerary = parseJsonAttribute(html, 'data-itineraries-list');
  if (!Array.isArray(activities) || !Array.isArray(itinerary)) {
    throw new Error('missing structured itinerary attributes');
  }

  const ports = new Map();
  const nameToCode = new Map();
  const portsByDate = new Map();
  const overnightEvents = [];

  for (const activity of activities) {
    if (!activity.port?.code) continue;
    const record = portRecord(activity.port, activity.tenderMode);
    ports.set(record.code, mergePort(ports.get(record.code), record));
    nameToCode.set(normalizeName(activity.port.name), record.code);
    for (const city of activity.port.cities || []) nameToCode.set(normalizeName(city.name), record.code);
    const date = String(activity.dateTime || '').slice(0, 10);
    if (date) {
      if (!portsByDate.has(date)) portsByDate.set(date, new Set());
      portsByDate.get(date).add(record.code);
    }
    if (activity.type?.code === 'OVERNIGHT') {
      overnightEvents.push({ port_code: record.code, date, time: String(activity.dateTime || '').slice(11, 16) || null });
    }
  }

  const days = itinerary.map((day) => {
    const atSea = Boolean(day.atSea);
    let portCode = atSea ? null : nameToCode.get(normalizeName(day.portName));
    if (!portCode && !atSea && day.date) {
      const candidates = [...(portsByDate.get(day.date) || [])];
      if (candidates.length === 1) [portCode] = candidates;
    }
    const port = portCode ? ports.get(portCode) : null;
    return {
      day: Number(day.day) || null,
      date: day.date || null,
      title: day.title || '',
      at_sea: atSea,
      port_code: portCode || null,
      port_name: day.portName || port?.official_name || null,
      country: day.country || port?.country || null,
      arrival_time: day.arrivalTime || null,
      departure_time: day.departureTime || null,
      arrival_method: port?.arrival_methods?.[0] || null,
    };
  });

  return {
    id: departure.id,
    source_url: departure.source_url,
    ports: [...ports.values()].sort((a, b) => a.code.localeCompare(b.code)),
    itinerary: days,
    overnight_events: overnightEvents,
    metrics: computeMetrics(days, overnightEvents),
  };
}

async function loadCached(id) {
  try {
    return JSON.parse(await readFile(path.join(CACHE_DIR, `${id}.json`), 'utf8'));
  } catch {
    return null;
  }
}

async function ingestDeparture(departure) {
  const cached = await loadCached(departure.id);
  if (cached) return { detail: cached, cached: true };
  const html = await fetchWithRetry(departure.source_url);
  const detail = parseDetail(html, departure);
  await writeFile(path.join(CACHE_DIR, `${departure.id}.json`), `${JSON.stringify(detail)}\n`, 'utf8');
  return { detail, cached: false };
}

const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
await mkdir(CACHE_DIR, { recursive: true });
const details = [];
const errors = [];
let fetched = 0;
let cached = 0;
let cursor = 0;

async function worker() {
  while (cursor < catalog.departures.length) {
    const index = cursor;
    cursor += 1;
    const departure = catalog.departures[index];
    try {
      const result = await ingestDeparture(departure);
      details.push(result.detail);
      if (result.cached) cached += 1;
      else fetched += 1;
    } catch (error) {
      errors.push({ id: departure.id, source_url: departure.source_url, error: error.message });
    }
    const completed = details.length + errors.length;
    if (completed % 25 === 0 || completed === catalog.departures.length) {
      console.log(`Processed ${completed}/${catalog.departures.length} (fetched ${fetched}, cached ${cached}, errors ${errors.length})`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
details.sort((a, b) => a.id.localeCompare(b.id));

const portIndex = new Map();
for (const detail of details) {
  for (const port of detail.ports) portIndex.set(port.code, mergePort(portIndex.get(port.code), port));
}

function findGlobalPort(day) {
  const query = normalizeName(day.port_name);
  if (!query) return null;
  const country = normalizeName(day.country);
  const queryTokens = new Set(String(day.port_name || '').toLowerCase().match(/[a-z]+/g) || []);
  const matches = [...portIndex.values()].map((port) => {
    if (country && normalizeName(port.country) !== country) return false;
    const names = [port.official_name, ...port.cities].map(normalizeName);
    const rawNames = [port.official_name, ...port.cities];
    if (/fireworks/i.test(port.official_name) && !/fireworks/i.test(day.port_name || '')) return false;
    let score = names.some((name) => name === query) ? 3 : 0;
    if (!score && names.some((name) => name.includes(query) || query.includes(name))) score = 2;
    if (!score && queryTokens.size > 1) {
      const tokenMatch = rawNames.some((name) => {
        const tokens = new Set(String(name).toLowerCase().match(/[a-z]+/g) || []);
        return [...queryTokens].every((token) => tokens.has(token));
      });
      if (tokenMatch) score = 1;
    }
    return score ? { port, score } : false;
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  if (!matches.length || (matches[1] && matches[0].score === matches[1].score)) return null;
  return matches[0].port;
}

for (const detail of details) {
  for (const day of detail.itinerary) {
    if (!day.at_sea && /^(at sea|sailing\b)/i.test(day.port_name || '')) {
      day.at_sea = true;
      day.port_code = null;
      day.arrival_method = null;
      continue;
    }
    if (!day.at_sea && !day.port_code) {
      const port = findGlobalPort(day);
      if (port) {
        day.port_code = port.code;
        day.arrival_method = port.arrival_methods[0] || null;
      }
    }
  }
  detail.metrics = computeMetrics(detail.itinerary, detail.overnight_events);
}

const metricTotals = details.reduce((totals, detail) => {
  for (const [key, value] of Object.entries(detail.metrics)) totals[key] = (totals[key] || 0) + value;
  return totals;
}, {});

const generatedAt = new Date().toISOString();
const output = {
  schema_version: 1,
  generated_at: generatedAt,
  source: {
    type: 'official_journey_detail_pages',
    catalog_generated_at: catalog.generated_at,
    retrieved_at: generatedAt,
  },
  stats: {
    requested_departures: catalog.departures.length,
    parsed_departures: details.length,
    failed_departures: errors.length,
    official_ports: portIndex.size,
    fetched,
    cached,
    ...metricTotals,
    late_departure_share: metricTotals.timed_calls ? Number((metricTotals.late_departures / metricTotals.timed_calls).toFixed(4)) : null,
    full_day_share: metricTotals.timed_calls ? Number((metricTotals.full_day_calls / metricTotals.timed_calls).toFixed(4)) : null,
  },
  ports: [...portIndex.values()].sort((a, b) => a.code.localeCompare(b.code)),
  departures: details,
  errors,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(JSON.stringify(output.stats));
if (errors.length) process.exitCode = 2;
