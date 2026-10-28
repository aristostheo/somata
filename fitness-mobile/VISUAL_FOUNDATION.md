# Somata branding — Checkpoint 3A

This is a foundation and specification checkpoint, not the Home redesign. New semantic roles are available through the existing ThemeProvider. Current screen layouts, legacy colors, saved palettes and navigation remain intact. Authentication has an exact-color compatibility adapter, so its approved Checkpoint 2B appearance does not change.

## Audit: existing sources and conflicts

Source inspection covered the theme definitions, settings/picker state, shared presentation families, color literal usage in app/components/content, Home and its account/data hook, and the five-tab layout. A color occurrence is not proof that a retained component is currently routed; commented/old examples were distinguished from active theme code.

| Source | Finding | Treatment |
| --- | --- | --- |
| `content/ThemeProvider.tsx` | Sole System/Light/Dark owner. Per-mode primary/accent colors, HSL-derived palette and legacy flat tokens. Dark surfaces such as `#08080F`, `#0F0F1A` and text `#F0F0FF` carry violet undertones. Semantic success/warning/danger/info already coexist with brand accents. | Keep `colors` and all persistence behavior unchanged; add typed `semantic` roles to this provider. No second stateful theme provider. |
| `services/theme/themeState.ts` | Ocean default, Pine and Plum presets. Plum deliberately stores purple/pink, Pine green/teal; these may be user choices. Legacy-key migration and draft Save/Cancel are implemented here. | Do not replace presets, reset saved colors or migrate storage in 3A. |
| `components/somata/theme.ts` | Most current tabs/subpages use `D/F`: green-tinted neutrals, saved accent as `teal`, hard-coded lime `#D2EF78` / `#526916`, green selection tint. `primary` still follows saved settings. | Expose `semantic` alongside D/F; leave D/F unchanged until explicit screen adoption. Names like `lime` cannot be blindly mapped to orange because their uses differ. |
| `components/designPreview/UI.tsx` | Despite the historical directory name, these components serve the current tabs. Static exported D plus dynamic D coexist. Metric teal fill `#267967`, green border, lime values and teal/lime segmented/arc progress. | Audit per use. Later migrate cards/actions/headings/metrics/progress via an explicit appearance opt-in; do not change the global default in 3A. |
| `components/homeFlows/FlowUI.tsx` | Static F derives from static D; functions use the mode-aware hook. Home-linked pages retain these helpers. | Leave compatibility exports; future work should use the mode-aware semantic roles rather than import static D/F. |
| `components/somata/TaskUI.tsx`, `components/Card.tsx` | Different card radii, button styles, field borders and disabled-opacity treatment. TaskUI uses D/F; generic Card reads provider colors. | Document consolidation; no global style replacement now. |
| `components/accountSettings/visualTokens.ts`, `Primitives.tsx`, `useProfileFlowTheme.ts` | Retained navy/violet surfaces, pink `coral` (`#F1A7B8` / `#C65D77`), gold and green preview variants. Profile-flow adapter replaces surfaces but retains other provider fields. `visualTokens` is still used by the theme picker and setup code. | Keep picker previews truthful to their saved/draft colors. Do not reinterpret every `coral` property as official Coral Red. |
| `components/somata/authPalette.ts`, `AuthControls.tsx` | Auth-only approved red/orange palette with contrast-safe inks. | Replace duplicated literals with an adapter to the central semantic builder; exact old output is regression-tested. No controls/layout/handlers changed. |
| `components/settings/ThemeChooserCard.tsx`, `ThemeModeSheet.tsx`, `ThemeToggle.tsx`, `app/(modals)/theme-editor.tsx` | Provider-backed choices; legacy sheet includes violet fallback `#7c5cff`. ThemeChooser.tsx contains commented historical pink/violet presets. | No false claim that commented code is active styling. Do not change mode selection or draft commit semantics. |
| `components/workouts/ui/*`, nutrition `uiNew/*`, profile `premium/*`, `components/ui/PremiumModalSheet.tsx`, `components/insights/InsightCard.tsx` | Retained parallel card/button/field styles; e.g. workout gradient ends in green `#16a34a`, InsightCard violet/cyan/green decorative gradients, sheet blue highlights. Some are legacy surfaces rather than current tab implementations. | Adopt only when their consuming screen is in scope; no removal or bulk replacement. |
| `PreviewThemeScope`, `components/dashboardPreview/ReferenceDashboard.tsx`, folders marked old/unused | Earlier teal/lime comparison infrastructure still exists in source. | Do not revive routes or alter fallback navigation. The preview scope's new semantic member follows its forced dark mode. |
| `assets/branding/brand-tokens.json` | Approved seven-color reference; artwork/report files are immutable. | Runtime constants match these values; original file untouched. |

### Color meaning matters

- **Decorative brand:** violet/navy hero washes, pink accents, teal/lime metric fills and progress styling, selected chip colors. Candidates for later Somata warm accents and neutral surfaces.
- **Preference:** a user-selected Plum/Pine/custom palette is persisted intent, not accidental stale branding. Preserve its storage and current rendering until the picker compatibility decision is explicitly implemented.
- **Feedback/health:** provider success green, warning amber and danger red; Advanced Metrics maps C.green/amber/red to thresholds (including its existing score gauge). Keep meanings, labels and thresholds. No health-calculation or severity changes.
- **Data:** Advanced Metrics uses C.purple for protein, C.teal for carbs, C.amber for fat, and intensity variants for meal/time charts. These names now derive partly from provider colors. They are series encodings, not automatically decorative. A later chart migration must change legend and marks together and preserve data/units.
- **Notifications:** lime unread dots and selected alert filters encode read/selected state. A future color change must retain unread count subscription, dot/weight/text cues and accessible labels. They are not health success indicators.
- **Destructive actions:** red means delete/error, not a generic brand action. Official Coral can decorate the brand without replacing `status.error` or conveying failure by itself.

## Foundation API and compatibility

```tsx
const { semantic: t } = useTheme();
// Or obtain semantic from the existing useSomataTheme() hook.
// Example for a later, explicitly migrated component:
// backgroundColor: t.surface.primary; color: t.text.primary
```

`services/theme/semanticTokens.ts` contains the pure mode-aware builder, exported type, exact brand palette, color roles and small spacing/type/radius/motion scales. No persistence, reads of user data, calculations, remote configuration or automatic migration. ThemeProvider supplies the already-resolved mode, including System. No new dependency or provider boundary.

**Transitional contract:** `semantic` describes the fixed Somata identity; `colors` continues honoring existing saved/custom palettes. Existing callers do not change merely because `semantic` is added. These are two access APIs during migration, not two owners of theme state. Do not remap all legacy fields in one operation. Authentication already used a fixed brand palette; its adapter is now sourced from this same builder with byte-equivalent color strings.

**Picker compatibility before broad adoption:** the current picker promises editable per-mode accents while the new brand roles intentionally stay fixed. 3B should be an explicit Home visual trial that does not erase custom choices; describe the limited scope in its report. Before migrating the whole app, approve how user accents affect optional visualization/personalization versus fixed primary brand controls, and update picker previews accordingly in a separate checkpoint. No new picker mode, default or storage schema is invented here.

## Semantic mapping

| Role | Dark | Light | Intended usage |
| --- | --- | --- | --- |
| `surface.canvas` | Charcoal `#0B0E12` | Bone `#F4F3EE` | Page canvas |
| `surface.primary` | Graphite `#1A1F26` | `#FFFFFF` | Main cards/inputs/navigation |
| `surface.secondary` / `inset` | `#242B34` / `#10151B` | `#E8EBED` / `#EEF0F2` | Secondary controls/recessed groups |
| `text.primary` | Bone | Charcoal | Titles, values, controls |
| `text.secondary` / `tertiary` | `#BCC3CA` / `#A7B1BA` | Slate / `#505E69` | Supporting text/metadata; no low-opacity essential labels |
| `border.subtle` | Slate | `#CDD3D8` | Decorative dividers only |
| `border.control` | `#73808B` | `#78828C` | Meaningful control boundaries |
| `action.primary` | Orange fill, Charcoal text | Same | Filled CTA; pressed Yellow with dark text |
| `action.secondary` | Secondary surface + primary text | Same semantic pairing | Ordinary actions; control border |
| `action.link`, `navigation.active`, `focus.ring` | Orange | `#B33B00` | Contrast-safe interactive ink; 2px focus ring with 2px offset |
| `navigation.inactive` | Secondary text | Secondary text | Keep text/icon semantics; not opacity-only |
| `navigation.badge` / `onBadge` | Coral / Charcoal | Same | Unread marker, with existing accessible count |
| `selection` | `#342117` + Orange ink | `#FFF0E5` + dark-orange ink | Selected chip/row plus selected state/icon |
| `disabled` | Slate + `#BCC3CA` | `#DBDFE2` + Slate | Readable disabled controls; still set disabled/accessibilityState |
| `status.success` | `#79DB9B` | `#166B3E` | Success only |
| `status.warning` | Yellow | `#7E540B` | Warning plus text/icon |
| `status.error` | `#FF967F` | `#A32F0D` | Error/destructive feedback |
| `status.info` | `#8FC5FF` | `#225B96` | Neutral informational status |
| `data.energy` / `steps` | Orange | Dark orange | Recorded amount/progress, no success inference |
| `data.protein` / `weight` | `#8FC5FF` | `#225B96` | Series ink, with visible labels |
| `data.carbohydrate` | Yellow | `#7E540B` | Series ink |
| `data.fat` | `#FF967F` | `#A32F0D` | Series ink, not a danger judgment |
| `data.track` / `missing` | Slate / tertiary text | `#CDD3D8` / tertiary text | Background track; missing requires a textual state, never a fabricated zero |

The palette's raw Orange/Coral/Yellow remain exact brand values. Darker inks are intentional accessibility derivatives, not modifications to artwork. Data colors must meet ≥3:1 against their intended chart surfaces; text/control ink pairs meet ≥4.5:1. Decorative dividers/tracks are not meaningful control boundaries and have no blanket contrast guarantee. Alpha overlays, gradients, arbitrary saved colors and adjacent series need their own verification. Labels, shapes/line styles and numeric text remain required; contrast does not certify color-blind distinguishability.

## Shared-component standardization plan

No component layout is globally rewritten in 3A. Prefer evolving the existing current-tab UI and TaskUI APIs over building another parallel component library.

| Family | Existing entry points | Later standard |
| --- | --- | --- |
| Cards/panels | designPreview Card/GlowPanel/Metric, TaskUI Panel, generic Card, account primitives | `surface.primary`, 20px card radius; 24px hero; 20px internal padding. Subtle border, minimal shadow. Distinguish neutral/emphasized roles, retire color-named tone props only when callers migrate. |
| Buttons/actions | designPreview Action/LinkRow, TaskUI Button, AuthControls, workout buttons | Primary/secondary/destructive variants; ≥48px target, wrapping labels, explicit disabled colors. Auth remains unchanged. |
| Section headings | designPreview Section, TaskUI Heading, FlowUI text | 20px/700 heading, 13px/19 caption; preserve actions and accessibility header roles. |
| Chips/selection | TaskUI Choice/ChoiceRail, Alerts filters, theme modes | Selection fill/ink/border plus selected semantics; min touch target independent of compact visual size. |
| Progress | SegmentedProgress/ArcProgress, nutrition rings/bars | Keep existing numeric input/rounding/clamping. Energy ink + track; visible numerator/denominator. Missing input has no filled segments. No status-green reward or unsupported plan-completion claim. |
| Inputs/focus | TaskUI Field, AuthControls Field, workout Field | Control border, focus ring, readable placeholders; preserve refs, keyboard, validation and submit behavior. |

Typography stays system-native: title/metric 32px, heading 20px, body 16px/24, caption 13px/19, label 14px. Numeric metrics use tabular figures at the component level. Space scale: 4/8/12/16/20/24/32; radius 14/20/24/pill. Respect dynamic type; allow wrapping/vertical expansion instead of shrinking essential values to fit. Press/transition guidance 120/180ms; reduced-motion users get immediate state changes. None of these scales globally overrides current components in 3A.

## Five-tab asset mapping

All paths below are under `assets/branding/navigation/`; images remain unchanged.

| Current label and route | Existing Ionicon | Matching supplied asset | Recommendation |
| --- | --- | --- | --- |
| Home — `(tabs)/index` | home-outline | `home.png` | Future 28px trial |
| Workouts — `(tabs)/workouts` | barbell-outline | `training.png` | Future 28px trial; keep label Workouts |
| Nutrition — `(tabs)/nutrition` | nutrition-outline | `nutrition.png` | Future 28px trial |
| Alerts — `(tabs)/notifications` | notifications-outline | **None** | Retain the bell; it is recognizable and supports the unread badge. A new matching asset needs explicit design approval, not an improvised trace. |
| Profile — `(tabs)/profile` | person-outline | `profile.png` | Future 28px trial |

Keep the complete current Ionicons set for 3B to avoid mixed stroke/raster appearance until an icon trial is approved. No changes to order, labels, destinations, unread badges, Android back handling or keyboard tab-bar behavior. `progress.png`, `recovery.png`, `community.png`, `scan.png` are assets, not authorization for extra tabs. Do not tint away approved raster gradients to create inactive variants; review selected/inactive treatment separately.

## Files and verification

Modified: `content/ThemeProvider.tsx`, `components/somata/theme.ts`, `components/somata/authPalette.ts`.

Created: `services/theme/semanticTokens.ts`, `tests/semanticTokens.test.ts`, `VISUAL_FOUNDATION.md`, `HOME_BRAND_SPEC.md`, `review/branding-3a/tokens.html`.

Commands from repository root:

```sh
pnpm --dir fitness-mobile typecheck
pnpm --dir fitness-mobile test
CI=1 EXPO_NO_DOTENV=1 pnpm --dir fitness-mobile exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-3a-export
git diff --check -- fitness-mobile
open fitness-mobile/review/branding-3a/tokens.html
```

TypeScript passed. Tests: **117 passed, 0 failed**, including 3 new foundation checks (both-mode contrast across intended surfaces/controls/series, mode/role separation, exact auth palette compatibility). Existing theme draft/commit and target/account tests remain passing. iOS and Android Expo exports both passed, with Hermes bundles and referenced assets written to `/private/tmp/somata-3a-export`. No mobile lint command is configured; no lint dependency added. No device/native rendering success is inferred from exports. Existing baseline-browser-mapping/color-output warnings were not changed.

All existing screen files, artwork, theme storage/picker implementation and debug logs are preserved. No business/FitAdapt/auth/Firestore behavior changed. No commit, push, merge or deployment. [Home specification and bounded 3B plan](HOME_BRAND_SPEC.md) await review before implementation.
