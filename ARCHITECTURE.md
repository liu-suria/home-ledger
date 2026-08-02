# Family Hub Architecture

## Frontend loading order

1. `app-config.js` — single source for visible version, data version, cache revision and timezone.
2. `cache-bootstrap.js` — clears incompatible local ledger caches once per release revision.
3. `app.js` — authentication, ledger state, rendering, event CRUD, filters, exchange-rate display and recurring maintenance fallback.
4. `settings-ui.js` — statistics, settings, import/export, theme and type management.
5. `templates-ui.js` — built-in and personal template management.
6. `recurring-rules-ui.js` — recurring definition editor under Settings.
7. `event-assets-ui.js` — attachment and logo interactions plus incremental list loading.

`app.css` is the single application stylesheet. `index.html` contains only document structure, startup placeholders and script/style references.

All scripts are loaded explicitly by `index.html`. No script dynamically injects another script. No feature overrides `window.fetch`.

## Frontend responsibilities

- `app.js` is the only module that owns the ledger state and the main timeline render.
- Feature modules read and write through `window.FamilyHub` or explicit custom events.
- The overview always edits a single occurrence.
- Recurring definitions are edited only in `recurring-rules-ui.js`.
- Completed occurrences remain in data, but completed occurrences with a past date are hidden from the overview unless the user selects the completed filter.
- `event-assets-ui.js` reads the existing in-memory ledger. It does not request a duplicate ledger copy and does not observe the DOM.
- Attachment writes return the updated ledger to `window.FamilyHub`; successful writes do not require a page reload.
- User-supplied attachment names and icon values are escaped before rendering. Icon URLs are restricted to HTTPS and image data URLs.

## Backend layers

- `edge-functions/_storage.js` — Blob read/write, optimistic revisions, empty-data defaults and internal automatic snapshots.
- `edge-functions/_domain.js` — validation, normalization, query filters and statistics.
- `edge-functions/_series-maintenance.js` — rolling two-instance recurring window and lunar-date generation.
- `edge-functions/api/health/index.js` — authenticated data and recurring-window health inspection.
- `edge-functions/api/**` — thin HTTP handlers. Business logic belongs in shared modules.

## Data rules

- Data model version is 8.
- Every successful write increments `revision`.
- Full-ledger writes must submit the revision they originally read; stale writes return HTTP 409 instead of overwriting newer data.
- `series` stores recurring definitions.
- `events` stores independent occurrences.
- Open-ended recurring rules use `endMode: "open"` and an empty `endDate`.
- Each active recurring rule keeps two regular future pending occurrences; manually overridden future occurrences are preserved separately.
- Recurring generation walks the rule sequence from its start date and finds the nearest missing occurrence. A far-future override never becomes the generation cursor.
- Overdue pending occurrences remain visible.
- A manually edited occurrence is independent from its recurring definition.
- `trash` and `logs` are intentionally not persisted.
- Automatic snapshots are internal implementation details and have no user-facing restore API.

## Release rules

- Use stable file names. Put deployment cache revisions in query strings only.
- Keep one implementation per feature.
- Do not add permanent polling loops or DOM observers for business rendering.
- Do not use DOM correction scripts to repair core rendering.
- Do not inject component styles at runtime; keep application styles in `app.css`.
- Update `app-config.js`, `index.html` and cache query revisions together for a release.
- Run empty-database, event CRUD, revision-conflict, recurring-rule, lunar-date, import/export and Safari startup checks before promoting a release candidate.
