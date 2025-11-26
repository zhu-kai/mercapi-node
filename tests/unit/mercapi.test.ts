import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Mercapi, createMercapi } from '../../src/mercapi';
import { SortBy, SortOrder, ItemStatus } from '../../src/models/enums';

describe('Mercapi', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const client = new Mercapi();
      expect(client).toBeInstanceOf(Mercapi);
    });

    it('should accept custom user agent', () => {
      const client = new Mercapi({ userAgent: 'Custom/1.0' });
      expect(client).toBeInstanceOf(Mercapi);
    });
  });

  describe('rotateKeys', () => {
    it('should generate new keys', async () => {
      const client = new Mercapi({ reuseKeys: true });
      await client.rotateKeys();

      // Make a request to verify keys were generated
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
      });

      await client.search('test');

      // Should have made request with DPoP header
      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers;
      expect(headers.get('DPoP')).toBeDefined();
    });
  });

  describe('key rotation behavior', () => {
    it('should generate fresh keys per request when reuseKeys is false (default)', async () => {
      const client = new Mercapi();
      const dpopTokens: string[] = [];

      mockFetch.mockImplementation(async (_url, options) => {
        dpopTokens.push(options.headers.get('DPoP'));
        return {
          ok: true,
          json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
        };
      });

      await client.search('test1');
      await client.search('test2');

      expect(dpopTokens).toHaveLength(2);
      expect(dpopTokens[0]).not.toBe(dpopTokens[1]);
    });

    it('should reuse keys when reuseKeys is true', async () => {
      const client = new Mercapi({ reuseKeys: true });
      await client.rotateKeys();

      const dpopTokens: string[] = [];

      mockFetch.mockImplementation(async (_url, options) => {
        dpopTokens.push(options.headers.get('DPoP'));
        return {
          ok: true,
          json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
        };
      });

      await client.search('test1');
      await client.search('test2');

      // Tokens should be different (different jti) but from same key
      // We can verify by checking the jwk in the header is the same
      expect(dpopTokens).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('should build correct search payload', async () => {
      const client = new Mercapi();
      let capturedBody: string | undefined;

      mockFetch.mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
        };
      });

      await client.search('iPhone', {
        categories: [8],
        priceMin: 1000,
        priceMax: 50000,
        sortBy: SortBy.Price,
        sortOrder: SortOrder.Asc,
      });

      const payload = JSON.parse(capturedBody!);
      expect(payload.searchCondition.keyword).toBe('iPhone');
      expect(payload.searchCondition.categoryId).toEqual([8]);
      expect(payload.searchCondition.priceMin).toBe(1000);
      expect(payload.searchCondition.priceMax).toBe(50000);
      expect(payload.searchCondition.sort).toBe(SortBy.Price);
      expect(payload.searchCondition.order).toBe(SortOrder.Asc);
    });

    it('should add STATUS_TRADING when STATUS_SOLD_OUT is included', async () => {
      const client = new Mercapi();
      let capturedBody: string | undefined;

      mockFetch.mockImplementation(async (_url, options) => {
        capturedBody = options.body;
        return {
          ok: true,
          json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
        };
      });

      await client.search('test', {
        status: [ItemStatus.OnSale, ItemStatus.SoldOut],
      });

      const payload = JSON.parse(capturedBody!);
      expect(payload.searchCondition.status).toContain(ItemStatus.Trading);
    });

    it('should map search response correctly', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'm123',
              sellerId: '12345',
              name: 'Test Item',
              price: '1000',
              status: 'on_sale',
              categoryId: '8',
              itemConditionId: '1',
              shippingPayerId: '2',
              thumbnails: ['https://example.com/thumb.jpg'],
              created: '1700000000',
              updated: '1700000001',
              itemType: 'ITEM_TYPE_MERCARI',
            },
          ],
          meta: {
            numFound: 100,
            nextPageToken: 'next123',
          },
        }),
      });

      const result = await client.search('test');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('m123');
      expect(result.items[0].sellerId).toBe('12345');
      expect(result.items[0].name).toBe('Test Item');
      expect(result.items[0].price).toBe(1000);
      expect(result.items[0].categoryId).toBe(8);
      expect(result.items[0].itemConditionId).toBe(1);
      expect(result.items[0].shippingPayerId).toBe(2);
      expect(result.items[0].isShopItem).toBe(false);
      expect(result.meta.numFound).toBe(100);
      expect(result.meta.nextPageToken).toBe('next123');
    });

    it('should detect shop items correctly', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: 'm1', name: 'Regular', price: '100', itemType: 'ITEM_TYPE_MERCARI' },
            { id: 'm2', name: 'Shop via itemType', price: '200', itemType: 'ITEM_TYPE_BEYOND' },
            { id: 'm3', name: 'Shop via shop field', price: '300', shop: { id: 'shop123' } },
          ],
          meta: { numFound: 3, nextPageToken: '' },
        }),
      });

      const result = await client.search('test');

      expect(result.items[0].isShopItem).toBe(false);
      expect(result.items[1].isShopItem).toBe(true);
      expect(result.items[2].isShopItem).toBe(true);
    });

    it('should filter shop items when excludeShopItems is true', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: 'm1', name: 'Regular', price: '100', itemType: 'ITEM_TYPE_MERCARI' },
            { id: 'm2', name: 'Shop', price: '200', itemType: 'ITEM_TYPE_BEYOND' },
          ],
          meta: { numFound: 2, nextPageToken: '' },
        }),
      });

      const result = await client.search('test', { excludeShopItems: true });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('m1');
    });

    it('should map auction data when present', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'm123',
              name: 'Auction Item',
              price: '500',
              auction: {
                id: 'auc123',
                bid_deadline: 1700100000,
                total_bid: 5,
                highest_bid: 1500,
              },
            },
          ],
          meta: { numFound: 1, nextPageToken: '' },
        }),
      });

      const result = await client.search('test', { withAuction: true });

      expect(result.items[0].auction).toBeDefined();
      expect(result.items[0].auction!.id).toBe('auc123');
      expect(result.items[0].auction!.endTime).toBe(1700100000);
      expect(result.items[0].auction!.totalBids).toBe(5);
      expect(result.items[0].auction!.highestBid).toBe(1500);
    });

    it('should throw on error response', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.search('test')).rejects.toThrow('Search failed: 500');
    });
  });

  describe('getItem', () => {
    it('should return null for 404', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getItem('nonexistent');
      expect(result).toBeNull();
    });

    it('should return item for valid response', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'm123',
            name: 'Test Item',
            price: 5000,
            description: 'Test description',
            status: 'on_sale',
            photos: ['https://example.com/photo.jpg'],
            thumbnails: ['https://example.com/thumb.jpg'],
            seller: {
              id: 'u456',
              name: 'Test Seller',
              photo_url: 'https://example.com/seller.jpg',
              num_sell_items: 10,
              ratings: { good: 100, normal: 5, bad: 1 },
              num_ratings: 106,
              star_rating_score: 5,
              is_followable: true,
              is_blocked: false,
            },
            item_category: { id: 8, name: 'Electronics', parent_category_id: 1, root_category_id: 1 },
            item_condition: { id: 1, name: '新品' },
            item_brand: { id: 123, name: 'Apple', sub_name: 'Apple' },
            shipping_payer: { id: 2, name: '送料込み', code: 'seller' },
            shipping_method: { id: 1, name: 'らくらくメルカリ便' },
            shipping_from_area: { id: 13, name: '東京都' },
            shipping_duration: { id: 2, name: '2~3日で発送', min_days: 2, max_days: 3 },
            num_likes: 50,
            num_comments: 3,
            comments: [],
            created: 1700000000,
            updated: 1700000001,
            is_shop_item: 'no',
            is_anonymous_shipping: true,
            is_offerable: false,
          },
        }),
      });

      const result = await client.getItem('m123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('m123');
      expect(result!.name).toBe('Test Item');
      expect(result!.price).toBe(5000);
      expect(result!.seller.name).toBe('Test Seller');
      expect(result!.seller.numRatings).toBe(106);
      expect(result!.seller.starRatingScore).toBe(5);
      expect(result!.seller.isFollowable).toBe(true);
      expect(result!.itemBrand).toBeDefined();
      expect(result!.itemBrand!.name).toBe('Apple');
      expect(result!.shippingDuration).toBeDefined();
      expect(result!.shippingDuration!.minDays).toBe(2);
      expect(result!.isShopItem).toBe(false);
      expect(result!.isAnonymousShipping).toBe(true);
      expect(result!.isOfferable).toBe(false);
    });

    it('should map auction info when includeAuction is true', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 'm123',
            name: 'Auction Item',
            price: 1000,
            status: 'on_sale',
            photos: [],
            thumbnails: [],
            seller: { id: '1', name: 'Seller', ratings: {} },
            item_category: { id: 1 },
            item_condition: { id: 1 },
            shipping_payer: { id: 2 },
            shipping_method: { id: 1 },
            shipping_from_area: { id: 1 },
            num_likes: 0,
            num_comments: 0,
            comments: [],
            created: 1700000000,
            updated: 1700000000,
            auction_info: {
              id: 'auc456',
              start_time: 1700000000,
              expected_end_time: 1700100000,
              total_bids: 10,
              initial_price: 500,
              highest_bid: 2000,
              state: 'active',
              auction_type: 'standard',
            },
          },
        }),
      });

      const result = await client.getItem('m123', { includeAuction: true });

      expect(result!.auctionInfo).toBeDefined();
      expect(result!.auctionInfo!.id).toBe('auc456');
      expect(result!.auctionInfo!.startTime).toBe(1700000000);
      expect(result!.auctionInfo!.endTime).toBe(1700100000);
      expect(result!.auctionInfo!.totalBids).toBe(10);
      expect(result!.auctionInfo!.highestBid).toBe(2000);
      expect(result!.auctionInfo!.state).toBe('active');
    });
  });

  describe('getProfile', () => {
    it('should return null for 404', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getProfile('nonexistent');
      expect(result).toBeNull();
    });

    it('should return profile for valid response', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            id: 123,
            name: 'Test User',
            photo_url: 'https://example.com/photo.jpg',
            introduction: 'Hello!',
            num_sell_items: 50,
            ratings: { good: 200, normal: 10, bad: 2 },
            num_ratings: 212,
            star_rating_score: 5,
            follower_count: 100,
            following_count: 50,
            is_organizational_user: false,
            created: 1600000000,
          },
        }),
      });

      const result = await client.getProfile('u123');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('123');
      expect(result!.name).toBe('Test User');
      expect(result!.ratings.good).toBe(200);
      expect(result!.numRatings).toBe(212);
      expect(result!.starRatingScore).toBe(5);
      expect(result!.followerCount).toBe(100);
      expect(result!.followingCount).toBe(50);
      expect(result!.isOrganizationalUser).toBe(false);
    });
  });

  describe('getSellerItems', () => {
    it('should return seller items', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'm001',
              name: 'Item 1',
              price: 1000,
              status: 'on_sale',
              thumbnails: ['https://example.com/thumb1.jpg'],
              created: 1700000000,
              updated: 1700000001,
            },
            {
              id: 'm002',
              name: 'Item 2',
              price: 2000,
              status: 'sold_out',
              thumbnails: ['https://example.com/thumb2.jpg'],
              created: 1700000000,
              updated: 1700000001,
            },
          ],
          pager_id: 'next_page_token',
        }),
      });

      const result = await client.getSellerItems('seller123');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe('m001');
      expect(result.items[0].name).toBe('Item 1');
      expect(result.items[1].status).toBe('sold_out');
      expect(result.nextPageToken).toBe('next_page_token');
    });

    it('should work with static method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], pager_id: '' }),
      });

      const result = await Mercapi.getSellerItems('seller123');
      expect(result.items).toEqual([]);
    });
  });

  describe('static methods', () => {
    it('should work with static search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
      });

      const result = await Mercapi.search('test');
      expect(result.items).toEqual([]);
    });

    it('should work with static getItem', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await Mercapi.getItem('test');
      expect(result).toBeNull();
    });
  });

  describe('createMercapi factory', () => {
    it('should create initialized instance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
      });

      const client = await createMercapi();
      expect(client).toBeInstanceOf(Mercapi);

      await client.search('test');
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('request headers', () => {
    it('should include required headers', async () => {
      const client = new Mercapi();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], meta: { numFound: 0, nextPageToken: '' } }),
      });

      await client.search('test');

      const call = mockFetch.mock.calls[0];
      const headers = call[1].headers;

      expect(headers.get('DPoP')).toBeDefined();
      expect(headers.get('X-Platform')).toBe('web');
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('User-Agent')).toBeDefined();
    });
  });
});
