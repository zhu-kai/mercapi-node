/**
 * Fetches Mercari master data (facets) referenced by search filter IDs
 * and writes them to docs/facets/. Run: npm run fetch-facets
 */
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { generateKeys, createDPoPToken } from '../src/auth/dpop';
import { API_BASE, DEFAULT_USER_AGENT } from '../src/requests/endpoints';

const FACETS: [string, string][] = [
  ['categories.json', `${API_BASE}/master/get_item_categories`],
  ['brands.json', `${API_BASE}/master/get_item_brands`],
  ['sizes.json', `${API_BASE}/services/master/v1/itemSizes`],
  ['conditions.json', `${API_BASE}/services/master/v1/itemConditions`],
  ['shippingPayers.json', `${API_BASE}/services/master/v1/shippingPayers`],
  ['colors.json', `${API_BASE}/services/master/v1/itemColors`],
  ['shippingMethods.json', `${API_BASE}/services/master/v1/shippingMethods`],
];

async function main() {
  const { privateKey, publicKey } = await generateKeys();
  const uuid = randomUUID();
  const outputDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'facets');
  await mkdir(outputDir, { recursive: true });

  for (const [filename, url] of FACETS) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'X-Platform': 'web',
        DPoP: await createDPoPToken(url, 'GET', privateKey, publicKey, uuid),
      },
    });
    if (!response.ok) {
      console.error(`Request for ${url} failed: ${response.status}`);
      continue;
    }
    const data = await response.json();
    await writeFile(join(outputDir, filename), JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${filename}`);
  }
}

main();
