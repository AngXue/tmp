# Project Guidelines

## Start Here

- Read [README.md](README.md) for product scope, engineering references, and known exclusions.
- Use [src/domain/scaffold.ts](src/domain/scaffold.ts) as the source of truth for scaffold geometry and materials.
- Use [src/domain/plan.ts](src/domain/plan.ts) as the source of truth for 2D scale and measured path geometry.

## Commands

- Install: `npm install`
- Develop: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Production build: `npm run build`
- Before finishing code changes, run tests, lint, and build. For 3D changes, also inspect the WebGL canvas in a real browser at desktop and tablet/mobile sizes.

## Architecture

- `App.tsx` owns project state and computes one `ScaffoldLayout`; 2D, 3D, exports, and BOM must consume that result rather than recalculate independently.
- `ScaffoldMember` is a logical design member. `PipeSegment` is a physical fixed-stock pipe linked to a member by `memberId`. Never use one where the other is intended.
- Theoretical length comes from logical members; purchased stock and combinations come from physical pipe segments.
- Keep engineering calculations out of React components. Add or change rules in `src/domain/` and cover them with deterministic tests.

## Domain Invariants

- The 2D scale is `50 px/m`; keep `Point2D[]` and measured segment lengths synchronized through the helpers in `src/domain/plan.ts`.
- The scaffold has exactly two post rows. `deckSupportRailCount` adds longitudinal deck-support rails between them and must never add posts.
- Deduplicate shared corner posts and do not emit transverse members at internal path corners where they overlap adjacent longitudinal members.
- Physical pipes use only configured `stockLengths`. Long members require overlapping assemblies; include overlap in purchased length and create the associated inline connectors.
- Connector names are 十字扣 (`cross`), 万向扣 (`universal`), and 一字扣 (`inline`). 万向扣 remains `null`/`--` while brace rules are pending.
- Wall ties are intentionally excluded. Braces are not calculated or rendered and remain `--` in the BOM. Do not invent either rule without an explicit engineering specification.
- Preserve the local-storage key `scaffold-project`, merge stored parameters with defaults, and keep the legacy `rowCount -> deckSupportRailCount` migration.

## 3D Rules

- Render `layout.pipeSegments`, `layout.decks`, and `layout.connectors`; do not render logical members as physical pipes.
- Data edits and layer visibility changes must not remount `CameraRig` or reset the user's camera. Only explicit reset/preset actions may change its key.
- Avoid coincident geometry: keep rendered pipe segments and connector positions unique, suppress overlapping corner members, and separate steel-deck lines from transparent surfaces to prevent Z-fighting.
- Keep the DPR cap and offline rendering behavior. Do not add remote HDR, texture, or model dependencies.

## Validation

- Geometry, stock assembly, connector, or migration changes require updates to [src/domain/scaffold.test.ts](src/domain/scaffold.test.ts).
- 2D scale, snapping, or path-resize changes require updates to [src/domain/plan.test.ts](src/domain/plan.test.ts).
- For 3D changes, verify nonblank rendering, selection, independent layer visibility, camera persistence, fullscreen, and absence of overlap flicker.
- Treat all outputs as measurement and material estimates, never as structural verification or a construction plan.
