import { KeyLike } from 'jose';
import { randomUUID } from 'crypto';
import { generateKeys, createDPoPToken } from './auth/dpop';
import {
  ENDPOINTS,
  MASTER_DATASETS,
  MasterDataset,
  DEFAULT_USER_AGENT,
  DEFAULT_HEADERS,
} from './requests/endpoints';
import { SortBy, SortOrder, ItemStatus } from './models/enums';
import { SearchOptions, SearchResult, SearchRequestPayload } from './models/search';
import { Item, ItemBrand } from './models/item';
import { Profile, SellerItems } from './models/profile';
import { Review } from './models/review';
import { SimilarItem, SearchSuggestion } from './models/related';
import { ShopsProduct } from './models/shops';
import { Badge, DesiredPriceInfo } from './models/social';

/** Options for fetching a seller's items */
export interface SellerItemsOptions {
  /** Maximum number of items to return (default: 30) */
  limit?: number;
  /** Statuses to include out of 'on_sale', 'trading', 'sold_out' (default: all) */
  status?: string[];
  /** Skip listings archived by the seller (default: false) */
  excludeArchivedItem?: boolean;
}

export interface MercapiOptions {
  /** Custom User-Agent string */
  userAgent?: string;
  /**
   * If true, reuse the same keys across requests.
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

  constructor(options?: MercapiOptions) {
    this.uuid = randomUUID();
    this.userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    this.reuseKeys = options?.reuseKeys ?? false;
  }

  /** Generate fresh ECDSA key pair */
  async rotateKeys(): Promise<void> {
    const keys = await generateKeys();
    this.privateKey = keys.privateKey;
    this.publicKey = keys.publicKey;
    this.uuid = randomUUID();
  }

  private async ensureKeys(): Promise<void> {
    if (!this.reuseKeys || !this.privateKey || !this.publicKey) {
      await this.rotateKeys();
    }
  }

  private async signedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    await this.ensureKeys();

    const method = options.method ?? 'GET';
    const dpopToken = await createDPoPToken(
      url,
      method,
      this.privateKey!,
      this.publicKey!,
      this.uuid
    );

    const headers = new Headers(options.headers);
    headers.set('User-Agent', this.userAgent);
    headers.set('DPoP', dpopToken);
    Object.entries(DEFAULT_HEADERS).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return fetch(url, {
      ...options,
      headers,
    });
  }

  /** Search for items on Mercari */
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const payload = this.buildSearchPayload(query, options);

    const response = await this.signedFetch(ENDPOINTS.SEARCH, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapSearchResponse(data, options);
  }

  /** Get item details by ID */
  async getItem(id: string, options?: { includeAuction?: boolean }): Promise<Item | null> {
    const includeAuction = options?.includeAuction ?? true;
    const url =
      `${ENDPOINTS.ITEM}?id=${encodeURIComponent(id)}` +
      `&include_item_attributes=true${includeAuction ? '&include_auction=true' : ''}`;
    const response = await this.signedFetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Get item failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapItemResponse(data);
  }

  /** Get seller profile by ID */
  async getProfile(userId: string): Promise<Profile | null> {
    const url = `${ENDPOINTS.PROFILE}?user_id=${encodeURIComponent(userId)}&_user_format=profile`;
    const response = await this.signedFetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Get profile failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapProfileResponse(data);
  }

  /** Get items from a seller */
  async getSellerItems(
    sellerId: string,
    pageToken?: string,
    options?: SellerItemsOptions
  ): Promise<SellerItems> {
    const params = new URLSearchParams({
      seller_id: sellerId,
      limit: String(options?.limit ?? 30),
      status: options?.status?.join(',') ?? 'on_sale,trading,sold_out',
      with_auction: 'true',
    });
    if (options?.excludeArchivedItem) {
      params.set('exclude_archived_item', 'true');
    }
    if (pageToken) {
      params.set('max_pager_id', pageToken);
    }

    const url = `${ENDPOINTS.SELLER_ITEMS}?${params.toString()}`;
    const response = await this.signedFetch(url);

    if (!response.ok) {
      throw new Error(`Get seller items failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapSellerItemsResponse(data);
  }

  /** Get reviews written about a user (newest first) */
  async getReviews(
    userId: string,
    options?: { limit?: number; maxPagerId?: number }
  ): Promise<Review[]> {
    const params = new URLSearchParams({
      user_id: userId,
      subject: 'seller,buyer',
      fame: 'good,normal,bad',
      limit: String(options?.limit ?? 20),
    });
    if (options?.maxPagerId != null) {
      params.set('max_pager_id', String(options.maxPagerId));
    }

    const response = await this.signedFetch(`${ENDPOINTS.REVIEWS}?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Get reviews failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapReviewsResponse(data);
  }

  /** Get items similar to a listing, as shown on the item page */
  async getSimilarItems(itemId: string, options?: { limit?: number }): Promise<SimilarItem[]> {
    const response = await this.signedFetch(ENDPOINTS.SIMILAR_ITEMS, {
      method: 'POST',
      body: JSON.stringify({
        itemId,
        pageSize: options?.limit ?? 15,
        itemTypesFlag: 'ITEM_TYPES_MERCARI_AND_SHOPS',
        includeAds: false,
        pageToken: '',
      }),
    });

    if (!response.ok) {
      throw new Error(`Get similar items failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapSimilarItemsResponse(data);
  }

  /** Get search bar autocomplete suggestions for a partial query */
  async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    const params = new URLSearchParams({
      word: query,
      brand_category_result_included: 'true',
    });
    const response = await this.signedFetch(
      `${ENDPOINTS.SEARCH_SUGGESTIONS}?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Get search suggestions failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapSearchSuggestionsResponse(data);
  }

  /**
   * Get Mercari Shops product details by product ID.
   * Search results with itemType ITEM_TYPE_BEYOND are Shops products.
   */
  async getShopsProduct(productId: string): Promise<ShopsProduct | null> {
    const url = `${ENDPOINTS.SHOPS_PRODUCT}/${encodeURIComponent(productId)}?view=FULL`;
    const response = await this.signedFetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Get shops product failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapShopsProductResponse(data);
  }

  /** Get achievement badges of a seller (e.g. fast shipping, high rating) */
  async getSellerBadges(userId: string): Promise<Badge[]> {
    const response = await this.signedFetch(ENDPOINTS.BADGES, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(`Get seller badges failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return ((data.badges as Record<string, unknown>[]) ?? []).map((b) => ({
      id: Number(b.id) || 0,
      name: (b.name as string) ?? '',
      description: (b.description as string) ?? '',
      iconUrl: (b.iconUrl as string) ?? '',
    }));
  }

  /** Check whether a user completed identity verification (本人確認) */
  async hasIdentityVerifiedBadge(userId: string): Promise<boolean> {
    const response = await this.signedFetch(ENDPOINTS.IDENTITY_VERIFIED_BADGE, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error(
        `Get identity verified badge failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return data.hasBadge === true;
  }

  /** Get aggregated "desired price" (希望価格) registrations for a listing */
  async getDesiredPriceInfo(itemId: string): Promise<DesiredPriceInfo | null> {
    const url = `${ENDPOINTS.DESIRED_PRICE_ITEMS}/${encodeURIComponent(itemId)}/desiredPriceInfo`;
    const response = await this.signedFetch(url);

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Get desired price info failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      itemId: ((data.name as string) ?? '').split('/')[1] ?? '',
      registeredCount: Number(data.registeredCount) || 0,
      highestDesiredPrice: Number(data.highestDesiredPrice) || 0,
      lowestDesiredPrice: Number(data.lowestDesiredPrice) || 0,
      highestDesiredPriceCount: Number(data.highestDesiredPriceCount) || 0,
    };
  }

  /**
   * Get reference (master) data enumerating IDs usable in search filters,
   * e.g. categories, brands, sizes, colors, conditions.
   * Returned as raw JSON since the schema differs per dataset.
   */
  async getMasterData(dataset: MasterDataset): Promise<Record<string, unknown>> {
    const response = await this.signedFetch(MASTER_DATASETS[dataset]);

    if (!response.ok) {
      throw new Error(`Get master data failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as Record<string, unknown>;
  }

  private buildSearchPayload(query: string, options?: SearchOptions): SearchRequestPayload {
    const status = options?.status ?? [ItemStatus.OnSale];
    const statusList = status.map((s) => s.toString());

    // Add STATUS_TRADING if STATUS_SOLD_OUT is included
    if (status.includes(ItemStatus.SoldOut) && !status.includes(ItemStatus.Trading)) {
      statusList.push(ItemStatus.Trading);
    }

    // Mirrors the payload sent by the official web app (jp.mercari.com)
    return {
      userId: '',
      config: {
        responseToggles: ['QUERY_SUGGESTION_WEB_1'],
      },
      pageSize: 120,
      pageToken: options?.pageToken ?? '',
      searchSessionId: randomUUID().replace(/-/g, ''),
      source: 'BaseSerp',
      indexRouting: 'INDEX_ROUTING_UNSPECIFIED',
      thumbnailTypes: [],
      searchCondition: {
        keyword: query,
        excludeKeyword: options?.excludeKeyword ?? '',
        sort: options?.sortBy ?? SortBy.Score,
        order: options?.sortOrder ?? SortOrder.Desc,
        status: statusList,
        sizeId: options?.sizes ?? [],
        categoryId: options?.categories ?? [],
        brandId: options?.brands ?? [],
        sellerId: options?.sellerIds ?? [],
        priceMin: options?.priceMin ?? 0,
        priceMax: options?.priceMax ?? 0,
        itemConditionId: options?.itemConditions ?? [],
        shippingPayerId: options?.shippingPayer ?? [],
        shippingFromArea: [],
        shippingMethod: [],
        colorId: options?.colors ?? [],
        hasCoupon: false,
        attributes: [],
        itemTypes: options?.itemTypes ?? [],
        skuIds: [],
        shopIds: [],
        excludeShippingMethodIds: [],
      },
      serviceFrom: 'suruga',
      withItemBrand: true,
      withItemSize: false,
      withItemPromotions: true,
      withItemSizes: true,
      withShopname: true,
      useDynamicAttribute: true,
      withSuggestedItems: true,
      withOfferPricePromotion: true,
      withProductSuggest: true,
      withParentProducts: false,
      withProductArticles: true,
      withSearchConditionId: false,
      withAuction: options?.withAuction ?? true,
      laplaceDeviceUuid: randomUUID(),
    };
  }

  private mapSearchResponse(
    data: Record<string, unknown>,
    options?: SearchOptions
  ): SearchResult {
    let items = ((data.items as Record<string, unknown>[]) ?? []).map((item) => {
      // Auction object uses camelCase keys; bidDeadline is an ISO 8601 string,
      // numbers are returned as strings (e.g. {"bidDeadline":"2026-02-20T11:41:10Z","totalBid":"16"})
      const auctionData = item.auction as Record<string, unknown> | null | undefined;
      const auction = auctionData
        ? {
            id: (auctionData.id as string) ?? '',
            endTime: auctionData.bidDeadline
              ? Math.floor(Date.parse(auctionData.bidDeadline as string) / 1000)
              : 0,
            totalBids: Number(auctionData.totalBid) || 0,
            highestBid: Number(auctionData.highestBid) || 0,
            initialPrice: Number(auctionData.initialPrice) || 0,
          }
        : undefined;

      // Check if shop item (Mercari Shops / Beyond)
      // itemType: 'ITEM_TYPE_BEYOND' = Shop, 'ITEM_TYPE_MERCARI' = Regular
      const isShopItem = item.itemType === 'ITEM_TYPE_BEYOND' || item.shop != null;

      // Brand object uses camelCase keys here (e.g. {"id":"7572","subName":"..."}),
      // unlike the snake_case item detail endpoint
      const brandData = item.itemBrand as Record<string, unknown> | null | undefined;
      const itemBrand = brandData
        ? {
            id: Number(brandData.id) || 0,
            name: (brandData.name as string) ?? '',
            subName: (brandData.subName as string) ?? '',
          }
        : undefined;

      return {
        id: item.id as string,
        sellerId: (item.sellerId as string) ?? '',
        name: item.name as string,
        price: Number(item.price) || 0,
        status: item.status as string,
        categoryId: Number(item.categoryId) || 0,
        itemConditionId: Number(item.itemConditionId) || 0,
        shippingPayerId: Number(item.shippingPayerId) || 0,
        thumbnails: (item.thumbnails as string[]) ?? [],
        created: Number(item.created) || 0,
        updated: Number(item.updated) || 0,
        isShopItem,
        auction,
        itemBrand,
        shopName: (item.shopName as string) || undefined,
      };
    });

    // Filter out shop items if requested
    if (options?.excludeShopItems) {
      items = items.filter((item) => !item.isShopItem);
    }

    return {
      items,
      meta: {
        numFound: Number((data.meta as Record<string, unknown>)?.numFound) || 0,
        nextPageToken: ((data.meta as Record<string, unknown>)?.nextPageToken as string) ?? '',
      },
    };
  }

  private mapItemResponse(data: Record<string, unknown>): Item {
    const d = (data.data as Record<string, unknown>) ?? data;
    const seller = (d.seller as Record<string, unknown>) ?? {};
    const ratings = (seller.ratings as Record<string, unknown>) ?? {};
    // API uses snake_case
    const category = (d.item_category as Record<string, unknown>) ?? {};
    const condition = (d.item_condition as Record<string, unknown>) ?? {};
    const brand = (d.item_brand as Record<string, unknown>) ?? null;
    const shippingPayer = (d.shipping_payer as Record<string, unknown>) ?? {};
    const shippingMethod = (d.shipping_method as Record<string, unknown>) ?? {};
    const shippingFromArea = (d.shipping_from_area as Record<string, unknown>) ?? {};
    const shippingDuration = (d.shipping_duration as Record<string, unknown>) ?? null;

    return {
      id: d.id as string,
      name: d.name as string,
      price: d.price as number,
      description: (d.description as string) ?? '',
      status: d.status as string,
      photos: (d.photos as string[]) ?? [],
      thumbnails: (d.thumbnails as string[]) ?? [],
      seller: {
        id: String(seller.id ?? ''),
        name: (seller.name as string) ?? '',
        photoUrl: (seller.photo_url as string) ?? '',
        numSellItems: (seller.num_sell_items as number) ?? 0,
        ratings: {
          good: (ratings.good as number) ?? 0,
          normal: (ratings.normal as number) ?? 0,
          bad: (ratings.bad as number) ?? 0,
        },
        numRatings: (seller.num_ratings as number) ?? 0,
        starRatingScore: (seller.star_rating_score as number) ?? 0,
        isFollowable: (seller.is_followable as boolean) ?? false,
        isBlocked: (seller.is_blocked as boolean) ?? false,
      },
      itemCategory: {
        id: category.id as number,
        name: (category.name as string) ?? '',
        parentCategoryId: (category.parent_category_id as number) ?? 0,
        parentCategoryName: (category.parent_category_name as string) ?? '',
        rootCategoryId: (category.root_category_id as number) ?? 0,
        rootCategoryName: (category.root_category_name as string) ?? '',
      },
      itemCondition: {
        id: (condition.id as number) ?? 0,
        name: (condition.name as string) ?? '',
      },
      itemBrand: this.mapItemBrand(brand),
      shippingPayer: {
        id: (shippingPayer.id as number) ?? 0,
        name: (shippingPayer.name as string) ?? '',
        code: (shippingPayer.code as string) ?? '',
      },
      shippingMethod: {
        id: (shippingMethod.id as number) ?? 0,
        name: (shippingMethod.name as string) ?? '',
      },
      shippingFromArea: {
        id: (shippingFromArea.id as number) ?? 0,
        name: (shippingFromArea.name as string) ?? '',
      },
      shippingDuration: shippingDuration
        ? {
            id: (shippingDuration.id as number) ?? 0,
            name: (shippingDuration.name as string) ?? '',
            minDays: (shippingDuration.min_days as number) ?? 0,
            maxDays: (shippingDuration.max_days as number) ?? 0,
          }
        : undefined,
      numLikes: (d.num_likes as number) ?? 0,
      numComments: (d.num_comments as number) ?? 0,
      comments: ((d.comments as Record<string, unknown>[]) ?? []).map((c) => ({
        id: c.id as string,
        message: c.message as string,
        user: {
          id: String((c.user as Record<string, unknown>)?.id ?? ''),
          name: ((c.user as Record<string, unknown>)?.name as string) ?? '',
          photoUrl: ((c.user as Record<string, unknown>)?.photo_url as string) ?? '',
        },
        created: c.created as number,
      })),
      created: d.created as number,
      updated: d.updated as number,
      isShopItem: d.is_shop_item === 'yes' || d.is_organizational_user === true,
      isAnonymousShipping: (d.is_anonymous_shipping as boolean) ?? false,
      isOfferable: (d.is_offerable as boolean) ?? false,
      auctionInfo: this.mapAuctionInfo(d.auction_info as Record<string, unknown> | undefined),
      itemAttributes: (d.item_attributes as Record<string, unknown>[]) ?? undefined,
    };
  }

  private mapAuctionInfo(
    auctionInfo: Record<string, unknown> | undefined
  ): Item['auctionInfo'] {
    if (!auctionInfo) {
      return undefined;
    }

    return {
      id: (auctionInfo.id as string) ?? '',
      startTime: (auctionInfo.start_time as number) ?? 0,
      endTime: (auctionInfo.expected_end_time as number) ?? 0,
      totalBids: (auctionInfo.total_bids as number) ?? 0,
      initialPrice: (auctionInfo.initial_price as number) ?? 0,
      highestBid: (auctionInfo.highest_bid as number) ?? 0,
      state: (auctionInfo.state as string) ?? '',
      auctionType: (auctionInfo.auction_type as string) ?? '',
    };
  }

  /** Maps snake_case brand objects (item detail, seller items) */
  private mapItemBrand(brand: Record<string, unknown> | null | undefined): ItemBrand | undefined {
    if (!brand) {
      return undefined;
    }

    return {
      id: Number(brand.id) || 0,
      name: (brand.name as string) ?? '',
      subName: (brand.sub_name as string) ?? '',
    };
  }

  private mapReviewsResponse(data: Record<string, unknown>): Review[] {
    return ((data.data as Record<string, unknown>[]) ?? []).map((r) => {
      const user = (r.user as Record<string, unknown>) ?? {};
      return {
        subject: (r.subject as string) ?? '',
        fame: (r.fame as string) ?? '',
        message: (r.message as string) ?? '',
        user: {
          id: String(user.id ?? ''),
          name: (user.name as string) ?? '',
          photoUrl: (user.photo_url as string) ?? '',
        },
        created: (r.created as number) ?? 0,
        pagerId: (r.pager_id as number) ?? 0,
      };
    });
  }

  private mapSimilarItemsResponse(data: Record<string, unknown>): SimilarItem[] {
    // Numbers are returned as strings (e.g. {"price":"1600"})
    return ((data.items as Record<string, unknown>[]) ?? []).map((item) => {
      const auctionInfo = item.auctionInfo as Record<string, unknown> | null | undefined;
      return {
        id: item.id as string,
        name: item.name as string,
        price: Number(item.price) || 0,
        status: (item.status as string) ?? '',
        thumbnail: (item.thumbnail as string) ?? '',
        itemType: (item.type as string) ?? '',
        auctionHighestBid: auctionInfo ? Number(auctionInfo.highestBid) || 0 : undefined,
      };
    });
  }

  private mapSearchSuggestionsResponse(data: Record<string, unknown>): SearchSuggestion[] {
    // Each entry is {"MixedQuery":{"Query":{"title":...,"search_params":{...}}}}
    return ((data.data as Record<string, unknown>[]) ?? [])
      .map((entry) => {
        const mixed = (entry.MixedQuery as Record<string, unknown>) ?? {};
        return mixed.Query as Record<string, unknown> | undefined;
      })
      .filter((query): query is Record<string, unknown> => query != null)
      .map((query) => {
        const searchParams = (query.search_params as Record<string, unknown>) ?? {};
        const categories = (searchParams.item_categories as Record<string, unknown>[]) ?? [];
        return {
          keyword: (searchParams.keyword as string) ?? '',
          title: (query.title as string) ?? '',
          subtitle: (query.subtitle as string) ?? '',
          categories: categories.map((c) => ({
            id: Number(c.id) || 0,
            name: (c.name as string) ?? '',
          })),
        };
      });
  }

  private mapShopsProductResponse(data: Record<string, unknown>): ShopsProduct {
    const detail = data.productDetail as Record<string, unknown> | null | undefined;
    const shop = detail?.shop as Record<string, unknown> | null | undefined;
    const shopStats = shop?.shopStats as Record<string, unknown> | null | undefined;

    return {
      id: data.name as string,
      displayName: (data.displayName as string) ?? '',
      price: Number(data.price) || 0,
      productTags: (data.productTags as string[]) ?? [],
      thumbnail: (data.thumbnail as string) ?? '',
      created: data.createTime ? Math.floor(Date.parse(data.createTime as string) / 1000) : 0,
      updated: data.updateTime ? Math.floor(Date.parse(data.updateTime as string) / 1000) : 0,
      photos: (detail?.photos as string[]) ?? [],
      description: (detail?.description as string) ?? '',
      shop: shop
        ? {
            id: (shop.name as string) ?? '',
            displayName: (shop.displayName as string) ?? '',
            thumbnail: (shop.thumbnail as string) ?? '',
            score: Number(shopStats?.score) || 0,
            reviewCount: Number(shopStats?.reviewCount) || 0,
          }
        : undefined,
      productDetail: detail ?? undefined,
    };
  }

  private mapProfileResponse(data: Record<string, unknown>): Profile {
    const d = (data.data as Record<string, unknown>) ?? data;
    const ratings = (d.ratings as Record<string, unknown>) ?? {};

    return {
      id: String(d.id ?? ''),
      name: (d.name as string) ?? '',
      photoUrl: (d.photo_url as string) ?? '',
      introduction: (d.introduction as string) ?? '',
      numSellItems: (d.num_sell_items as number) ?? 0,
      ratings: {
        good: (ratings.good as number) ?? 0,
        normal: (ratings.normal as number) ?? 0,
        bad: (ratings.bad as number) ?? 0,
      },
      numRatings: (d.num_ratings as number) ?? 0,
      starRatingScore: (d.star_rating_score as number) ?? 0,
      followerCount: (d.follower_count as number) ?? 0,
      followingCount: (d.following_count as number) ?? 0,
      isOrganizationalUser: (d.is_organizational_user as boolean) ?? false,
      created: d.created as number,
    };
  }

  private mapSellerItemsResponse(data: Record<string, unknown>): SellerItems {
    const rawItems = (data.data as Record<string, unknown>[]) ?? [];
    const items = rawItems.map((item) => ({
      id: item.id as string,
      name: item.name as string,
      price: item.price as number,
      status: item.status as string,
      thumbnails: (item.thumbnails as string[]) ?? [],
      created: item.created as number,
      updated: item.updated as number,
      isNoPrice: item.is_no_price === true,
      itemBrand: this.mapItemBrand(item.item_brand as Record<string, unknown> | undefined),
      auctionInfo: this.mapAuctionInfo(item.auction_info as Record<string, unknown> | undefined),
    }));

    // Paging: pass max_pager_id below the last item's pager_id to get the next page
    const hasNext = (data.meta as Record<string, unknown>)?.has_next === true;
    const lastPagerId = rawItems[rawItems.length - 1]?.pager_id as number | undefined;

    return {
      items,
      nextPageToken: hasNext && lastPagerId ? String(lastPagerId - 1) : '',
    };
  }

  // Static convenience methods - always use fresh keys
  static async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const client = new Mercapi();
    return client.search(query, options);
  }

  static async getItem(
    id: string,
    options?: { includeAuction?: boolean }
  ): Promise<Item | null> {
    const client = new Mercapi();
    return client.getItem(id, options);
  }

  static async getProfile(userId: string): Promise<Profile | null> {
    const client = new Mercapi();
    return client.getProfile(userId);
  }

  static async getSellerItems(
    sellerId: string,
    pageToken?: string,
    options?: SellerItemsOptions
  ): Promise<SellerItems> {
    const client = new Mercapi();
    return client.getSellerItems(sellerId, pageToken, options);
  }

  static async getReviews(
    userId: string,
    options?: { limit?: number; maxPagerId?: number }
  ): Promise<Review[]> {
    const client = new Mercapi();
    return client.getReviews(userId, options);
  }

  static async getSimilarItems(
    itemId: string,
    options?: { limit?: number }
  ): Promise<SimilarItem[]> {
    const client = new Mercapi();
    return client.getSimilarItems(itemId, options);
  }

  static async getSearchSuggestions(query: string): Promise<SearchSuggestion[]> {
    const client = new Mercapi();
    return client.getSearchSuggestions(query);
  }

  static async getShopsProduct(productId: string): Promise<ShopsProduct | null> {
    const client = new Mercapi();
    return client.getShopsProduct(productId);
  }

  static async getSellerBadges(userId: string): Promise<Badge[]> {
    const client = new Mercapi();
    return client.getSellerBadges(userId);
  }

  static async hasIdentityVerifiedBadge(userId: string): Promise<boolean> {
    const client = new Mercapi();
    return client.hasIdentityVerifiedBadge(userId);
  }

  static async getDesiredPriceInfo(itemId: string): Promise<DesiredPriceInfo | null> {
    const client = new Mercapi();
    return client.getDesiredPriceInfo(itemId);
  }

  static async getMasterData(dataset: MasterDataset): Promise<Record<string, unknown>> {
    const client = new Mercapi();
    return client.getMasterData(dataset);
  }
}

/** Factory function - creates instance with fresh keys */
export async function createMercapi(options?: MercapiOptions): Promise<Mercapi> {
  const client = new Mercapi(options);
  await client.rotateKeys();
  return client;
}
