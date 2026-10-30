# News Timeline — Expo app (ADR-001 Path B)

React Native + Expo (SDK 58) + Expo Router. Shares types, the API client, bookmark sync, live-event logic and
timeline grouping with the web app through [`libs/shared`](../../libs/shared/README.md) (`@ht/shared/*`).

This is a standalone npm project (its own `node_modules` and `package-lock.json`), so Expo's dependency pins
never touch the root pnpm install that the web app and API use.

```bash
cd apps/mobile && npm ci          # or: npx nx run mobile:install
npx expo start                    # then i (iOS simulator), a (Android emulator) or scan with Expo Go
npx nx run mobile:typecheck
npx nx run mobile:bundle-check    # builds the iOS + Android JS bundles with Metro, no device needed
```

API: `EXPO_PUBLIC_API_URL` (must end in `/api`, see `.env.example`). Defaults to the dev API on this machine
(`localhost:4000`, or `10.0.2.2:4000` on the Android emulator).

Add native libraries with `npx expo install <pkg>` so versions match the SDK.

## What's here (all 6 core destinations)

| Screen | |
| :--- | :--- |
| Home | Feed grouped by day on a `SectionList` (sticky day headers), pull to refresh, infinite scroll, native sponsor cards for Free readers, last feed cached for offline starts |
| Search → Story | Story timeline from first report to now, Wikipedia milestones, AI brief when ready |
| Topics | 10-category visual grid (`CORE_TOPICS`), live article counts, tap opens category story timeline |
| Saved | Snapshots in SQLite (`expo-sqlite/kv-store`), backed up per device with the shared `BookmarkSync`; flushes on network back (NetInfo) and app foreground (AppState) |
| Live | Real-time live event streaming with WebSocket, exponential backoff (5 retries), AppState-aware lifecycle, and cached offline fallback |
| Settings | Appearance (theme toggle), Region boost selector, Subscription tier upgrade actions, and API diagnostics |
| Article | Headline, excerpt, Save, "Open original" in an in-app browser |

Bundle id / package: `com.htimeline.mobile`, so it installs next to the Capacitor app (`com.htimeline.app`).

## Next steps

- NativeWind styling once a stable NativeWind release supports SDK 58 (4.2.7 supports SDK 57); today it's `StyleSheet` with the web tokens in `src/theme.ts`
- Bundle Playfair Display / IBM Plex with `expo-font`
- Store builds with EAS (`npx eas-cli@latest build`)
