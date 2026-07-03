import { ItemStatus, SortBy, SortOrder } from './enums';

/** Search filter options */
export interface SearchOptions {
  /** Category IDs to filter */
  categories?: number[];
  /** Brand IDs to filter */
  brands?: number[];
  /** Size IDs to filter (category-dependent) */
  sizes?: number[];
  /** Minimum price in JPY (0 = no minimum) */
  priceMin?: number;
  /** Maximum price in JPY (0 = no maximum) */
  priceMax?: number;
  /** Item condition IDs (1-6) */
  itemConditions?: number[];
  /** Shipping payer IDs (1=buyer, 2=seller) */
  shippingPayer?: number[];
  /** Color IDs (1-12) */
  colors?: number[];
  /** Item status filter */
  status?: ItemStatus[];
  /** Sort field */
  sortBy?: SortBy;
  /** Sort direction */
  sortOrder?: SortOrder;
  /** Keywords to exclude from results */
  excludeKeyword?: string;
  /** Pagination token from previous response */
  pageToken?: string;
  /** Include auction data in results (default: true) */
  withAuction?: boolean;
  /** Exclude shop items from results (default: false, includes all) */
  excludeShopItems?: boolean;
}

/** Auction info in search results (summary) */
export interface SearchAuction {
  /** Auction ID (may be empty in search results) */
  id: string;
  /** Bid deadline as Unix timestamp in seconds */
  endTime: number;
  /** Total number of bids */
  totalBids: number;
  /** Current highest bid amount */
  highestBid: number;
  /** Starting price in JPY */
  initialPrice: number;
}

/** Single item in search results */
export interface SearchResultItem {
  /** Item ID (e.g., "m12345678901") */
  id: string;
  /** Seller ID */
  sellerId: string;
  /** Item title */
  name: string;
  /** Price in JPY (for auctions, this is current/starting price) */
  price: number;
  /** Item status */
  status: string;
  /** Category ID */
  categoryId: number;
  /** Item condition ID (1-6) */
  itemConditionId: number;
  /** Shipping payer ID (1=buyer, 2=seller) */
  shippingPayerId: number;
  /** Thumbnail image URLs */
  thumbnails: string[];
  /** Creation timestamp */
  created: number;
  /** Last update timestamp */
  updated: number;
  /** Whether this is a shop item (Mercari Shops) */
  isShopItem: boolean;
  /** Auction info (only present for auction items) */
  auction?: SearchAuction;
}

/** Search result metadata */
export interface SearchMeta {
  /** Total number of matching items */
  numFound: number;
  /** Token for next page (empty if no more results) */
  nextPageToken: string;
}

/** Search response */
export interface SearchResult {
  /** List of items */
  items: SearchResultItem[];
  /** Result metadata */
  meta: SearchMeta;
}

/** Internal search request payload, mirrors the official web app */
export interface SearchRequestPayload {
  userId: string;
  config: {
    responseToggles: string[];
  };
  pageSize: number;
  pageToken: string;
  searchSessionId: string;
  source: string;
  indexRouting: string;
  thumbnailTypes: string[];
  searchCondition: {
    keyword: string;
    excludeKeyword: string;
    sort: string;
    order: string;
    status: string[];
    sizeId: number[];
    categoryId: number[];
    brandId: number[];
    sellerId: string[];
    priceMin: number;
    priceMax: number;
    itemConditionId: number[];
    shippingPayerId: number[];
    shippingFromArea: number[];
    shippingMethod: number[];
    colorId: number[];
    hasCoupon: boolean;
    attributes: unknown[];
    itemTypes: string[];
    skuIds: string[];
    shopIds: string[];
    excludeShippingMethodIds: number[];
  };
  serviceFrom: string;
  withItemBrand: boolean;
  withItemSize: boolean;
  withItemPromotions: boolean;
  withItemSizes: boolean;
  withShopname: boolean;
  useDynamicAttribute: boolean;
  withSuggestedItems: boolean;
  withOfferPricePromotion: boolean;
  withProductSuggest: boolean;
  withParentProducts: boolean;
  withProductArticles: boolean;
  withSearchConditionId: boolean;
  withAuction: boolean;
  laplaceDeviceUuid: string;
}
