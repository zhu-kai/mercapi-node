/** An item similar to another listing, as shown on the item page */
export interface SimilarItem {
  /** Item ID (Mercari) or product ID (Mercari Shops) */
  id: string;
  /** Item title */
  name: string;
  /** Price in JPY */
  price: number;
  /** Item status (e.g. 'on_sale') */
  status: string;
  /** Thumbnail image URL */
  thumbnail: string;
  /** 'ITEM_TYPE_MERCARI' or 'ITEM_TYPE_BEYOND' (Mercari Shops) */
  itemType: string;
  /** Current highest bid, only present for auction items */
  auctionHighestBid?: number;
}

/** Category attached to a search suggestion */
export interface SuggestionCategory {
  /** Category ID */
  id: number;
  /** Category name */
  name: string;
}

/** Search bar autocomplete suggestion */
export interface SearchSuggestion {
  /** Suggested search keyword */
  keyword: string;
  /** Display title (usually equals keyword) */
  title: string;
  /** Display subtitle, usually a category name (may be empty) */
  subtitle: string;
  /** Categories the suggestion is scoped to */
  categories: SuggestionCategory[];
}
