# Family Hub Architecture

## Frontend loading order

1. `app-config.js` — single source for visible version, data version, cache revision and timezone.
2. `app.js` — authentication, ledger state, rendering, event CRUD, filters, exchange-rate display and recurring maintenance fallback.
3. `settings-ui.js` — statistics, settings, import/export, theme and type management.
4. `templates-ui.js` — built-in and personal template management.
5. `recurring-rules-ui.js` — recurring definition editor under Settings.
6. `event-assets-ui.js` — attachments, logos and incremental list loading.

All scripts are loaded explicitly by `index.html`. No script dynamically injects another script. No feature overrides `window.fetch`.

## Frontend responsibilities

- `app.js` is the only module that owns the ledger state and the main timeline render.
- Feature modules read and write through `window.FamilyHub` or explicit custom events.
- The overview always edits a single occurrence.
- Recurring definitions are edited only in `recurring-rules-ui.js`.
- Completed occurrences remain in data, but completed occurrences with a past date are hidden from the overview unless the user selects the completed filter.
- `event-assets-ui.js` uses one scoped, debounced observer only to decorate newly rendered event cards; it does not change business state.

## Backend layers

- `edge-functions/_storage.js` — Blob read/write, empty-data defaults and internal automatic snapshots.
- `edge-functions/_domain.js` — validation, normalization, query filters and statistics.
- `edge-functions/_series-maintenance.js` — rolling two-instance recurring window and lunar-date generation.
- `edge-functions/api/**` — thin HTTP handlers. Business logic belongs in shared modules.

## Data rules

- Data model version is 8.
- `series` stores recurring definitions.
- `events` stores independent occurrences.
- Open-ended recurring rules use `endMode: "open"` and an empty `endDate`.
- Each active recurring rule keeps two future pending occurrences; overdue pending occurrences remain visible.
- A manually edited occurrence is independent from its recurring definition.
- `trash` and `logs` are intentionally not persisted.
- Automatic snapshots are internal implementation details and have no user-facing restore API.

## Release rules

- Use stable file names. Put deployment cache revisions in query strings only.
- Keep one implementation per feature.
- Do not add permanent polling loops.
- Do not use DOM correction scripts to repair core rendering.
- Update `app-config.js`, `index.html` and cache query revisions together for a release.
- Run empty-database, event CRUD, recurring-rule, lunar-date, import/export and Safari startup checks before promoting a release candidate.
