export const API_BASE = 'https://api.mercari.jp';

export const ENDPOINTS = {
  SEARCH: `${API_BASE}/v2/entities:search`,
  ITEM: `${API_BASE}/items/get`,
  PROFILE: `${API_BASE}/users/get_profile`,
  SELLER_ITEMS: `${API_BASE}/items/get_items`,
} as const;

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export const DEFAULT_HEADERS = {
  'X-Platform': 'web',
  'Content-Type': 'application/json',
};
