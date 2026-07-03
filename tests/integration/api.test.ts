/**
 * Integration tests - tests against real Mercari API
 * Run with: npx vitest run tests/integration
 */

import { describe, it, expect } from 'vitest';
import { Mercapi, SortBy, SortOrder, ItemCondition, ShippingPayer } from '../../src/index';

describe('Mercapi Integration Tests', () => {
  describe('search', () => {
    it('should search for items', async () => {
      const results = await Mercapi.search('iPhone');

      expect(results.items.length).toBeGreaterThan(0);
      expect(results.meta.numFound).toBeGreaterThan(0);

      const item = results.items[0];
      expect(item.id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.price).toBeGreaterThan(0);
      expect(item.sellerId).toBeDefined();
      expect(typeof item.isShopItem).toBe('boolean');
    });

    it('should search with filters', async () => {
      const results = await Mercapi.search('カメラ', {
        priceMin: 1000,
        priceMax: 50000,
        itemConditions: [ItemCondition.BrandNew, ItemCondition.LikeNew],
        shippingPayer: [ShippingPayer.Seller],
        sortBy: SortBy.Price,
        sortOrder: SortOrder.Asc,
      });

      expect(results.items.length).toBeGreaterThan(0);

      // Verify price filter
      for (const item of results.items) {
        expect(item.price).toBeGreaterThanOrEqual(1000);
        expect(item.price).toBeLessThanOrEqual(50000);
      }
    });

    it('should search with auction data', async () => {
      const results = await Mercapi.search('ゲーム');

      expect(results.items.length).toBeGreaterThan(0);

      // Some items may have auction data
      const auctionItem = results.items.find((i) => i.auction);
      if (auctionItem?.auction) {
        expect(auctionItem.auction.endTime).toBeGreaterThan(Date.now() / 1000 - 86400);
        expect(auctionItem.auction.highestBid).toBeGreaterThan(0);
      }
    });

    it('should exclude shop items', async () => {
      const withShop = await Mercapi.search('iPhone');
      const withoutShop = await Mercapi.search('iPhone', { excludeShopItems: true });

      const shopCount = withShop.items.filter((i) => i.isShopItem).length;
      const filteredShopCount = withoutShop.items.filter((i) => i.isShopItem).length;

      expect(filteredShopCount).toBe(0);
      if (shopCount > 0) {
        expect(withoutShop.items.length).toBeLessThan(withShop.items.length);
      }
    });

    it('should paginate results', async () => {
      const page1 = await Mercapi.search('本', {
        sortBy: SortBy.CreatedTime,
        sortOrder: SortOrder.Desc,
      });

      expect(page1.meta.nextPageToken).toBeDefined();
      expect(page1.meta.nextPageToken.length).toBeGreaterThan(0);

      const page2 = await Mercapi.search('本', {
        sortBy: SortBy.CreatedTime,
        sortOrder: SortOrder.Desc,
        pageToken: page1.meta.nextPageToken,
      });

      expect(page2.items.length).toBeGreaterThan(0);
      // Items should be different
      expect(page2.items[0].id).not.toBe(page1.items[0].id);
    });
  });

  describe('getItem', () => {
    it('should get item details', async () => {
      // First search to get an item ID
      const results = await Mercapi.search('カメラ', { excludeShopItems: true });
      const searchItem = results.items.find((i) => !i.isShopItem);

      if (!searchItem) {
        console.log('No regular items found, skipping test');
        return;
      }

      const item = await Mercapi.getItem(searchItem.id);

      expect(item).not.toBeNull();
      expect(item!.id).toBe(searchItem.id);
      expect(item!.name).toBeDefined();
      expect(item!.price).toBeGreaterThan(0);
      expect(item!.description).toBeDefined();
      expect(item!.seller).toBeDefined();
      expect(item!.seller.id).toBeDefined();
      expect(item!.seller.name).toBeDefined();
      expect(item!.seller.ratings).toBeDefined();
      expect(item!.itemCategory).toBeDefined();
      expect(item!.itemCondition).toBeDefined();
      expect(item!.shippingPayer).toBeDefined();
      expect(item!.shippingMethod).toBeDefined();
      expect(typeof item!.isShopItem).toBe('boolean');
    });

    it('should get item with auction info', async () => {
      const results = await Mercapi.search('ゲーム');
      const auctionItem = results.items.find((i) => i.auction);

      if (!auctionItem) {
        console.log('No auction items found, skipping test');
        return;
      }

      const item = await Mercapi.getItem(auctionItem.id, { includeAuction: true });

      expect(item).not.toBeNull();
      if (item!.auctionInfo) {
        expect(item!.auctionInfo.id).toBeDefined();
        expect(item!.auctionInfo.state).toBeDefined();
        expect(typeof item!.auctionInfo.totalBids).toBe('number');
      }
    });

    it('should return null for non-existent item', async () => {
      const item = await Mercapi.getItem('m00000000000');

      expect(item).toBeNull();
    });
  });

  describe('getProfile', () => {
    it('should get seller profile', async () => {
      // First search to get a seller ID
      const results = await Mercapi.search('バッグ');
      const sellerId = results.items[0]?.sellerId;

      if (!sellerId) {
        console.log('No seller found, skipping test');
        return;
      }

      const profile = await Mercapi.getProfile(sellerId);

      expect(profile).not.toBeNull();
      expect(profile!.id).toBe(sellerId);
      expect(profile!.name).toBeDefined();
      expect(profile!.ratings).toBeDefined();
      expect(typeof profile!.ratings.good).toBe('number');
      expect(typeof profile!.numRatings).toBe('number');
      expect(typeof profile!.starRatingScore).toBe('number');
      expect(typeof profile!.followerCount).toBe('number');
    });

    it('should return null for non-existent user', async () => {
      const profile = await Mercapi.getProfile('0');

      expect(profile).toBeNull();
    });
  });

  describe('getSellerItems', () => {
    it('should get seller items', async () => {
      // First search to get a seller ID
      const results = await Mercapi.search('服');
      const sellerId = results.items[0]?.sellerId;

      if (!sellerId) {
        console.log('No seller found, skipping test');
        return;
      }

      const sellerItems = await Mercapi.getSellerItems(sellerId);

      expect(sellerItems.items).toBeDefined();
      expect(Array.isArray(sellerItems.items)).toBe(true);

      if (sellerItems.items.length > 0) {
        const item = sellerItems.items[0];
        expect(item.id).toBeDefined();
        expect(item.name).toBeDefined();
        expect(typeof item.price).toBe('number');
        expect(item.status).toBeDefined();
      }
    });
  });

  describe('instance with key reuse', () => {
    it('should work with reused keys', async () => {
      const client = new Mercapi({ reuseKeys: true });

      const results1 = await client.search('Nintendo');
      const results2 = await client.search('PlayStation');

      expect(results1.items.length).toBeGreaterThan(0);
      expect(results2.items.length).toBeGreaterThan(0);
    });

    it('should work after key rotation', async () => {
      const client = new Mercapi({ reuseKeys: true });

      const results1 = await client.search('Sony');
      await client.rotateKeys();
      const results2 = await client.search('Apple');

      expect(results1.items.length).toBeGreaterThan(0);
      expect(results2.items.length).toBeGreaterThan(0);
    });
  });
});
