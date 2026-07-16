import { AuctionInfo, ItemBrand } from './item';

/** Seller profile */
export interface Profile {
  /** User ID */
  id: string;
  /** Display name */
  name: string;
  /** Profile photo URL */
  photoUrl: string;
  /** Profile introduction text */
  introduction: string;
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
  /** Number of users following this seller */
  followerCount: number;
  /** Number of users this seller follows */
  followingCount: number;
  /** Whether this is a business/organizational account */
  isOrganizationalUser: boolean;
  /** Registration timestamp */
  created: number;
}

/** Seller items list item */
export interface SellerItem {
  /** Item ID */
  id: string;
  /** Item title */
  name: string;
  /** Price in JPY */
  price: number;
  /** Item status */
  status: string;
  /** Thumbnail URLs */
  thumbnails: string[];
  /** Creation timestamp */
  created: number;
  /** Last update timestamp */
  updated: number;
  /** True if the listing has no set price */
  isNoPrice: boolean;
  /** Brand info (only present for branded items) */
  itemBrand?: ItemBrand;
  /** Auction info (only present for auction items) */
  auctionInfo?: AuctionInfo;
}

/** Seller items response */
export interface SellerItems {
  /** List of seller's items */
  items: SellerItem[];
  /** Pagination token for next page */
  nextPageToken: string;
}
