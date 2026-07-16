/** Seller achievement badge (e.g. fast shipping, high rating) */
export interface Badge {
  /** Badge ID */
  id: number;
  /** Badge name (e.g. '高評価') */
  name: string;
  /** Badge description */
  description: string;
  /** Badge icon URL */
  iconUrl: string;
}

/** Aggregated "desired price" (希望価格) registrations for a listing */
export interface DesiredPriceInfo {
  /** Item ID */
  itemId: string;
  /** Number of users who registered a desired price */
  registeredCount: number;
  /** Highest registered desired price in JPY */
  highestDesiredPrice: number;
  /** Lowest registered desired price in JPY */
  lowestDesiredPrice: number;
  /** Number of users who registered the highest desired price */
  highestDesiredPriceCount: number;
}
