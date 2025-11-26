import { Mercapi, SortBy, SortOrder, ItemCondition, ShippingPayer } from './src/index';

async function main() {
  console.log('=== Mercapi Example ===\n');

  // 1. Basic search
  console.log('1. Basic search');
  const results = await Mercapi.search('iPhone');
  console.log(`   Found: ${results.meta.numFound} items`);
  if (results.items[0]) {
    const item = results.items[0];
    console.log(`   First item: ${item.name.slice(0, 40)}...`);
    console.log(`   - Price: ¥${item.price}`);
    console.log(`   - Seller ID: ${item.sellerId}`);
    console.log(`   - Category ID: ${item.categoryId}`);
    console.log(`   - Condition ID: ${item.itemConditionId}`);
    console.log(`   - Is shop item: ${item.isShopItem}`);
  }

  console.log('');

  // 2. Advanced search with filters
  console.log('2. Advanced search (filters)');
  const filtered = await Mercapi.search('AirPods', {
    priceMin: 5000,
    priceMax: 30000,
    itemConditions: [ItemCondition.BrandNew, ItemCondition.LikeNew],
    shippingPayer: [ShippingPayer.Seller],
    sortBy: SortBy.Price,
    sortOrder: SortOrder.Asc,
  });
  console.log(`   Found: ${filtered.meta.numFound} items`);
  filtered.items.slice(0, 3).forEach((item, i) => {
    console.log(`   ${i + 1}. ¥${item.price} - ${item.name.slice(0, 30)}...`);
  });

  console.log('');

  // 3. Search with auction data
  console.log('3. Search with auction data');
  const auctionSearch = await Mercapi.search('ゲーム', { withAuction: true });
  const auctionItems = auctionSearch.items.filter((i) => i.auction);
  console.log(`   Found ${auctionItems.length} auction items`);
  auctionItems.slice(0, 2).forEach((item) => {
    console.log(`   - ${item.name.slice(0, 30)}...`);
    console.log(`     Start: ¥${item.price}, Bids: ${item.auction!.totalBids}`);
  });

  console.log('');

  // 4. Exclude shop items
  console.log('4. Exclude shop items');
  const withShop = await Mercapi.search('カメラ');
  const withoutShop = await Mercapi.search('カメラ', { excludeShopItems: true });
  const shopCount = withShop.items.filter((i) => i.isShopItem).length;
  console.log(`   With shop: ${withShop.items.length} items (${shopCount} shop)`);
  console.log(`   Without shop: ${withoutShop.items.length} items`);

  console.log('');

  // 5. Get item details
  console.log('5. Get item details');
  const regularItem = results.items.find((i) => !i.isShopItem);
  if (regularItem) {
    const item = await Mercapi.getItem(regularItem.id);
    if (item) {
      console.log(`   Name: ${item.name.slice(0, 50)}...`);
      console.log(`   Price: ¥${item.price}`);
      console.log(`   Description: ${item.description.slice(0, 50)}...`);
      console.log(`   Category: ${item.itemCategory.name}`);
      console.log(`   Condition: ${item.itemCondition.name}`);
      if (item.itemBrand) {
        console.log(`   Brand: ${item.itemBrand.name}`);
      }
      console.log(`   Shipping: ${item.shippingMethod.name}`);
      if (item.shippingDuration) {
        console.log(`   Ships in: ${item.shippingDuration.minDays}-${item.shippingDuration.maxDays} days`);
      }
      console.log(`   Anonymous shipping: ${item.isAnonymousShipping}`);
      console.log(`   Accepts offers: ${item.isOfferable}`);
      console.log(`   Likes: ${item.numLikes}, Comments: ${item.numComments}`);
      console.log(`   Seller: ${item.seller.name} (★${item.seller.starRatingScore})`);
    }
  }

  console.log('');

  // 6. Get item with auction info
  console.log('6. Get item with auction info');
  if (auctionItems[0]) {
    const item = await Mercapi.getItem(auctionItems[0].id, { includeAuction: true });
    if (item?.auctionInfo) {
      console.log(`   Name: ${item.name.slice(0, 40)}...`);
      console.log(`   Auction state: ${item.auctionInfo.state}`);
      console.log(`   Initial price: ¥${item.auctionInfo.initialPrice}`);
      console.log(`   Highest bid: ¥${item.auctionInfo.highestBid}`);
      console.log(`   Total bids: ${item.auctionInfo.totalBids}`);
    }
  }

  console.log('');

  // 7. Get seller profile
  console.log('7. Get seller profile');
  if (regularItem) {
    const profile = await Mercapi.getProfile(regularItem.sellerId);
    if (profile) {
      console.log(`   Name: ${profile.name}`);
      console.log(`   Ratings: Good ${profile.ratings.good}, Normal ${profile.ratings.normal}, Bad ${profile.ratings.bad}`);
      console.log(`   Star rating: ${profile.starRatingScore}`);
      console.log(`   Total ratings: ${profile.numRatings}`);
      console.log(`   Followers: ${profile.followerCount}`);
      console.log(`   Following: ${profile.followingCount}`);
      console.log(`   Items for sale: ${profile.numSellItems}`);
      console.log(`   Business account: ${profile.isOrganizationalUser}`);
    }
  }

  console.log('');

  // 8. Get seller's items
  console.log('8. Get seller items');
  if (regularItem) {
    const sellerItems = await Mercapi.getSellerItems(regularItem.sellerId);
    console.log(`   Found ${sellerItems.items.length} items`);
    sellerItems.items.slice(0, 3).forEach((item, i) => {
      console.log(`   ${i + 1}. ¥${item.price} - ${item.name.slice(0, 30)}... (${item.status})`);
    });
    if (sellerItems.nextPageToken) {
      console.log(`   Has more items (token: ${sellerItems.nextPageToken.slice(0, 20)}...)`);
    }
  }

  console.log('');

  // 9. Pagination example
  console.log('9. Pagination example');
  let page = 1;
  let pageToken: string | undefined;
  let totalItems = 0;
  do {
    const pageResults = await Mercapi.search('manga', {
      sortBy: SortBy.CreatedTime,
      sortOrder: SortOrder.Desc,
      pageToken,
    });
    totalItems += pageResults.items.length;
    console.log(`   Page ${page}: ${pageResults.items.length} items`);
    pageToken = pageResults.meta.nextPageToken || undefined;
    page++;
  } while (pageToken && page <= 3); // Limit to 3 pages for demo
  console.log(`   Total fetched: ${totalItems} items`);

  console.log('');

  // 10. Instance with key reuse (for batch operations)
  console.log('10. Instance with key reuse');
  const client = new Mercapi({ reuseKeys: true });
  await client.rotateKeys();
  const r1 = await client.search('Nintendo');
  const r2 = await client.search('PlayStation');
  console.log(`   Search 1: ${r1.meta.numFound} items`);
  console.log(`   Search 2: ${r2.meta.numFound} items`);
  console.log('   (Same keys used for both requests)');

  console.log('\n=== Done! ===');
}

main().catch(console.error);
