/**
 * Unit tests for APIs added in the 2026-07 port from Python mercapi.
 * All mock payloads are sampled from real API responses (captured 2026-07-16).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Mercapi } from '../../src/mercapi';
import { ItemType } from '../../src/models/enums';

describe('new APIs', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;
  const client = new Mercapi();

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const jsonResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    json: async () => body,
  });

  describe('search filters', () => {
    it('should send itemTypes and sellerIds in the payload', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ items: [], meta: { numFound: '0', nextPageToken: '' } })
      );

      await client.search('switch', {
        itemTypes: [ItemType.Beyond],
        sellerIds: ['149861924'],
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.searchCondition.itemTypes).toEqual(['ITEM_TYPE_BEYOND']);
      expect(body.searchCondition.sellerId).toEqual(['149861924']);
      expect(body.withShopname).toBe(true);
    });

    it('should map itemBrand and shopName from search results', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          meta: { nextPageToken: 'v1:1', previousPageToken: '', numFound: '15000' },
          items: [
            {
              id: 'm88004407564',
              sellerId: '541927109',
              status: 'ITEM_STATUS_ON_SALE',
              name: '箱付きNintendo Switch',
              price: '19990',
              created: '1784163178',
              updated: '1784163178',
              thumbnails: ['https://static.mercdn.net/thumb/item/webp/m88004407564_1.jpg'],
              itemType: 'ITEM_TYPE_MERCARI',
              itemConditionId: '4',
              shippingPayerId: '2',
              itemBrand: { id: '7572', name: 'Nintendo Switch', subName: 'Nintendo Switch' },
              shopName: '',
              shippingMethodId: '14',
              categoryId: '701',
              isNoPrice: false,
              isLiked: false,
              auction: null,
              shop: null,
            },
            {
              id: '2JU2AaspVUmSxojixGoP7x',
              sellerId: '',
              status: 'ITEM_STATUS_ON_SALE',
              name: '中古品 ゲーム ソフト',
              price: '4710',
              created: '1784163178',
              updated: '1784163178',
              thumbnails: [],
              itemType: 'ITEM_TYPE_BEYOND',
              itemConditionId: '5',
              shippingPayerId: '1',
              itemBrand: null,
              shopName: 'ココアールSHOP',
              categoryId: '702',
              isNoPrice: false,
              isLiked: false,
              auction: null,
              shop: null,
            },
          ],
        })
      );

      const result = await client.search('switch');

      expect(result.items[0].itemBrand).toEqual({
        id: 7572,
        name: 'Nintendo Switch',
        subName: 'Nintendo Switch',
      });
      expect(result.items[0].shopName).toBeUndefined();
      expect(result.items[1].isShopItem).toBe(true);
      expect(result.items[1].shopName).toBe('ココアールSHOP');
    });
  });

  describe('getItem', () => {
    it('should request item attributes and auction by default', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ data: { id: 'm1', name: 'x', price: 100, status: 'on_sale' } })
      );

      await client.getItem('m1');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('include_item_attributes=true');
      expect(url).toContain('include_auction=true');
    });
  });

  describe('getSellerItems', () => {
    it('should apply options and map auction/brand fields', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          result: 'OK',
          meta: { has_next: true },
          data: [
            {
              id: 'm52391376591',
              seller: { id: 251740229, name: 'dont-use-this' },
              status: 'on_sale',
              name: 'ポケットモンスター バイオレット Switch',
              price: 2800,
              thumbnails: ['https://static.mercdn.net/thumb/item/webp/m52391376591_1.jpg'],
              created: 1784102690,
              updated: 1784114201,
              pager_id: 123456789,
              is_no_price: false,
              item_brand: { id: 7572, name: 'Nintendo Switch', sub_name: 'Nintendo Switch' },
              auction_info: {
                id: '100037812',
                start_time: 1784103716,
                expected_end_time: 1784200860,
                total_bids: 13,
                initial_price: 300,
                highest_bid: 2800,
                state: 'STATE_ONGOING',
                auction_type: 'AUCTION_TYPE_NORMAL',
              },
            },
          ],
        })
      );

      const result = await client.getSellerItems('251740229', undefined, {
        limit: 5,
        status: ['on_sale'],
        excludeArchivedItem: true,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('limit=5');
      expect(url).toContain('status=on_sale');
      expect(url).toContain('with_auction=true');
      expect(url).toContain('exclude_archived_item=true');

      const item = result.items[0];
      expect(item.isNoPrice).toBe(false);
      expect(item.itemBrand?.subName).toBe('Nintendo Switch');
      expect(item.auctionInfo?.state).toBe('STATE_ONGOING');
      expect(item.auctionInfo?.totalBids).toBe(13);
    });
  });

  describe('getReviews', () => {
    it('should map reviews and pass pagination params', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          result: 'OK',
          data: [
            {
              subject: 'seller',
              user: {
                id: 246536698,
                name: 'Yangヨウ',
                photo_url: 'https://static.mercdn.net/members/resized/webp/246536698.jpg',
                photo_thumbnail_url: 'https://static.mercdn.net/thumb/members/webp/246536698.jpg',
              },
              fame: 'good',
              message: 'この度はお取引ありがとうございました。',
              created: 1780239600,
              pager_id: 1780884764,
            },
          ],
        })
      );

      const reviews = await client.getReviews('149861924', { limit: 5, maxPagerId: 999 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('user_id=149861924');
      expect(url).toContain('limit=5');
      expect(url).toContain('max_pager_id=999');

      expect(reviews).toHaveLength(1);
      expect(reviews[0].subject).toBe('seller');
      expect(reviews[0].fame).toBe('good');
      expect(reviews[0].user.id).toBe('246536698');
      expect(reviews[0].pagerId).toBe(1780884764);
    });
  });

  describe('getSimilarItems', () => {
    it('should map similar items including auction bids', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: 'm79114810811',
              name: 'Nintendo Switch スーパーマリオRPG',
              price: '1600',
              status: 'on_sale',
              thumbnail: 'https://static.mercdn.net/thumb/item/webp/m79114810811_1.jpg',
              type: 'ITEM_TYPE_MERCARI',
              auctionInfo: null,
              isLiked: false,
              categoryId: '0',
              shippingMethodId: '0',
            },
            {
              id: 'm40561455902',
              name: 'スーパーマリオRPG Nintendo Switch',
              price: '2000',
              status: 'on_sale',
              thumbnail: 'https://static.mercdn.net/thumb/item/webp/m40561455902_1.jpg',
              type: 'ITEM_TYPE_MERCARI',
              auctionInfo: { id: '0', highestBid: '2000' },
              isLiked: false,
              categoryId: '0',
              shippingMethodId: '0',
            },
          ],
          ads: [],
          nextPageToken: 'F_-JBAEBBkN1cnNvcgH_igAB',
        })
      );

      const items = await client.getSimilarItems('m52727558625', { limit: 5 });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.itemId).toBe('m52727558625');
      expect(body.pageSize).toBe(5);

      expect(items).toHaveLength(2);
      expect(items[0].price).toBe(1600);
      expect(items[0].auctionHighestBid).toBeUndefined();
      expect(items[1].auctionHighestBid).toBe(2000);
    });
  });

  describe('getSearchSuggestions', () => {
    it('should map suggestions with categories', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              MixedQuery: {
                Query: {
                  title: 'ニンテンドースイッチ',
                  subtitle: 'テレビゲーム',
                  search_params: {
                    keyword: 'ニンテンドースイッチ',
                    item_categories: [{ id: 76, name: 'テレビゲーム' }],
                  },
                  score: 0.049118448,
                },
              },
            },
            {
              MixedQuery: {
                Query: {
                  title: 'ニンテンドーミュージアム',
                  search_params: { keyword: 'ニンテンドーミュージアム' },
                },
              },
            },
          ],
          meta: { requested: 1784167847 },
          result: 'OK',
        })
      );

      const suggestions = await client.getSearchSuggestions('ニンテンド');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].keyword).toBe('ニンテンドースイッチ');
      expect(suggestions[0].subtitle).toBe('テレビゲーム');
      expect(suggestions[0].categories).toEqual([{ id: 76, name: 'テレビゲーム' }]);
      expect(suggestions[1].categories).toEqual([]);
    });
  });

  describe('getShopsProduct', () => {
    it('should map product, photos, and shop stats', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          name: '2JU2AaspVUmSxojixGoP7x',
          displayName: ' 中古品 ゲーム Nintendo switch ソフト ワン・ツー・スイッチ',
          productTags: [],
          thumbnail: 'https://assets.mercari-shops-static.com/-/small/plain/thumb.jpg@webp',
          price: '4710',
          createTime: '2026-07-15T15:51:35Z',
          updateTime: '2026-07-15T15:51:35Z',
          attributes: [],
          isBlockedShop: false,
          productDetail: {
            shop: {
              name: 'mGum5FmNUqx6bTjjUt2h6Y',
              displayName: 'ココアールSHOP',
              thumbnail: 'https://assets.mercari-shops-static.com/-/small/plain/shop.png@jpg',
              shopStats: { shopId: 'mGum5FmNUqx6bTjjUt2h6Y', score: 5, reviewCount: '10104' },
            },
            photos: ['https://assets.mercari-shops-static.com/-/large/plain/p1.jpg@jpg'],
            description: '管理NO：GY0008435',
            condition: { displayName: '傷や汚れあり' },
          },
        })
      );

      const product = await client.getShopsProduct('2JU2AaspVUmSxojixGoP7x');

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/2JU2AaspVUmSxojixGoP7x?view=FULL');

      expect(product?.id).toBe('2JU2AaspVUmSxojixGoP7x');
      expect(product?.price).toBe(4710);
      expect(product?.created).toBe(Math.floor(Date.parse('2026-07-15T15:51:35Z') / 1000));
      expect(product?.photos).toHaveLength(1);
      expect(product?.shop?.displayName).toBe('ココアールSHOP');
      expect(product?.shop?.reviewCount).toBe(10104);
      expect(product?.productDetail?.condition).toEqual({ displayName: '傷や汚れあり' });
    });

    it('should return null for 404', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
      expect(await client.getShopsProduct('2JU2000000000000000000')).toBeNull();
    });
  });

  describe('getSellerBadges', () => {
    it('should map badges', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          badges: [
            {
              id: '10004',
              name: '高評価',
              description: '直近の取引の評価がすべて「良かった」の出品者',
              iconUrl: 'https://static.mercdn.net/images/badges/seller/highly_rated.png',
            },
          ],
        })
      );

      const badges = await client.getSellerBadges('149861924');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({ userId: '149861924' });
      expect(badges).toEqual([
        {
          id: 10004,
          name: '高評価',
          description: '直近の取引の評価がすべて「良かった」の出品者',
          iconUrl: 'https://static.mercdn.net/images/badges/seller/highly_rated.png',
        },
      ]);
    });
  });

  describe('hasIdentityVerifiedBadge', () => {
    it('should return the badge flag', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ hasBadge: false }));
      expect(await client.hasIdentityVerifiedBadge('149861924')).toBe(false);
    });
  });

  describe('getDesiredPriceInfo', () => {
    it('should map desired price info', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          name: 'desiredPriceItems/m52727558625',
          highestDesiredPrice: '1500',
          userRegisteredDesiredPrice: '0',
          registeredCount: '3',
          highestDesiredPriceCount: '2',
          lowestDesiredPrice: '1000',
        })
      );

      const info = await client.getDesiredPriceInfo('m52727558625');

      expect(info).toEqual({
        itemId: 'm52727558625',
        registeredCount: 3,
        highestDesiredPrice: 1500,
        lowestDesiredPrice: 1000,
        highestDesiredPriceCount: 2,
      });
    });
  });

  describe('getMasterData', () => {
    it('should fetch the requested dataset', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({
          conditions: [{ id: '1', name: '新品、未使用', subname: '新品で購入し、一度も使用していない' }],
          nextPageToken: '',
        })
      );

      const data = await client.getMasterData('itemConditions');

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.mercari.jp/services/master/v1/itemConditions'
      );
      expect((data.conditions as unknown[]).length).toBe(1);
    });
  });
});
