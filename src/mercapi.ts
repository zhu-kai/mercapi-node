import { KeyLike } from 'jose';
import { randomUUID } from 'crypto';
import { generateKeys, createDPoPToken } from './auth/dpop';
import { ENDPOINTS, DEFAULT_USER_AGENT, DEFAULT_HEADERS } from './requests/endpoints';
import { SortBy, SortOrder, ItemStatus } from './models/enums';
import { SearchOptions, SearchResult, SearchRequestPayload } from './models/search';
import { Item } from './models/item';
import { Profile, SellerItems } from './models/profile';

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
    const includeAuction = options?.includeAuction ?? false;
    const url = `${ENDPOINTS.ITEM}?id=${encodeURIComponent(id)}${includeAuction ? '&include_auction=true' : ''}`;
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
    const url = `${ENDPOINTS.PROFILE}?user_id=${encodeURIComponent(userId)}`;
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
  async getSellerItems(sellerId: string, pageToken?: string): Promise<SellerItems> {
    const params = new URLSearchParams({
      seller_id: sellerId,
      limit: '30',
      status: 'on_sale,trading,sold_out',
    });
    if (pageToken) {
      params.set('page_token', pageToken);
    }

    const url = `${ENDPOINTS.SELLER_ITEMS}?${params.toString()}`;
    const response = await this.signedFetch(url);

    if (!response.ok) {
      throw new Error(`Get seller items failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return this.mapSellerItemsResponse(data);
  }

  private buildSearchPayload(query: string, options?: SearchOptions): SearchRequestPayload {
    const status = options?.status ?? [ItemStatus.OnSale];
    const statusList = status.map((s) => s.toString());

    // Add STATUS_TRADING if STATUS_SOLD_OUT is included
    if (status.includes(ItemStatus.SoldOut) && !status.includes(ItemStatus.Trading)) {
      statusList.push(ItemStatus.Trading);
    }

    return {
      userId: '',
      pageSize: 120,
      pageToken: options?.pageToken ?? '',
      searchSessionId: randomUUID(),
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
        sellerId: [],
        priceMin: options?.priceMin ?? 0,
        priceMax: options?.priceMax ?? 0,
        itemConditionId: options?.itemConditions ?? [],
        shippingPayerId: options?.shippingPayer ?? [],
        shippingFromArea: [],
        shippingMethod: [],
        colorId: options?.colors ?? [],
        hasCoupon: false,
        attributes: [],
        itemTypes: [],
        skuIds: [],
      },
      defaultDatasets: [],
      serviceFrom: 'suruga',
      withAuction: options?.withAuction ?? false,
    };
  }

  private mapSearchResponse(
    data: Record<string, unknown>,
    options?: SearchOptions
  ): SearchResult {
    let items = ((data.items as Record<string, unknown>[]) ?? []).map((item) => {
      // Check for auction data
      const auctionData = item.auction as Record<string, unknown> | undefined;
      const auction = auctionData
        ? {
            id: (auctionData.id as string) ?? '',
            endTime: (auctionData.bid_deadline as number) ?? 0,
            totalBids: (auctionData.total_bid as number) ?? 0,
            highestBid: (auctionData.highest_bid as number) ?? 0,
          }
        : undefined;

      // Check if shop item (Mercari Shops / Beyond)
      // itemType: 'ITEM_TYPE_BEYOND' = Shop, 'ITEM_TYPE_MERCARI' = Regular
      const isShopItem = item.itemType === 'ITEM_TYPE_BEYOND' || item.shop != null;

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
      };
    });

    // Filter out shop items if requested
    if (options?.excludeShopItems) {
      items = items.filter((item) => !item.isShopItem);
    }

    return {
      items,
      meta: {
        numFound: ((data.meta as Record<string, unknown>)?.numFound as number) ?? 0,
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
      itemBrand: brand
        ? {
            id: (brand.id as number) ?? 0,
            name: (brand.name as string) ?? '',
            subName: (brand.sub_name as string) ?? '',
          }
        : undefined,
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
    const items = ((data.data as Record<string, unknown>[]) ?? []).map((item) => ({
      id: item.id as string,
      name: item.name as string,
      price: item.price as number,
      status: item.status as string,
      thumbnails: (item.thumbnails as string[]) ?? [],
      created: item.created as number,
      updated: item.updated as number,
    }));

    return {
      items,
      nextPageToken: (data.pager_id as string) ?? '',
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

  static async getSellerItems(sellerId: string, pageToken?: string): Promise<SellerItems> {
    const client = new Mercapi();
    return client.getSellerItems(sellerId, pageToken);
  }
}

/** Factory function - creates instance with fresh keys */
export async function createMercapi(options?: MercapiOptions): Promise<Mercapi> {
  const client = new Mercapi(options);
  await client.rotateKeys();
  return client;
}
