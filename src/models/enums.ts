/** Sort field for search results */
export enum SortBy {
  /** Relevance score (default) */
  Score = 'SORT_SCORE',
  /** Listing date */
  CreatedTime = 'SORT_CREATED_TIME',
  /** Price */
  Price = 'SORT_PRICE',
  /** Number of likes/favorites */
  NumLikes = 'SORT_NUM_LIKES',
}

/** Sort direction */
export enum SortOrder {
  /** Descending (high to low, newest first) */
  Desc = 'ORDER_DESC',
  /** Ascending (low to high, oldest first) */
  Asc = 'ORDER_ASC',
}

/** Item availability status */
export enum ItemStatus {
  /** Currently available for purchase */
  OnSale = 'STATUS_ON_SALE',
  /** Already sold */
  SoldOut = 'STATUS_SOLD_OUT',
  /** Transaction in progress */
  Trading = 'STATUS_TRADING',
}

/**
 * Item condition IDs
 * 1 = Brand new, unused (新品、未使用)
 * 2 = Like new (未使用に近い)
 * 3 = No visible scratches (目立った傷や汚れなし)
 * 4 = Minor scratches (やや傷や汚れあり)
 * 5 = Visible scratches (傷や汚れあり)
 * 6 = Poor condition (全体的に状態が悪い)
 */
export enum ItemCondition {
  BrandNew = 1,
  LikeNew = 2,
  Good = 3,
  Fair = 4,
  Poor = 5,
  Bad = 6,
}

/**
 * Shipping payer IDs
 * 1 = Buyer pays (着払い)
 * 2 = Seller pays / Free shipping (送料込み)
 */
export enum ShippingPayer {
  Buyer = 1,
  Seller = 2,
}

/**
 * Color IDs
 * Reference: Mercari color filter options
 */
export enum Color {
  Black = 1,
  White = 2,
  Gray = 3,
  Brown = 4,
  Red = 5,
  Pink = 6,
  Purple = 7,
  Blue = 8,
  Beige = 9,
  Green = 10,
  Yellow = 11,
  Orange = 12,
}
