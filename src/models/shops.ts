/** Shop information attached to a Mercari Shops product */
export interface ShopsProductShop {
  /** Shop ID */
  id: string;
  /** Shop display name */
  displayName: string;
  /** Shop thumbnail URL */
  thumbnail: string;
  /** Shop rating score */
  score: number;
  /** Number of shop reviews */
  reviewCount: number;
}

/** A Mercari Shops (ITEM_TYPE_BEYOND) product */
export interface ShopsProduct {
  /** Product ID */
  id: string;
  /** Product title */
  displayName: string;
  /** Price in JPY */
  price: number;
  /** Product tags (e.g. 'sold_out') */
  productTags: string[];
  /** Thumbnail image URL */
  thumbnail: string;
  /** Creation timestamp (Unix seconds) */
  created: number;
  /** Last update timestamp (Unix seconds) */
  updated: number;
  /** Full-size photo URLs */
  photos: string[];
  /** Product description */
  description: string;
  /** Shop the product belongs to */
  shop?: ShopsProductShop;
  /**
   * Remaining nested data in the original response schema
   * (categories, condition, shipping, variants, ...)
   */
  productDetail?: Record<string, unknown>;
}
