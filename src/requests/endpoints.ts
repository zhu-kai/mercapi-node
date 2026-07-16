export const API_BASE = 'https://api.mercari.jp';

export const ENDPOINTS = {
  SEARCH: `${API_BASE}/v2/entities:search`,
  ITEM: `${API_BASE}/items/get`,
  PROFILE: `${API_BASE}/users/get_profile`,
  SELLER_ITEMS: `${API_BASE}/items/get_items`,
  REVIEWS: `${API_BASE}/reviews/history`,
  SIMILAR_ITEMS: `${API_BASE}/v2/relateditems/list-similar-items`,
  SEARCH_SUGGESTIONS: `${API_BASE}/search_index/terms`,
  SHOPS_PRODUCT: `${API_BASE}/v1/marketplaces/shops/products`,
  BADGES: `${API_BASE}/services/usersocialjp/v1/stats/badges`,
  IDENTITY_VERIFIED_BADGE: `${API_BASE}/services/usersocialjp/v1/stats/has_identity_verified_badge`,
  DESIRED_PRICE_ITEMS: `${API_BASE}/v2/desiredPriceItems`,
} as const;

/** Reference (master) data endpoints exposing IDs usable in search filters */
export const MASTER_DATASETS = {
  itemCategories: `${API_BASE}/master/v2/datasets/item_categories`,
  itemCategoryGroups: `${API_BASE}/master/v2/datasets/item_category_groups`,
  itemBrands: `${API_BASE}/master/v2/datasets/item_brands`,
  shippingMethods: `${API_BASE}/master/v2/datasets/shipping_methods`,
  itemSizes: `${API_BASE}/services/master/v1/itemSizes`,
  itemColors: `${API_BASE}/services/master/v1/itemColors`,
  itemConditions: `${API_BASE}/services/master/v1/itemConditions`,
  shippingPayers: `${API_BASE}/services/master/v1/shippingPayers`,
} as const;

export type MasterDataset = keyof typeof MASTER_DATASETS;

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export const DEFAULT_HEADERS = {
  'X-Platform': 'web',
  'Content-Type': 'application/json',
};
