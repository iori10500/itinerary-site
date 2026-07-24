import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'data', 'sources', 'explora');
const officialPath = path.join(outputDir, 'catalog.json');
const outputPath = path.join(outputDir, 'salsify-catalog.json');
const diffPath = path.join(outputDir, 'salsify-diff.json');

const BASE_URL = 'https://sites.salsify.com/923a52ce-d34e-4e7f-bb22-0c2a7d9f60a5/84e7bf86-ba1a-4938-851b-0d3e1dca60ba';
const CONCURRENCY = 6;

function pageUrl(page) {
  return page === 1 ? `${BASE_URL}/` : `${BASE_URL}/products/${page}/`;
}

function extractPageProps(html, url) {
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Missing __NEXT_DATA__ at ${url}`);
  return JSON.parse(match[1]).props.pageProps;
}

async function fetchPage(page, attempt = 1) {
  const url = pageUrl(page);
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'WR-Journeys-Explora-Ingestion/1.0' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { page, url, props: extractPageProps(await response.text(), url) };
  } catch (error) {
    if (attempt >= 3) throw new Error(`Failed page ${page}: ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    return fetchPage(page, attempt + 1);
  }
}

async function fetchPages(totalPages) {
  const results = [];
  for (let start = 1; start <= totalPages; start += CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(CONCURRENCY, totalPages - start + 1) },
      (_, index) => start + index,
    );
    results.push(...await Promise.all(pages.map((page) => fetchPage(page))));
  }
  return results.sort((a, b) => a.page - b.page);
}

function normalizeCatalog(pages) {
  const products = new Map();
  const groups = new Map();
  for (const { props } of pages) {
    for (const group of props.productGroups ?? []) {
      const productIds = [];
      for (const product of group.products ?? []) {
        productIds.push(product.id);
        products.set(product.id, {
          id: product.id,
          grouping_key: product.groupingKey ?? group.groupingKey ?? null,
          title: product.title ?? null,
          locale: product.locale ?? null,
          list_image: product.listImage ?? null,
          source_url: `${BASE_URL}/${product.locale ?? 'en'}/product/${product.slugifiedId ?? product.id}/${product.slugifiedTitle ?? ''}/`,
        });
      }
      groups.set(group.groupingKey, {
        grouping_key: group.groupingKey,
        product_ids: productIds.sort(),
      });
    }
  }
  return {
    groups: [...groups.values()].sort((a, b) => a.grouping_key.localeCompare(b.grouping_key)),
    products: [...products.values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
}

const firstPage = await fetchPage(1);
const totalPages = Number(firstPage.props.totalPages);
const expectedProducts = Number(firstPage.props.totalProducts);
const pages = await fetchPages(totalPages);
const { groups, products } = normalizeCatalog(pages);

if (groups.length !== expectedProducts) {
  throw new Error(`Expected ${expectedProducts} display groups, extracted ${groups.length}`);
}

const generatedAt = new Date().toISOString();
const salsifyCatalog = {
  schema_version: 1,
  generated_at: generatedAt,
  source: {
    type: 'public_catalog_index',
    url: `${BASE_URL}/`,
    publication_date: firstPage.props.publicationDate,
    retrieved_at: generatedAt,
    note: 'Public catalogue index, not the emailed Salsify spreadsheet export.',
  },
  stats: {
    pages: totalPages,
    display_groups: groups.length,
    departure_products: products.length,
  },
  groups,
  products,
};

const official = JSON.parse(await fs.readFile(officialPath, 'utf8'));
const officialIds = new Set(official.departures.map((departure) => departure.id));
const salsifyIds = new Set(products.map((product) => product.id));
const commonIds = [...salsifyIds].filter((id) => officialIds.has(id)).sort();
const salsifyOnly = [...salsifyIds].filter((id) => !officialIds.has(id)).sort();
const officialOnly = [...officialIds].filter((id) => !salsifyIds.has(id)).sort();

const diff = {
  schema_version: 1,
  generated_at: generatedAt,
  sources: {
    salsify: salsifyCatalog.source,
    official: official.source,
  },
  stats: {
    salsify_products: salsifyIds.size,
    official_departures: officialIds.size,
    common: commonIds.length,
    salsify_only: salsifyOnly.length,
    official_only: officialOnly.length,
  },
  salsify_only: salsifyOnly,
  official_only: officialOnly,
};

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(salsifyCatalog, null, 2)}\n`);
await fs.writeFile(diffPath, `${JSON.stringify(diff, null, 2)}\n`);

console.log(JSON.stringify({
  output: path.relative(rootDir, outputPath),
  diff: path.relative(rootDir, diffPath),
  publication_date: firstPage.props.publicationDate,
  ...diff.stats,
}));
