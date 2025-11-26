# Mercapi Node.js Package - Implementation Plan

## Overview
A TypeScript Node.js package for interacting with Mercari Japan API, designed for serverless environments and open source distribution.

## Known Issues & Mitigations

### Key Rotation Issue (from original Python mercapi)

**Problem:** The original Python mercapi has a known issue where search results may differ from web browser results after extended use. The maintainer suspects this is because the ECDSA key pair is never rotated during the instance lifetime.

**Reference:** https://github.com/take-kun/mercapi/issues (reported by maintainer)

**Our Solution:** We will implement automatic key rotation to avoid this issue:

1. **Fresh keys per request** (safest, recommended for serverless):
   ```typescript
   // Each call gets fresh keys - perfect for Lambda/serverless
   const result = await Mercapi.search("iPhone");
   ```

2. **Factory function pattern** (alternative API):
   ```typescript
   // Creates new instance with fresh keys each time
   import { createMercapi } from 'mercapi';

   const mercapi = await createMercapi();
   const result = await mercapi.search("iPhone");
   ```

3. **Manual rotation** (for long-running processes):
   ```typescript
   const mercapi = new Mercapi();
   await mercapi.init();

   // After many requests or time elapsed
   await mercapi.rotateKeys();
   ```

**Implementation Strategy:**
- Default behavior: Generate new keys for each request (stateless, serverless-friendly)
- Optional: `reuseKeys: true` option for users who want to reuse keys within a session
- Provide `rotateKeys()` method for manual rotation in long-running processes

This design naturally fits serverless (Lambda cold starts = fresh keys) and avoids the stale key issue entirely.

## Project Structure

```
mercapi-node/
├── src/
│   ├── index.ts                 # Public API exports
│   ├── mercapi.ts               # Main client class
│   ├── auth/
│   │   └── dpop.ts              # DPoP token generation
│   ├── models/
│   │   ├── index.ts             # Model exports
│   │   ├── item.ts              # Item interface
│   │   ├── search.ts            # Search params & results
│   │   ├── profile.ts           # Seller profile
│   │   └── common.ts            # Shared types (Category, etc.)
│   ├── requests/
│   │   ├── index.ts             # Request exports
│   │   ├── client.ts            # HTTP client wrapper
│   │   └── endpoints.ts         # API endpoint constants
│   └── utils/
│       └── constants.ts         # User agents, headers, etc.
├── tests/
│   ├── unit/
│   │   ├── dpop.test.ts         # DPoP signing tests
│   │   ├── mercapi.test.ts      # Client method tests
│   │   └── models.test.ts       # Model validation tests
│   ├── integration/
│   │   └── api.test.ts          # Real API tests (optional)
│   └── fixtures/
│       └── responses.json       # Mock API responses
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── LICENSE                      # MIT
└── README.md
```

## Dependencies

### Production
- `jose` (^5.x) - JWT/JWS/DPoP signing (lightweight, well-maintained)

### Development
- `typescript` (^5.x)
- `vitest` - Fast unit testing
- `eslint` + `@typescript-eslint/*`
- `prettier`
- `tsup` - Build tool (ESM + CJS output)

### No External HTTP Library
- Use native `fetch` (Node 18+) - zero cold start penalty for serverless

## Core Components

### 1. DPoP Signing (`src/auth/dpop.ts`)

```typescript
import { SignJWT, exportJWK, generateKeyPair, KeyLike } from 'jose';
import { randomUUID } from 'crypto';

interface DPoPKeys {
  privateKey: KeyLike;
  publicKey: KeyLike;
}

export async function generateKeys(): Promise<DPoPKeys> {
  return generateKeyPair('ES256');
}

export async function createDPoPToken(
  url: string,
  method: string,
  privateKey: KeyLike,
  publicKey: KeyLike,
  uuid: string
): Promise<string> {
  const jwk = await exportJWK(publicKey);

  return new SignJWT({ htu: url, htm: method, uuid })
    .setProtectedHeader({
      typ: 'dpop+jwt',
      alg: 'ES256',
      jwk: { crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }
    })
    .setIssuedAt()
    .setJti(randomUUID())
    .sign(privateKey);
}
```

### 2. Main Client (`src/mercapi.ts`)

```typescript
export interface MercapiOptions {
  userAgent?: string;
  /**
   * If true, reuse the same keys across requests (original behavior).
   * If false (default), generate fresh keys for each request.
   * Fresh keys avoid the "stale key" issue but have slight overhead.
   */
  reuseKeys?: boolean;
}

export class Mercapi {
  private privateKey: KeyLike | null = null;
  private publicKey: KeyLike | null = null;
  private uuid: string;
  private userAgent: string;
  private reuseKeys: boolean;

  constructor(options?: MercapiOptions);

  /**
   * Generate fresh ECDSA key pair.
   * Called automatically per-request if reuseKeys=false.
   * Call manually to rotate keys in long-running processes.
   */
  async rotateKeys(): Promise<void>;

  // Public API
  async search(query: string, options?: SearchOptions): Promise<SearchResult>;
  async getItem(id: string): Promise<Item | null>;
  async getProfile(userId: string): Promise<Profile | null>;
  async getSellerItems(sellerId: string): Promise<Items>;

  // Private helpers
  private async ensureKeys(): Promise<void>; // Generate keys if needed
  private async signedFetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Static convenience methods - always use fresh keys (recommended for serverless)
 */
export namespace Mercapi {
  export async function search(query: string, options?: SearchOptions): Promise<SearchResult>;
  export async function getItem(id: string): Promise<Item | null>;
}

/**
 * Factory function - creates initialized instance with fresh keys
 */
export async function createMercapi(options?: MercapiOptions): Promise<Mercapi>;
```

**Usage Patterns:**

```typescript
// Pattern 1: Static methods (simplest, always fresh keys)
import { Mercapi } from 'mercapi';
const results = await Mercapi.search("iPhone");

// Pattern 2: Factory function
import { createMercapi } from 'mercapi';
const mercapi = await createMercapi();
const results = await mercapi.search("iPhone");

// Pattern 3: Instance with key reuse (for batched requests)
const mercapi = new Mercapi({ reuseKeys: true });
const results1 = await mercapi.search("iPhone");
const results2 = await mercapi.search("iPad");
await mercapi.rotateKeys(); // Manual rotation if needed

// Pattern 4: Instance with fresh keys per request (default)
const mercapi = new Mercapi(); // reuseKeys: false by default
const results = await mercapi.search("iPhone"); // Fresh keys each call
```

### 3. Models (`src/models/`)

**Search Options & Results:**
```typescript
export enum SortBy {
  Score = 'SORT_SCORE',
  CreatedTime = 'SORT_CREATED_TIME',
  Price = 'SORT_PRICE',
  NumLikes = 'SORT_NUM_LIKES',
}

export enum SortOrder {
  Desc = 'ORDER_DESC',
  Asc = 'ORDER_ASC',
}

export enum ItemStatus {
  OnSale = 'STATUS_ON_SALE',
  SoldOut = 'STATUS_SOLD_OUT',
}

export interface SearchOptions {
  categories?: number[];
  brands?: number[];
  sizes?: number[];
  priceMin?: number;
  priceMax?: number;
  itemConditions?: number[];
  status?: ItemStatus[];
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  excludeKeyword?: string;
  pageToken?: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  meta: SearchMeta;
}
```

**Item:**
```typescript
export interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  status: string;
  photos: string[];
  thumbnails: string[];
  seller: Seller;
  itemCondition: ItemCondition;
  shippingPayer: ShippingPayer;
  shippingMethod: ShippingMethod;
  numLikes: number;
  numComments: number;
  created: Date;
  updated: Date;
  // ... other fields
}
```

### 4. API Endpoints (`src/requests/endpoints.ts`)

```typescript
export const API_BASE = 'https://api.mercari.jp';

export const ENDPOINTS = {
  SEARCH: `${API_BASE}/v2/entities:search`,
  ITEM: `${API_BASE}/items/get`,
  PROFILE: `${API_BASE}/users/get_profile`,
  SELLER_ITEMS: `${API_BASE}/items/get_items`,
} as const;
```

## Unit Test Strategy

### Test Files

**1. `tests/unit/dpop.test.ts`**
- Test key generation produces valid ES256 keys
- Test DPoP token structure (header, payload)
- Test token is valid JWT
- Test unique `jti` per call
- Test key rotation produces different keys

**2. `tests/unit/mercapi.test.ts`**
- Mock fetch responses
- Test `search()` builds correct payload
- Test `getItem()` returns null on 404
- Test error handling
- Test `reuseKeys: false` generates fresh keys per request
- Test `reuseKeys: true` reuses keys
- Test `rotateKeys()` generates new keys
- Test static methods work correctly

**3. `tests/unit/models.test.ts`**
- Test enum values match API expectations
- Test search options serialization

### Test Approach
- Use Vitest for fast execution
- Mock `fetch` globally for unit tests
- Fixtures for realistic API responses
- No real API calls in unit tests

```typescript
// Example test
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mercapi } from '../src/mercapi';

describe('Mercapi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return null for non-existent item', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const client = new Mercapi();
    await client.init();
    const item = await client.getItem('nonexistent');

    expect(item).toBeNull();
  });
});
```

## Package.json Configuration

```json
{
  "name": "mercapi",
  "version": "0.1.0",
  "description": "Node.js client for Mercari Japan API",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src tests",
    "format": "prettier --write .",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mercari", "api", "japan", "marketplace", "shopping"],
  "author": "",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/xxx/mercapi-node"
  }
}
```

## Build Configuration

**tsup.config.ts:**
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

## Open Source Considerations

1. **MIT License** - Same as original Python package
2. **Clear README** with:
   - Installation instructions
   - Quick start example
   - API documentation
   - Disclaimer about unofficial status
3. **CHANGELOG.md** - Track versions
4. **CONTRIBUTING.md** - Contribution guidelines
5. **GitHub Actions** - CI for tests + lint
6. **Semantic Versioning** - Start at 0.1.0

## Implementation Order

1. Setup project (package.json, tsconfig, tooling)
2. Implement DPoP signing + tests
3. Implement models/interfaces
4. Implement Mercapi client + tests
5. Add README and documentation
6. Setup CI/CD

## Serverless Optimization

- Lazy initialization (keys generated on first use)
- No heavy dependencies
- ESM-first for tree shaking
- Stateless design (each instance independent)

---

## API Reference Documentation

### Search Parameters

#### `SearchOptions` Interface

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `query` | `string` | Search keyword (required) | `"iPhone 15"` |
| `excludeKeyword` | `string` | Keywords to exclude from results | `"ジャンク"` (junk) |
| `categories` | `number[]` | Category IDs to filter (see Category IDs below) | `[1, 11]` |
| `brands` | `number[]` | Brand IDs to filter (see Brand lookup) | `[23, 24]` |
| `sizes` | `number[]` | Size IDs (depends on category, see Size Groups) | `[1, 2, 3]` |
| `priceMin` | `number` | Minimum price in JPY (0 = no minimum) | `1000` |
| `priceMax` | `number` | Maximum price in JPY (0 = no maximum) | `50000` |
| `itemConditions` | `number[]` | Item condition IDs (see Condition IDs) | `[1, 2]` |
| `shippingPayer` | `number[]` | Who pays shipping (see Shipping Payer IDs) | `[2]` |
| `colors` | `number[]` | Color filter IDs (see Color IDs) | `[1, 8]` |
| `status` | `ItemStatus[]` | Item status filter | `[ItemStatus.OnSale]` |
| `sortBy` | `SortBy` | Sort field | `SortBy.Price` |
| `sortOrder` | `SortOrder` | Sort direction | `SortOrder.Asc` |
| `pageToken` | `string` | Pagination token from previous response | `"abc123..."` |

---

### Item Condition IDs

| ID | Japanese | English |
|----|----------|---------|
| `1` | 新品、未使用 | Brand new, unused |
| `2` | 未使用に近い | Like new / Nearly unused |
| `3` | 目立った傷や汚れなし | No visible scratches or stains |
| `4` | やや傷や汚れあり | Minor scratches or stains |
| `5` | 傷や汚れあり | Visible scratches or stains |
| `6` | 全体的に状態が悪い | Poor overall condition |

**Usage Example:**
```typescript
// Search for items in "like new" or better condition
await mercapi.search("iPhone", {
  itemConditions: [1, 2]
});
```

---

### Shipping Payer IDs

| ID | Japanese | English | Code |
|----|----------|---------|------|
| `1` | 着払い(購入者負担) | Buyer pays shipping (COD) | `buyer` |
| `2` | 送料込み(出品者負担) | Seller pays shipping (included) | `seller` |

**Usage Example:**
```typescript
// Search for items with free shipping (seller pays)
await mercapi.search("camera", {
  shippingPayer: [2]
});
```

---

### Color IDs

| ID | Japanese | English | Hex |
|----|----------|---------|-----|
| `1` | ブラック系 | Black | `#212121` |
| `2` | ホワイト系 | White | `#ffffff` |
| `3` | グレイ系 | Gray | `#bdbdbd` |
| `4` | ブラウン系 | Brown | `#824b37` |
| `5` | レッド系 | Red | `#f44336` |
| `6` | ピンク系 | Pink | `#ff80ab` |
| `7` | パープル系 | Purple | `#ab47bc` |
| `8` | ブルー系 | Blue | `#2196f3` |
| `9` | ベージュ系 | Beige | `#ecbd76` |
| `10` | グリーン系 | Green | `#4caf50` |
| `11` | イエロー系 | Yellow | `#ffeb3b` |
| `12` | オレンジ系 | Orange | `#ef6c00` |

**Usage Example:**
```typescript
// Search for black or blue items
await mercapi.search("sneakers", {
  colors: [1, 8]
});
```

---

### Sort Options

#### `SortBy` Enum

| Value | API Value | Description |
|-------|-----------|-------------|
| `SortBy.Score` | `SORT_SCORE` | Relevance score (default) |
| `SortBy.CreatedTime` | `SORT_CREATED_TIME` | Listing date (newest first with DESC) |
| `SortBy.Price` | `SORT_PRICE` | Price |
| `SortBy.NumLikes` | `SORT_NUM_LIKES` | Number of likes/favorites |

#### `SortOrder` Enum

| Value | API Value | Description |
|-------|-----------|-------------|
| `SortOrder.Desc` | `ORDER_DESC` | Descending (high to low, newest first) |
| `SortOrder.Asc` | `ORDER_ASC` | Ascending (low to high, oldest first) |

**Usage Example:**
```typescript
// Search for cheapest items first
await mercapi.search("book", {
  sortBy: SortBy.Price,
  sortOrder: SortOrder.Asc
});

// Search for newest listings
await mercapi.search("game", {
  sortBy: SortBy.CreatedTime,
  sortOrder: SortOrder.Desc
});
```

---

### Item Status

| Value | API Value | Description |
|-------|-----------|-------------|
| `ItemStatus.OnSale` | `STATUS_ON_SALE` | Currently available for purchase |
| `ItemStatus.SoldOut` | `STATUS_SOLD_OUT` | Already sold |

**Usage Example:**
```typescript
// Search only available items (default behavior)
await mercapi.search("Nintendo Switch", {
  status: [ItemStatus.OnSale]
});

// Include sold items (for price research)
await mercapi.search("PS5", {
  status: [ItemStatus.OnSale, ItemStatus.SoldOut]
});
```

---

### Category IDs (Top Level)

| ID | Japanese | English |
|----|----------|---------|
| `1` | レディース | Women's Fashion |
| `2` | メンズ | Men's Fashion |
| `3` | ベビー・キッズ | Baby & Kids |
| `4` | インテリア・住まい・小物 | Interior & Living |
| `5` | 本・音楽・ゲーム | Books, Music & Games |
| `6` | おもちゃ・ホビー・グッズ | Toys, Hobbies & Goods |
| `7` | コスメ・香水・美容 | Cosmetics & Beauty |
| `8` | 家電・スマホ・カメラ | Electronics & Cameras |
| `9` | スポーツ・レジャー | Sports & Leisure |
| `10` | ハンドメイド | Handmade |
| `11` | チケット | Tickets |
| `12` | 自動車・オートバイ | Cars & Motorcycles |
| `13` | その他 | Other |

#### Sub-categories Example (Women's Fashion = 1)

| ID | Japanese | English |
|----|----------|---------|
| `11` | トップス | Tops |
| `12` | ジャケット/アウター | Jackets/Outerwear |
| `13` | パンツ | Pants |
| `14` | スカート | Skirts |
| `15` | ワンピース | Dresses |
| `16` | 靴 | Shoes |
| `17` | ルームウェア/パジャマ | Loungewear/Pajamas |
| `18` | レッグウェア | Legwear |
| `19` | 帽子 | Hats |
| `20` | バッグ | Bags |
| `21` | アクセサリー | Accessories |
| `22` | ヘアアクセサリー | Hair Accessories |
| `23` | 小物 | Small Items |
| `24` | 時計 | Watches |
| `25` | ウィッグ/エクステ | Wigs/Extensions |
| `26` | 浴衣/水着 | Yukata/Swimwear |
| `27` | スーツ/フォーマル/ドレス | Suits/Formal/Dresses |
| `28` | マタニティ | Maternity |
| `29` | その他 | Other |

**Usage Example:**
```typescript
// Search in Women's Tops category
await mercapi.search("blouse", {
  categories: [11]
});

// Search in multiple categories
await mercapi.search("Nike", {
  categories: [16, 116] // Women's shoes + Men's shoes
});
```

---

### Size Groups

Sizes are category-dependent. Here are the main groups:

#### Clothing Sizes (groupId: 1)
| ID | Size |
|----|------|
| `1` | XXS以下 (XXS or smaller) |
| `2` | XS(SS) |
| `3` | S |
| `4` | M |
| `5` | L |
| `6` | XL(LL) |
| `7` | 2XL(3L) |
| `8` | 3XL(4L) |
| `9` | 4XL(5L)以上 |
| `10` | FREE SIZE |

#### Women's Shoes (groupId: 3)
| ID | Size |
|----|------|
| `31` | 20cm以下 |
| `32` | 20.5cm |
| `33` | 21cm |
| `34` | 21.5cm |
| ... | ... |
| `46` | 27cm |
| `47` | 27.5cm以上 |

#### Men's Shoes (groupId: 2)
| ID | Size |
|----|------|
| `21` | 23.5cm以下 |
| `22` | 24cm |
| `23` | 24.5cm |
| ... | ... |
| `36` | 31cm以上 |

**Usage Example:**
```typescript
// Search for medium size clothing
await mercapi.search("t-shirt", {
  sizes: [4] // M size
});

// Search for 26cm shoes
await mercapi.search("sneakers", {
  categories: [116], // Men's shoes
  sizes: [26] // Check actual ID for 26cm
});
```

---

### Brands

Brands are organized by Japanese initial character. Examples:

| ID | Japanese Name | English/Sub Name |
|----|---------------|------------------|
| `23` | アー ヴェ ヴェ | a.v.v |
| `24` | アーカー | AHKAH |
| `3925` | アップル | Apple |
| `4169` | ナイキ | Nike |
| `4170` | アディダス | Adidas |
| `4374` | シャネル | CHANEL |
| `4636` | ルイヴィトン | LOUIS VUITTON |

**Note:** There are thousands of brands. Use the brand search feature or refer to Mercari website for full list.

**Usage Example:**
```typescript
// Search for Nike products
await mercapi.search("shoes", {
  brands: [4169]
});
```

---

### Response Structures

#### `SearchResult`

```typescript
interface SearchResult {
  items: SearchResultItem[];
  meta: {
    numFound: number;        // Total matching items
    nextPageToken: string;   // Token for pagination
  };
}
```

#### `SearchResultItem`

```typescript
interface SearchResultItem {
  id: string;              // Item ID (e.g., "m12345678901")
  name: string;            // Item title
  price: number;           // Price in JPY
  status: string;          // "on_sale" | "trading" | "sold_out"
  thumbnails: string[];    // Thumbnail image URLs
  created: number;         // Unix timestamp
  updated: number;         // Unix timestamp
}
```

#### `Item` (Full Details)

```typescript
interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  status: string;
  photos: string[];           // Full-size image URLs
  thumbnails: string[];
  seller: Seller;
  itemCondition: {
    id: number;
    name: string;             // Japanese condition name
  };
  shippingPayer: {
    id: number;
    name: string;
    code: string;
  };
  shippingMethod: {
    id: number;
    name: string;
  };
  shippingFromArea: {
    id: number;
    name: string;             // Prefecture name
  };
  numLikes: number;
  numComments: number;
  comments: Comment[];
  created: Date;
  updated: Date;
  // ... additional fields
}
```

#### `Seller` / `Profile`

```typescript
interface Seller {
  id: string;
  name: string;
  photoUrl: string;
  numSellItems: number;
  ratings: {
    good: number;
    normal: number;
    bad: number;
  };
}
```

---

### Complete Usage Examples

#### Basic Search

```typescript
import { Mercapi, SortBy, SortOrder, ItemStatus } from 'mercapi';

const mercapi = new Mercapi();
await mercapi.init();

// Simple search
const results = await mercapi.search("iPhone 15");
console.log(`Found ${results.meta.numFound} items`);

for (const item of results.items) {
  console.log(`${item.name}: ¥${item.price}`);
}
```

#### Advanced Search with Filters

```typescript
// Search for cheap, good condition electronics with free shipping
const results = await mercapi.search("AirPods", {
  categories: [8],           // Electronics
  itemConditions: [1, 2, 3], // New to good condition
  shippingPayer: [2],        // Seller pays shipping
  priceMin: 5000,
  priceMax: 20000,
  sortBy: SortBy.Price,
  sortOrder: SortOrder.Asc,
  status: [ItemStatus.OnSale]
});
```

#### Pagination

```typescript
let pageToken: string | undefined;

do {
  const results = await mercapi.search("manga", {
    pageToken,
    sortBy: SortBy.CreatedTime,
    sortOrder: SortOrder.Desc
  });

  // Process results
  for (const item of results.items) {
    console.log(item.name);
  }

  pageToken = results.meta.nextPageToken;
} while (pageToken);
```

#### Get Item Details

```typescript
const item = await mercapi.getItem("m12345678901");

if (item) {
  console.log(`Name: ${item.name}`);
  console.log(`Price: ¥${item.price}`);
  console.log(`Description: ${item.description}`);
  console.log(`Condition: ${item.itemCondition.name}`);
  console.log(`Seller: ${item.seller.name}`);
  console.log(`Likes: ${item.numLikes}`);
}
```

#### Get Seller Profile and Items

```typescript
const profile = await mercapi.getProfile("123456789");
console.log(`Seller: ${profile.name}`);
console.log(`Ratings: ${profile.ratings.good} good`);

const sellerItems = await mercapi.getSellerItems("123456789");
for (const item of sellerItems.items) {
  console.log(`${item.name}: ¥${item.price}`);
}
```
