# Changelog

## 0.3.0 (2026-07-16)

### Added

- `getReviews(userId, options?)` — reviews written about a user, with `maxPagerId` pagination.
- `getSimilarItems(itemId, options?)` — items similar to a listing, as shown on the item page.
- `getSearchSuggestions(query)` — search bar autocomplete with category context.
- `getShopsProduct(productId)` — Mercari Shops product details (shop stats, photos, description); search results with `isShopItem: true` are Shops products and are not retrievable via `getItem`.
- `getSellerBadges(userId)` and `hasIdentityVerifiedBadge(userId)` — seller achievement badges and 本人確認 status.
- `getDesiredPriceInfo(itemId)` — aggregated 希望価格 registrations for a listing.
- `getMasterData(dataset)` — raw reference datasets (categories, brands, sizes, colors, conditions, shipping methods/payers).
- `search` options `itemTypes` (e.g. Mercari Shops only, via the new `ItemType` enum) and `sellerIds`; results now include `itemBrand` and `shopName`.
- `getSellerItems` options (`limit`, `status`, `excludeArchivedItem`); items now include `isNoPrice`, `itemBrand`, and `auctionInfo`.
- `Item.itemAttributes` — raw dynamic attributes, always requested.
- The status page health check now exercises all of the above through the library.

### Changed

- `getItem` requests auction info by default (`includeAuction: true`); pass `false` to omit it.

## 0.2.0 (2026-07-03)

### Fixed

- Auction data in search results was never parsed: the API returns camelCase keys (`bidDeadline`, `totalBid`, `highestBid`) with an ISO 8601 deadline and stringified numbers, while the mapper expected snake_case numeric fields. `auction.endTime`, `totalBids`, and `highestBid` previously always resolved to `0`.
- `getProfile` was missing the `_user_format=profile` query parameter, so `created` and `numSellItems` always resolved to `0`.
- `getSellerItems` pagination never worked: the endpoint pages via `max_pager_id` (derived from the last item's `pager_id` and `meta.has_next`), not a top-level `pager_id` token. `nextPageToken` was always empty and the `pageToken` argument was sent as an unrecognized parameter.

### Added

- `SearchAuction.initialPrice` — starting price, recently added to the search API response.
- Search request payload updated to mirror the current official web app (`source: "BaseSerp"`, `config.responseToggles`, `laplaceDeviceUuid`, `with*` flags).
- `npm run fetch-facets` script to refresh Mercari master data (category/brand/size/... IDs) into `docs/facets/`.

### Changed

- `withAuction` now defaults to `true`, so search results distinguish auction items out of the box (matching the upstream Python [mercapi](https://github.com/take-kun/mercapi)). Pass `withAuction: false` to omit auction data.

## 0.1.1

- Initial public version.
