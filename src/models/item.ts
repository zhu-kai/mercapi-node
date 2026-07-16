/** Seller information (embedded in Item) */
export interface Seller {
  /** Seller ID */
  id: string;
  /** Display name */
  name: string;
  /** Profile photo URL */
  photoUrl: string;
  /** Number of items for sale */
  numSellItems: number;
  /** Seller ratings */
  ratings: {
    good: number;
    normal: number;
    bad: number;
  };
  /** Total number of ratings received */
  numRatings: number;
  /** Star rating score (1-5) */
  starRatingScore: number;
  /** Whether seller is followable */
  isFollowable: boolean;
  /** Whether user is blocked */
  isBlocked: boolean;
}

/** Item condition details */
export interface ItemConditionInfo {
  /** Condition ID (1-6) */
  id: number;
  /** Condition name in Japanese */
  name: string;
}

/** Shipping payer details */
export interface ShippingPayerInfo {
  /** Payer ID (1=buyer, 2=seller) */
  id: number;
  /** Description in Japanese */
  name: string;
  /** Code: "buyer" or "seller" */
  code: string;
}

/** Shipping method details */
export interface ShippingMethodInfo {
  /** Method ID */
  id: number;
  /** Method name in Japanese */
  name: string;
}

/** Shipping origin area */
export interface ShippingFromArea {
  /** Prefecture ID */
  id: number;
  /** Prefecture name in Japanese */
  name: string;
}

/** Shipping duration info */
export interface ShippingDuration {
  /** Duration ID */
  id: number;
  /** Duration description */
  name: string;
  /** Minimum days */
  minDays: number;
  /** Maximum days */
  maxDays: number;
}

/** Brand information */
export interface ItemBrand {
  /** Brand ID */
  id: number;
  /** Brand name */
  name: string;
  /** Brand sub-name (English) */
  subName: string;
}

/** Item category summary */
export interface ItemCategory {
  /** Category ID */
  id: number;
  /** Category name */
  name: string;
  /** Parent category ID */
  parentCategoryId: number;
  /** Parent category name */
  parentCategoryName: string;
  /** Root category ID */
  rootCategoryId: number;
  /** Root category name */
  rootCategoryName: string;
}

/** Comment on an item */
export interface Comment {
  /** Comment ID */
  id: string;
  /** Comment text */
  message: string;
  /** Commenter info */
  user: {
    id: string;
    name: string;
    photoUrl: string;
  };
  /** Creation timestamp */
  created: number;
}

/** Full auction info for item details */
export interface AuctionInfo {
  /** Auction ID */
  id: string;
  /** Auction start timestamp */
  startTime: number;
  /** Expected auction end timestamp */
  endTime: number;
  /** Total number of bids */
  totalBids: number;
  /** Initial/starting price */
  initialPrice: number;
  /** Current highest bid amount */
  highestBid: number;
  /** Auction state (e.g., "STATE_ONGOING", "STATE_NO_BID") */
  state: string;
  /** Auction type */
  auctionType: string;
}

/** Full item details */
export interface Item {
  /** Item ID (e.g., "m12345678901") */
  id: string;
  /** Item title */
  name: string;
  /** Price in JPY */
  price: number;
  /** Item description */
  description: string;
  /** Item status */
  status: string;
  /** Full-size image URLs */
  photos: string[];
  /** Thumbnail image URLs */
  thumbnails: string[];
  /** Seller information */
  seller: Seller;
  /** Item category */
  itemCategory: ItemCategory;
  /** Item condition */
  itemCondition: ItemConditionInfo;
  /** Item brand (if available) */
  itemBrand?: ItemBrand;
  /** Shipping payer */
  shippingPayer: ShippingPayerInfo;
  /** Shipping method */
  shippingMethod: ShippingMethodInfo;
  /** Shipping origin */
  shippingFromArea: ShippingFromArea;
  /** Shipping duration */
  shippingDuration?: ShippingDuration;
  /** Number of likes */
  numLikes: number;
  /** Number of comments */
  numComments: number;
  /** Item comments */
  comments: Comment[];
  /** Creation timestamp */
  created: number;
  /** Last update timestamp */
  updated: number;
  /** Whether this is a shop item (Mercari Shops) */
  isShopItem: boolean;
  /** Whether anonymous shipping is available */
  isAnonymousShipping: boolean;
  /** Whether offers are accepted */
  isOfferable: boolean;
  /** Auction info (only present for auction items) */
  auctionInfo?: AuctionInfo;
  /** Dynamic item attributes (raw; schema varies by category) */
  itemAttributes?: Record<string, unknown>[];
}
