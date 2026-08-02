# Family Hub Architecture

## Frontend loading order

1. `cache-v28.js` — one-time local cache migration only.
2. `series-client.js` — recurring-series request normalization, daily maintenance fallback, and completed-history visibility.
3. `app-v3.js` — core ledger state, rendering, login, event CRUD, and type filters.
4. `shell-v28.js` — top navigation, statistics, settings, import/export, theme, and type management.
5. `templates-ui.js` — personal and built-in template management.
6. `rules-manager-v282.js` — recurring rule editor under Settings.
7. `features-v28.js` — attachments, logos, and incremental list loading.
8. `stabilize-v282.js` — final date formatting and top-bar normalization.

Files are loaded explicitly from `index.html`. Do not dynamically inject scripts or add permanent polling loops.

## Backend layers

- `edge-functions/_storage.js` — Blob read/write, automatic snapshots, and default empty data.
- `edge-functions/_domain.js` — validation, normalization, query filters, and statistics.
- `edge-functions/_series-maintenance.js` — rolling two-instance recurring window and lunar-date generation.
- `edge-functions/api/**` — thin HTTP handlers. Business logic should remain in shared modules.

## Data rules

- `series` stores recurring definitions.
- `events` stores independent occurrences.
- Open-ended recurring rules use `endMode: "open"` and an empty `endDate`.
- Each active recurring rule keeps two future pending occurrences; overdue pending occurrences remain visible.
- Completed occurrences remain in data but disappear from the overview after their date passes.
- `trash` and `logs` are intentionally not persisted.

## Maintenance rules

- Use stable file names. Put deployment cache revisions in query strings only.
- Keep one implementation per feature.
- Avoid `setInterval` for DOM synchronization; use direct initialization or scoped `MutationObserver` callbacks.
- UI handlers call API endpoints; endpoint handlers delegate to shared domain modules.
- A production release should update the visible version in one coordinated change and use one cache revision across `index.html`.
