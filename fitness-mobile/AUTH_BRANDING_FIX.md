# Branding Checkpoint 2B — authentication layout fix

## Cause and correction

The prior `Brand.tsx` wrapper set a width/aspect ratio, but its child Image only used `StyleSheet.absoluteFill`. In the installed React Native `Libraries/Image/Image.ios.js`, static sources supply intrinsic `{width, height}` before the caller's style. Absolute-fill sets position/edges; it does not override those intrinsic dimensions. The 2304×832 horizontal asset could therefore retain that size and overflow the wrapper. `resizeMode="contain"` scales within the Image's own rectangle, not its parent's rectangle. Parent overflow was visible. There was no intentional background/watermark layer.

The reusable Image now explicitly has `width: "100%"` and `height: "100%"`, in normal flow within the aspect-ratio wrapper. It no longer uses absolute positioning. This overrides intrinsic dimensions without clipping, tinting, redrawing, or changing the PNG. Fixing the shared primitive also corrects its sizing at existing brand placements; no Home/Profile screen source or layout was changed in this checkpoint.

Authentication requests a 280px-wide approved horizontal S3 logo, capped by available width: approximately 280×101.1 logical pixels at ordinary phone widths. Both approved variants are 2304×832. Their alpha≥128 artwork bounds are x109–2235, y123–708; this existing padding is retained. It does not explain the original oversizing. Only `horizontal-s3-dark.png` / `horizontal-s3-light.png` under `assets/branding/reconciled-1b/somata/` are used here.

## Authentication-only changes

- Compact logo header, followed by the unchanged welcome/description text, fields, actions and footer.
- Charcoal/Graphite dark surfaces; Bone/white light surfaces; Orange primary action and switch; Coral strip accent. Small light-mode link/focus text uses a contrast-safe darker orange (`#B33B00`). Errors use readable warm red variants.
- Enabled sign-in: `#FF6A00` fill with `#0B0E12` text, rather than an inherited pink/purple accent. Disabled controls use explicit readable colors, not whole-button opacity reduction. Pressed primary buttons use Energy Yellow with the same dark text.
- Local `AuthControls` replace only the auth screens' presentation imports. Shared TaskUI, global theme/provider and stored palette choices remain unchanged.
- Password visibility, remember-me value/storage, input props/autofill, validation, busy guards, authentication requests, social-provider availability, account creation, recovery and navigation handlers are unchanged.
- The root stack already reserves the top safe area. Auth adds no duplicate top inset; keyboard avoidance accounts for its top origin. Horizontal safe areas, scrollable content, bottom padding and interactive keyboard dismissal remain available. No fixed-height text or font-scale cap is introduced.

## Files changed in this checkpoint

Modified:

- `components/brand/Brand.tsx` — bounded Image dimensions.
- `components/somata/AuthUI.tsx` — header, spacing, colors, keyboard/safe-area handling, local provider-button styling.
- `app/(auth)/_layout.tsx` — authentication-only background.
- `app/(auth)/login.tsx`, `register.tsx`, `reset.tsx` — only change the presentation-control import from TaskUI to AuthControls.

Created:

- `components/somata/authPalette.ts` — pure local color tokens.
- `components/somata/AuthControls.tsx` — styled button, field, visibility button and toggle; no auth/business operations.
- `tests/authBranding.test.ts` — intrinsic-image sizing regression and contrast tests.
- `tools/render-auth-preview.cjs` — offline rendering of real login presentation via React Native Web; auth/provider/network boundaries are stubbed.
- `review/branding-2b/index.html` — review gallery, including enabled sign-in button specimens.
- `review/branding-2b/login-dark-390.html`, `login-light-390.html`, `login-dark-320.html`, `login-light-320.html` — full login previews at normal/narrow widths.
- `review/branding-2b/login-dark-390.png`, `login-light-390.png` — browser screenshots of the 390px previews, not native screenshots.
- `AUTH_BRANDING_FIX.md` — this report.

Pre-existing Checkpoint 2 changes and reports remain in the working tree. No additional Expo configuration, Home/Profile, tab/navigation, service, authentication business logic, Firestore, workout or nutrition changes. All 112 existing branding files and both existing web logs are byte-identical to the start-of-checkpoint snapshot. No dependency installed; no commit, push, merge or deployment.

## Validation results

From repository root:

```sh
pnpm --dir fitness-mobile typecheck
pnpm --dir fitness-mobile test
node fitness-mobile/tools/render-auth-preview.cjs
CI=1 EXPO_NO_DOTENV=1 pnpm --dir fitness-mobile exec expo export --platform all --max-workers 2 --output-dir /private/tmp/somata-branding-2b-export
git diff --check -- fitness-mobile
```

- TypeScript: passed.
- Tests: **114 passed, 0 failed**, including the two new tests. Contrast checks cover text/links/errors at ≥4.5:1 on both auth surfaces, enabled/pressed/disabled button text, and input borders at ≥3:1. The Image regression renders the actual brand component with a native-Image test double and models React Native's intrinsic-style merge; it is not a native layout engine test.
- iOS/Android Expo exports: passed; approved logo assets resolved/bundled. Existing baseline-browser-mapping/color-output warnings were not suppressed.
- Both horizontal PNGs decoded successfully; dimensions/padding verified. Browser screenshots render the exact approved artwork without overlap. Native PNG rendering remains a device check.
- Offline previews generated from actual login/AuthUI/AuthControls/Brand components at 390px and 320px. The preview renderer uses an HTML img adapter (RN Web Image otherwise awaits a client effect), a stand-in eye glyph and web switch adaptation. Provider buttons are omitted in the preview; no live authentication or network requests run. Safe-area insets are zero in previews. Empty inputs intentionally leave Sign in disabled; enabled-button specimens are in the gallery.
- Chrome GPU rendering initially stalled on the local display service; isolated software-rendering Chrome produced both PNGs. This is not iPhone/Expo Go verification.
- Scoped whitespace check passed. No global lint/configuration changes.

## Review and physical-device checks

```sh
cd /Users/aristos/Documents/fitness-app
open fitness-mobile/review/branding-2b/index.html
cd fitness-mobile
pnpm exec expo start --go --clear
```

Use the existing backend configuration; this command does not change emulator/staging/production selection. On your iPhone:

1. Verify login's S3 stays wholly within its header, with no artwork behind the fields; inspect both light/dark appearance.
2. Enter text to enable Sign in: confirm orange fill/dark label. Check empty/disabled, busy and validation/error states using your established test account setup.
3. Confirm password reveal/hide, remember-me toggle, recovery, registration, Privacy & support and return navigation remain working. Verify configured social providers on-device where available.
4. With the keyboard open, focus both fields, scroll to actions and dismiss the keyboard. Test a small screen/landscape and larger accessibility text; no clipped labels or unreachable buttons.
5. Check VoiceOver labels/focus and native switch/eye rendering. If theme is System, switch iOS light/dark appearance; otherwise choose the appropriate saved appearance through the existing settings flow.

No live sign-in, recovery email, camera/device permission or native build result is claimed. Stop here for review; no global theme or further branding rollout begins automatically.
