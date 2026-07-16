/** Author of a review */
export interface ReviewUser {
  /** User ID */
  id: string;
  /** Display name */
  name: string;
  /** Profile photo URL */
  photoUrl: string;
}

/** A review written about a user after a transaction */
export interface Review {
  /** Role of the reviewed user in the transaction: 'seller' or 'buyer' */
  subject: string;
  /** Rating: 'good', 'normal' or 'bad' */
  fame: string;
  /** Review text (may be empty) */
  message: string;
  /** Author of the review */
  user: ReviewUser;
  /** Creation timestamp (Unix seconds) */
  created: number;
  /** Pagination cursor; pass `pagerId - 1` as maxPagerId to fetch older reviews */
  pagerId: number;
}
