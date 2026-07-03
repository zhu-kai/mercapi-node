# Changelog

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
