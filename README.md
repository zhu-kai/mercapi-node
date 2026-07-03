# mercapi-node

[![npm](https://img.shields.io/npm/v/mercapi)](https://www.npmjs.com/package/mercapi)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-blue)](https://nodejs.org/)
[![API Health](https://github.com/zhu-kai/mercapi-node/actions/workflows/api-health.yml/badge.svg)](https://zhu-kai.github.io/mercapi-node/)

Live API status: [zhu-kai.github.io/mercapi-node](https://zhu-kai.github.io/mercapi-node/) — a scheduled check runs every 6 hours against the real Mercari API and fails loudly if the API changes.

Node.js client for Mercari Japan API. TypeScript-first, serverless-friendly.

> This project is derived from [mercapi](https://github.com/take-kun/mercapi) by Take-kun.

> **Disclaimer:** This is an unofficial library. Use at your own risk.

## Features

- Full TypeScript support with type definitions
- Serverless-optimized (fresh keys per request by default)
- No heavy dependencies (only `jose` for JWT signing)
- ESM and CommonJS support
- Node.js 18+ (uses native fetch)

## Installation

```bash
npm install mercapi
```

## Quick Start

```typescript
import { Mercapi } from 'mercapi';

const results = await Mercapi.search('iPhone 15');
console.log(`Found ${results.meta.numFound} items`);

for (const item of results.items) {
  console.log(`${item.name}: ¥${item.price}`);
}
```

## Usage Patterns

### Pattern 1: Static Methods (Simplest)

Best for serverless. Each call uses fresh keys automatically.

```typescript
import { Mercapi } from 'mercapi';

const results = await Mercapi.search('Nintendo Switch');
const item = await Mercapi.getItem('m12345678901');
const profile = await Mercapi.getProfile('123456789');
const sellerItems = await Mercapi.getSellerItems('123456789');
```

### Pattern 2: Instance with Fresh Keys (Default)

```typescript
import { Mercapi } from 'mercapi';

const mercapi = new Mercapi();
const results = await mercapi.search('AirPods'); // Fresh keys
const results2 = await mercapi.search('iPad'); // Fresh keys again
```

### Pattern 3: Instance with Key Reuse

For batched requests where you want to reuse keys:

```typescript
import { Mercapi } from 'mercapi';

const mercapi = new Mercapi({ reuseKeys: true });
const results1 = await mercapi.search('camera');
const results2 = await mercapi.search('lens');

// Manually rotate keys if needed
await mercapi.rotateKeys();
```

## API Reference

### search(query, options?)

Search for items on Mercari.

```typescript
const results = await Mercapi.search('iPhone', options);
```

#### Options

| Option             | Type           | Default    | Description                 |
| ------------------ | -------------- | ---------- | --------------------------- |
| `categories`       | `number[]`     |            | Category IDs                |
| `brands`           | `number[]`     |            | Brand IDs                   |
| `sizes`            | `number[]`     |            | Size IDs                    |
| `priceMin`         | `number`       |            | Minimum price (JPY)         |
| `priceMax`         | `number`       |            | Maximum price (JPY)         |
| `itemConditions`   | `number[]`     |            | Condition IDs (1-6)         |
| `shippingPayer`    | `number[]`     |            | 1=buyer, 2=seller           |
| `colors`           | `number[]`     |            | Color IDs (1-12)            |
| `status`           | `ItemStatus[]` | `[OnSale]` | `OnSale`, `SoldOut`         |
| `sortBy`           | `SortBy`       | `Score`    | Sort field                  |
| `sortOrder`        | `SortOrder`    | `Desc`     | Sort direction              |
| `excludeKeyword`   | `string`       |            | Keywords to exclude         |
| `pageToken`        | `string`       |            | Pagination token            |
| `withAuction`      | `boolean`      | `true`     | Include auction data        |
| `excludeShopItems` | `boolean`      | `false`    | Exclude Mercari Shops items |

ID-based filters (`categories`, `brands`, `sizes`, etc.) reference Mercari master data. The full lists are in [`docs/facets/`](docs/facets/); refresh them anytime with `npm run fetch-facets`.

#### Response: `SearchResult`

```typescript
interface SearchResult {
  items: SearchResultItem[];
  meta: {
    numFound: number; // Total matching items
    nextPageToken: string; // Token for next page
  };
}

interface SearchResultItem {
  id: string; // Item ID (e.g., "m12345678901")
  sellerId: string; // Seller ID
  name: string; // Item title
  price: number; // Price in JPY
  status: string; // Item status
  categoryId: number; // Category ID
  itemConditionId: number; // Condition ID (1-6)
  shippingPayerId: number; // Shipping payer ID
  thumbnails: string[]; // Thumbnail URLs
  created: number; // Creation timestamp
  updated: number; // Last update timestamp
  isShopItem: boolean; // true if Mercari Shops item
  auction?: {
    // Only present for auction items
    id: string;
    endTime: number; // Bid deadline (Unix timestamp, seconds)
    totalBids: number;
    highestBid: number; // Current highest bid in JPY
    initialPrice: number; // Starting price in JPY
  };
}
```

#### Example

```typescript
import { Mercapi, SortBy, SortOrder, ItemCondition, ShippingPayer } from 'mercapi';

const results = await Mercapi.search('AirPods', {
  categories: [8],
  itemConditions: [ItemCondition.BrandNew, ItemCondition.LikeNew],
  shippingPayer: [ShippingPayer.Seller],
  priceMin: 5000,
  priceMax: 20000,
  sortBy: SortBy.Price,
  sortOrder: SortOrder.Asc,
  excludeShopItems: true,
});

// Auction items are flagged via the `auction` field
for (const item of results.items) {
  if (item.auction) {
    console.log(`[Auction] ${item.name}: ¥${item.auction.highestBid} (${item.auction.totalBids} bids)`);
  }
}
```

---

### getItem(id, options?)

Get detailed item information.

```typescript
const item = await Mercapi.getItem('m12345678901');
const itemWithAuction = await Mercapi.getItem('m12345678901', { includeAuction: true });
```

#### Options

| Option           | Type      | Default | Description          |
| ---------------- | --------- | ------- | -------------------- |
| `includeAuction` | `boolean` | `false` | Include auction info |

#### Response: `Item | null`

```typescript
interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  status: string;
  photos: string[]; // Full-size image URLs
  thumbnails: string[];
  seller: {
    id: string;
    name: string;
    photoUrl: string;
    numSellItems: number;
    ratings: { good: number; normal: number; bad: number };
    numRatings: number;
    starRatingScore: number; // 1-5
    isFollowable: boolean;
    isBlocked: boolean;
  };
  itemCategory: {
    id: number;
    name: string;
    parentCategoryId: number;
    parentCategoryName: string;
    rootCategoryId: number;
    rootCategoryName: string;
  };
  itemCondition: { id: number; name: string };
  itemBrand?: { id: number; name: string; subName: string };
  shippingPayer: { id: number; name: string; code: string };
  shippingMethod: { id: number; name: string };
  shippingFromArea: { id: number; name: string };
  shippingDuration?: { id: number; name: string; minDays: number; maxDays: number };
  numLikes: number;
  numComments: number;
  comments: Array<{
    id: string;
    message: string;
    user: { id: string; name: string; photoUrl: string };
    created: number;
  }>;
  created: number;
  updated: number;
  isShopItem: boolean;
  isAnonymousShipping: boolean;
  isOfferable: boolean;
  auctionInfo?: {
    // Only with includeAuction: true
    id: string;
    startTime: number;
    endTime: number;
    totalBids: number;
    initialPrice: number;
    highestBid: number;
    state: string; // e.g., "STATE_ONGOING", "STATE_NO_BID"
    auctionType: string;
  };
}
```

#### Example

```typescript
const item = await Mercapi.getItem('m12345678901');
if (item) {
  console.log(`${item.name}: ¥${item.price}`);
  console.log(`Seller: ${item.seller.name} (★${item.seller.starRatingScore})`);
  console.log(`Category: ${item.itemCategory.name}`);
  console.log(`Condition: ${item.itemCondition.name}`);
  if (item.itemBrand) {
    console.log(`Brand: ${item.itemBrand.name}`);
  }
  if (item.shippingDuration) {
    console.log(`Ships in: ${item.shippingDuration.minDays}-${item.shippingDuration.maxDays} days`);
  }
}
```

---

### getProfile(userId)

Get seller profile information.

```typescript
const profile = await Mercapi.getProfile('123456789');
```

#### Response: `Profile | null`

```typescript
interface Profile {
  id: string;
  name: string;
  photoUrl: string;
  introduction: string;
  numSellItems: number;
  ratings: { good: number; normal: number; bad: number };
  numRatings: number;
  starRatingScore: number; // 1-5
  followerCount: number;
  followingCount: number;
  isOrganizationalUser: boolean; // true if business account
  created: number;
}
```

#### Example

```typescript
const profile = await Mercapi.getProfile('123456789');
if (profile) {
  console.log(`${profile.name} (★${profile.starRatingScore})`);
  console.log(`Ratings: ${profile.ratings.good} good, ${profile.ratings.bad} bad`);
  console.log(`Followers: ${profile.followerCount}`);
}
```

---

### getSellerItems(sellerId, pageToken?)

Get items listed by a seller.

```typescript
const sellerItems = await Mercapi.getSellerItems('123456789');
```

#### Response: `SellerItems`

```typescript
interface SellerItems {
  items: Array<{
    id: string;
    name: string;
    price: number;
    status: string;
    thumbnails: string[];
    created: number;
    updated: number;
  }>;
  nextPageToken: string;
}
```

#### Example

```typescript
const sellerItems = await Mercapi.getSellerItems('123456789');
for (const item of sellerItems.items) {
  console.log(`${item.name}: ¥${item.price} (${item.status})`);
}

// Pagination
if (sellerItems.nextPageToken) {
  const nextPage = await Mercapi.getSellerItems('123456789', sellerItems.nextPageToken);
}
```

---

### Pagination

```typescript
let pageToken: string | undefined;

do {
  const results = await Mercapi.search('manga', {
    pageToken,
    sortBy: SortBy.CreatedTime,
    sortOrder: SortOrder.Desc,
  });

  for (const item of results.items) {
    console.log(item.name);
  }

  pageToken = results.meta.nextPageToken || undefined;
} while (pageToken);
```

## Enums

### SortBy

| Value                | Description         |
| -------------------- | ------------------- |
| `SortBy.Score`       | Relevance (default) |
| `SortBy.CreatedTime` | Newest first        |
| `SortBy.Price`       | Price               |
| `SortBy.NumLikes`    | Number of likes     |

### SortOrder

| Value            | Description          |
| ---------------- | -------------------- |
| `SortOrder.Desc` | Descending (default) |
| `SortOrder.Asc`  | Ascending            |

### ItemStatus

| Value                | Description       |
| -------------------- | ----------------- |
| `ItemStatus.OnSale`  | Currently on sale |
| `ItemStatus.SoldOut` | Sold out          |

### ItemCondition

| Value                    | ID  | Japanese             | English   |
| ------------------------ | --- | -------------------- | --------- |
| `ItemCondition.BrandNew` | 1   | 新品、未使用         | Brand new |
| `ItemCondition.LikeNew`  | 2   | 未使用に近い         | Like new  |
| `ItemCondition.Good`     | 3   | 目立った傷や汚れなし | Good      |
| `ItemCondition.Fair`     | 4   | やや傷や汚れあり     | Fair      |
| `ItemCondition.Poor`     | 5   | 傷や汚れあり         | Poor      |
| `ItemCondition.Bad`      | 6   | 全体的に状態が悪い   | Bad       |

### ShippingPayer

| Value                  | ID  | Japanese | English                     |
| ---------------------- | --- | -------- | --------------------------- |
| `ShippingPayer.Buyer`  | 1   | 着払い   | Buyer pays                  |
| `ShippingPayer.Seller` | 2   | 送料込み | Seller pays (free shipping) |

### Color

| Value          | ID  |
| -------------- | --- |
| `Color.Black`  | 1   |
| `Color.White`  | 2   |
| `Color.Gray`   | 3   |
| `Color.Brown`  | 4   |
| `Color.Red`    | 5   |
| `Color.Pink`   | 6   |
| `Color.Purple` | 7   |
| `Color.Blue`   | 8   |
| `Color.Beige`  | 9   |
| `Color.Green`  | 10  |
| `Color.Yellow` | 11  |
| `Color.Orange` | 12  |

## Reference Data

For facet IDs (categories, brands, sizes, etc.), see:
https://github.com/take-kun/mercapi/tree/main/docs/facets

### Top-Level Categories

| ID  | Japanese                 | English           |
| --- | ------------------------ | ----------------- |
| 1   | レディース               | Women's           |
| 2   | メンズ                   | Men's             |
| 3   | ベビー・キッズ           | Baby & Kids       |
| 4   | インテリア・住まい・小物 | Interior          |
| 5   | 本・音楽・ゲーム         | Books/Music/Games |
| 6   | おもちゃ・ホビー・グッズ | Toys/Hobbies      |
| 7   | コスメ・香水・美容       | Cosmetics         |
| 8   | 家電・スマホ・カメラ     | Electronics       |
| 9   | スポーツ・レジャー       | Sports            |
| 10  | ハンドメイド             | Handmade          |
| 11  | チケット                 | Tickets           |
| 12  | 自動車・オートバイ       | Vehicles          |
| 13  | その他                   | Other             |

## Error Handling

All methods throw errors on API failures. Use try-catch for error handling:

```typescript
import { Mercapi } from 'mercapi';

try {
  const results = await Mercapi.search('iPhone');
} catch (error) {
  // Error message format: "{Method} failed: {status} {statusText}"
  // e.g., "Search failed: 500 Internal Server Error"
  console.error(error.message);
}
```

### Return Values

| Method             | Not Found                                      | Error        |
| ------------------ | ---------------------------------------------- | ------------ |
| `search()`         | Returns `{ items: [], meta: { numFound: 0 } }` | Throws Error |
| `getItem()`        | Returns `null`                                 | Throws Error |
| `getProfile()`     | Returns `null`                                 | Throws Error |
| `getSellerItems()` | Returns `{ items: [], nextPageToken: '' }`     | Throws Error |

## TypeScript

All types are exported for full TypeScript support:

```typescript
import {
  // Main class
  Mercapi,
  createMercapi,

  // Options type
  type MercapiOptions,

  // Enums
  SortBy,
  SortOrder,
  ItemStatus,
  ItemCondition,
  ShippingPayer,
  Color,

  // Search types
  type SearchOptions,
  type SearchResult,
  type SearchResultItem,
  type SearchMeta,
  type SearchAuction,

  // Item types
  type Item,
  type Seller,
  type ItemCategory,
  type ItemConditionInfo,
  type ItemBrand,
  type ShippingPayerInfo,
  type ShippingMethodInfo,
  type ShippingFromArea,
  type ShippingDuration,
  type Comment,
  type AuctionInfo,

  // Profile types
  type Profile,
  type SellerItem,
  type SellerItems,
} from 'mercapi';
```

### Type Examples

```typescript
import { Mercapi, SearchResult, Item, Profile } from 'mercapi';

// Function with typed return
async function searchItems(keyword: string): Promise<SearchResult> {
  return Mercapi.search(keyword);
}

// Nullable item
async function getItemSafe(id: string): Promise<Item | null> {
  return Mercapi.getItem(id);
}

// Type guard for auction items
function isAuctionItem(item: Item): boolean {
  return item.auctionInfo !== undefined;
}
```

## Integration Examples

### Express.js API

```typescript
import express from 'express';
import { Mercapi, SortBy, SortOrder } from 'mercapi';

const app = express();

app.get('/api/search', async (req, res) => {
  try {
    const { q, minPrice, maxPrice, page } = req.query;

    const results = await Mercapi.search(q as string, {
      priceMin: minPrice ? Number(minPrice) : undefined,
      priceMax: maxPrice ? Number(maxPrice) : undefined,
      pageToken: page as string,
      sortBy: SortBy.CreatedTime,
      sortOrder: SortOrder.Desc,
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Mercapi.getItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### AWS Lambda

```typescript
import { Mercapi } from 'mercapi';

export const handler = async (event: any) => {
  const keyword = event.queryStringParameters?.q || '';

  try {
    // Static methods are ideal for Lambda - fresh keys each invocation
    const results = await Mercapi.search(keyword);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Batch Processing

```typescript
import { Mercapi } from 'mercapi';

async function batchFetchItems(itemIds: string[]) {
  // Use instance with key reuse for batch operations
  const client = new Mercapi({ reuseKeys: true });

  const results = await Promise.all(itemIds.map((id) => client.getItem(id)));

  return results.filter((item): item is NonNullable<typeof item> => item !== null);
}
```

### Monitoring New Listings

```typescript
import { Mercapi, SortBy, SortOrder } from 'mercapi';

async function monitorNewListings(keyword: string, callback: (items: any[]) => void) {
  let lastSeenId: string | undefined;

  setInterval(async () => {
    try {
      const results = await Mercapi.search(keyword, {
        sortBy: SortBy.CreatedTime,
        sortOrder: SortOrder.Desc,
      });

      const newItems = lastSeenId
        ? results.items
            .filter((item) => item.id !== lastSeenId)
            .slice(
              0,
              results.items.findIndex((i) => i.id === lastSeenId)
            )
        : results.items;

      if (newItems.length > 0) {
        lastSeenId = results.items[0].id;
        callback(newItems);
      }
    } catch (error) {
      console.error('Monitor error:', error);
    }
  }, 60000); // Check every minute
}
```

## Known Issues

### Key Rotation

The original Python mercapi has a known issue where search results may differ from browser results after extended use. This is likely due to stale ECDSA keys.

**Our solution:** By default, this library generates fresh keys for each request, avoiding this issue entirely. This is ideal for serverless environments where each invocation is independent.

If you need to reuse keys (e.g., for performance in batch operations), use `reuseKeys: true` and call `rotateKeys()` periodically.

## Credits

This project is a TypeScript/Node.js port of [mercapi](https://github.com/take-kun/mercapi) by [take-kun](https://github.com/take-kun), which pioneered the reverse-engineering of the Mercari Japan API, including the DPoP request signing scheme and the auction/shop item response formats. All API insights originate from that project — please consider starring it if you find this library useful.

## License

MIT
