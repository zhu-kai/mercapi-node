// Debug script to get full API response structure
import { generateKeys, createDPoPToken } from './src/auth/dpop';
import { randomUUID } from 'crypto';

async function main() {
  const { privateKey, publicKey } = await generateKeys();
  const uuid = randomUUID();

  // 1. Search API - full response
  console.log('=== SEARCH API ===\n');
  const searchUrl = 'https://api.mercari.jp/v2/entities:search';
  const searchDpop = await createDPoPToken(searchUrl, 'POST', privateKey, publicKey, uuid);

  const searchPayload = {
    userId: '',
    pageSize: 3,
    pageToken: '',
    searchSessionId: randomUUID(),
    indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
    thumbnailTypes: [],
    withAuction: true,
    searchCondition: {
      keyword: 'iPhone',
      excludeKeyword: '',
      sort: 'SORT_SCORE',
      order: 'ORDER_DESC',
      status: ['STATUS_ON_SALE'],
      sizeId: [],
      categoryId: [],
      brandId: [],
      sellerId: [],
      priceMin: 0,
      priceMax: 0,
      itemConditionId: [],
      shippingPayerId: [],
      shippingFromArea: [],
      shippingMethod: [],
      colorId: [],
      hasCoupon: false,
      attributes: [],
      itemTypes: [],
      skuIds: [],
    },
    defaultDatasets: [],
    serviceFrom: 'suruga',
  };

  const searchRes = await fetch(searchUrl, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Platform': 'web',
      'Content-Type': 'application/json',
      DPoP: searchDpop,
    },
    body: JSON.stringify(searchPayload),
  });
  const searchData = await searchRes.json() as any;

  console.log('Search response keys:', Object.keys(searchData));
  console.log('Meta:', JSON.stringify(searchData.meta, null, 2));
  if (searchData.items?.[0]) {
    console.log('\nFirst item ALL keys:', Object.keys(searchData.items[0]));
    console.log('\nFirst item FULL:', JSON.stringify(searchData.items[0], null, 2));
  }

  // 2. Item API - full response
  console.log('\n\n=== ITEM API ===\n');
  const itemId = searchData.items?.[0]?.id;
  if (itemId) {
    const itemUrl = `https://api.mercari.jp/items/get?id=${itemId}&include_auction=true`;
    const itemDpop = await createDPoPToken(itemUrl, 'GET', privateKey, publicKey, uuid);

    const itemRes = await fetch(itemUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Platform': 'web',
        DPoP: itemDpop,
      },
    });
    const itemData = await itemRes.json() as any;

    console.log('Item response keys:', Object.keys(itemData));
    if (itemData.data) {
      console.log('Item data ALL keys:', Object.keys(itemData.data));
      console.log('\nItem data FULL:', JSON.stringify(itemData.data, null, 2));
    }
  }

  // 3. Profile API - full response
  console.log('\n\n=== PROFILE API ===\n');
  const sellerId = searchData.items?.[0]?.sellerId;
  if (sellerId) {
    const profileUrl = `https://api.mercari.jp/users/get_profile?user_id=${sellerId}`;
    const profileDpop = await createDPoPToken(profileUrl, 'GET', privateKey, publicKey, uuid);

    const profileRes = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Platform': 'web',
        DPoP: profileDpop,
      },
    });
    const profileData = await profileRes.json() as any;

    console.log('Profile response keys:', Object.keys(profileData));
    if (profileData.data) {
      console.log('Profile data ALL keys:', Object.keys(profileData.data));
      console.log('\nProfile data FULL:', JSON.stringify(profileData.data, null, 2));
    }
  }

  // 4. Seller Items API - full response
  console.log('\n\n=== SELLER ITEMS API ===\n');
  if (sellerId) {
    const sellerItemsUrl = `https://api.mercari.jp/items/get_items?seller_id=${sellerId}&limit=3&status=on_sale`;
    const sellerItemsDpop = await createDPoPToken(sellerItemsUrl, 'GET', privateKey, publicKey, uuid);

    const sellerItemsRes = await fetch(sellerItemsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Platform': 'web',
        DPoP: sellerItemsDpop,
      },
    });
    const sellerItemsData = await sellerItemsRes.json() as any;

    console.log('Seller items response keys:', Object.keys(sellerItemsData));
    console.log('\nSeller items FULL:', JSON.stringify(sellerItemsData, null, 2));
  }
}

main();
