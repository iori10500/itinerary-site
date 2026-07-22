#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_URL = 'https://explorajourneys.com/us/en/cruise-catalog';
const OUTPUT_PATH = path.resolve('data/sources/explora/catalog.json');

function decodeHtml(value = '') {
  const named = {
    amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '));
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function daysBetween(startDate, endDate) {
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / dayMs);
}

function capture(pattern, value, label) {
  const match = value.match(pattern);
  if (!match) throw new Error(`Unable to parse ${label}`);
  return match[1];
}

async function fetchCatalog() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      'accept-language': 'en-US,en;q=0.9',
      'user-agent': 'WR-Journeys-Catalog-Ingestion/1.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Explora catalogue returned HTTP ${response.status}`);
  }
  return response.text();
}

function parseCatalog(html) {
  const vessels = new Map();
  const voyages = new Map();
  const departures = new Map();
  let catalogEntries = 0;
  const regionPattern = /<details class="journeyCatalog__region" data-destination-id="([^"]+)">([\s\S]*?)<\/details>/g;

  for (const regionMatch of html.matchAll(regionPattern)) {
    const [, regionCodeRaw, regionHtml] = regionMatch;
    const regionCode = regionCodeRaw.toUpperCase();
    const regionName = decodeHtml(capture(
      /<h2 class="journeyCatalog__regionName">([\s\S]*?)<\/h2>/,
      regionHtml,
      `region name for ${regionCode}`,
    ));

    const articlePattern = /<article class="journeyCatalog__item">([\s\S]*?)<\/article>/g;
    for (const articleMatch of regionHtml.matchAll(articlePattern)) {
      catalogEntries += 1;
      const article = articleMatch[1];
      const href = decodeHtml(capture(/href="([^"]+)"/, article, 'journey URL'));
      const title = decodeHtml(capture(/title="([^"]*)"/, article, 'journey title'));
      const dates = [...article.matchAll(/<time class="journeyCatalog__date" datetime="([^"]+)"/g)]
        .map((match) => match[1]);
      if (dates.length !== 2) throw new Error(`Expected two dates for ${href}`);

      const routeText = stripTags(capture(
        /<span class="journeyCatalog__route">([\s\S]*?)<span class="journeyCatalog__ship">/,
        article,
        `route for ${href}`,
      ));
      const routeParts = routeText.split(/\s+to\s+/i);
      if (routeParts.length !== 2) throw new Error(`Unable to split route "${routeText}"`);

      const shipName = stripTags(capture(
        /<span class="journeyCatalog__ship">([\s\S]*?)<\/span>/,
        article,
        `ship for ${href}`,
      ));
      const vesselId = slugify(shipName);
      vessels.set(vesselId, { id: vesselId, name: shipName });

      const url = new URL(href);
      const journeyId = url.searchParams.get('id-journey');
      const voyageSlug = capture(/\/journeys\/([^/?#]+)/, url.pathname, `voyage slug for ${href}`);
      if (!journeyId) throw new Error(`Missing id-journey for ${href}`);

      const voyageId = `explora:${voyageSlug}`;
      const [embarkationPort, disembarkationPort] = routeParts;
      const nights = daysBetween(dates[0], dates[1]);
      const existingVoyage = voyages.get(voyageId);

      if (!existingVoyage) {
        voyages.set(voyageId, {
          id: voyageId,
          slug: voyageSlug,
          brand_id: 'explora-journeys',
          regions: [{ code: regionCode, name: regionName }],
          title,
          embarkation_port: embarkationPort,
          disembarkation_port: disembarkationPort,
          nights,
          departure_ids: [],
        });
      } else if (
        existingVoyage.embarkation_port !== embarkationPort
        || existingVoyage.disembarkation_port !== disembarkationPort
        || existingVoyage.nights !== nights
      ) {
        throw new Error(`Conflicting voyage definition for ${voyageId}`);
      } else if (!existingVoyage.regions.some(({ code }) => code === regionCode)) {
        existingVoyage.regions.push({ code: regionCode, name: regionName });
      }

      const departure = {
        id: journeyId,
        brand_id: 'explora-journeys',
        vessel_id: vesselId,
        voyage_id: voyageId,
        voyage_ids: [voyageId],
        embarkation_date: dates[0],
        disembarkation_date: dates[1],
        embarkation_port: embarkationPort,
        disembarkation_port: disembarkationPort,
        nights,
        region_codes: [regionCode],
        source_url: href,
      };
      const existingDeparture = departures.get(journeyId);
      if (existingDeparture) {
        const comparableFields = [
          'vessel_id', 'embarkation_date', 'disembarkation_date',
          'embarkation_port', 'disembarkation_port', 'nights',
        ];
        for (const field of comparableFields) {
          if (existingDeparture[field] !== departure[field]) {
            throw new Error(`Conflicting ${field} for duplicate departure ${journeyId}`);
          }
        }
        if (!existingDeparture.region_codes.includes(regionCode)) {
          existingDeparture.region_codes.push(regionCode);
        }
        if (!existingDeparture.voyage_ids.includes(voyageId)) {
          existingDeparture.voyage_ids.push(voyageId);
        }
      } else {
        departures.set(journeyId, departure);
      }
      const voyage = voyages.get(voyageId);
      if (!voyage.departure_ids.includes(journeyId)) voyage.departure_ids.push(journeyId);
    }
  }

  if (departures.size === 0) throw new Error('No Explora departures found');

  return {
    catalogEntries,
    brand: {
      id: 'explora-journeys',
      name: 'Explora Journeys',
      product_type: 'luxury_ocean_ship',
      booking_mode: 'enquiry',
      sales_priority: 'primary',
      commercial_tier: 'preferred',
    },
    vessels: [...vessels.values()].sort((a, b) => a.name.localeCompare(b.name)),
    voyages: [...voyages.values()]
      .map((voyage) => ({
        ...voyage,
        regions: voyage.regions.sort((a, b) => a.code.localeCompare(b.code)),
        departure_ids: voyage.departure_ids.sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    departures: [...departures.values()]
      .map((departure) => ({
        ...departure,
        region_codes: departure.region_codes.sort(),
        voyage_ids: departure.voyage_ids.sort(),
      }))
      .sort((a, b) => (
        a.embarkation_date.localeCompare(b.embarkation_date) || a.id.localeCompare(b.id)
      )),
  };
}

const html = await fetchCatalog();
const { catalogEntries, ...catalog } = parseCatalog(html);
const generatedAt = new Date().toISOString();
const output = {
  schema_version: 1,
  generated_at: generatedAt,
  source: {
    type: 'official_public_catalog',
    url: SOURCE_URL,
    retrieved_at: generatedAt,
  },
  stats: {
    catalog_entries: catalogEntries,
    vessels: catalog.vessels.length,
    voyages: catalog.voyages.length,
    departures: catalog.departures.length,
    duplicate_listings: catalogEntries - catalog.departures.length,
  },
  ...catalog,
};

await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(JSON.stringify(output.stats));
