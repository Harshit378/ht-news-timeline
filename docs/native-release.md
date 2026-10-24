# Native release (ADR-001 Path A — Capacitor)

The iOS and Android apps wrap the static Next.js export (`apps/web/out`). This page is the checklist for a store build.

## Prerequisites

| | iOS | Android |
| :--- | :--- | :--- |
| Tooling | Xcode (full app, not just Command Line Tools: `sudo xcode-select -s /Applications/Xcode.app`) | Android SDK (`apps/web/android/local.properties` → `sdk.dir`) and **JDK 21** — Gradle 8.14 does not run on JDK 25+ (`Unsupported class file major version`). Android Studio's bundled JBR works: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` |
| Account | Apple Developer Program, signing team set in Xcode | Google Play Console, an upload keystore |

## 1. Decide once, before the first upload

- **Bundle id:** `appId` in `apps/web/capacitor.config.ts` (currently `com.htimeline.app`). It can't change after the first store upload.
- **Version:** `apps/web/package.json` → `version` is the source of truth. `nx run web:native-version` copies it into Android `versionName` / iOS `MARKETING_VERSION`, with a build number derived from it (`1.2.3` → `1002003`) unless `BUILD_NUMBER` is set. Every store upload needs a higher build number.

## 2. Release environment

The app bundle is static, so the API URL is baked in at build time. Set, for the build only:

```bash
export NEXT_PUBLIC_API_URL=https://api.your-domain.com/api
export NEXT_PUBLIC_WS_URL=wss://api.your-domain.com/ws/events
```

`nx run web:release-check` (run automatically by the release targets) blocks the build when the URL is missing, not https, not ending in `/api`, or points at localhost / a LAN address. It also warns about secret-looking `NEXT_PUBLIC_*` variables: anything with that prefix is shipped inside the app when referenced, so API keys must stay on the server.

## 3. Icons and splash screens

Sources live in `apps/web/resources/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`). After changing them:

```bash
cd apps/web && npx @capacitor/assets generate --ios --android --assetPath resources \
  --iconBackgroundColor '#0a0a0b' --iconBackgroundColorDark '#0a0a0b' \
  --splashBackgroundColor '#0a0a0b' --splashBackgroundColorDark '#0a0a0b'
```

The generator reformats `android/app/src/main/AndroidManifest.xml`; discard that change (`git checkout` it).

## 4. Android

Signing comes from the environment, never from a committed file:

```bash
export ANDROID_KEYSTORE_PATH=/secure/path/upload.jks
export ANDROID_KEYSTORE_PASSWORD=…  ANDROID_KEY_ALIAS=upload  ANDROID_KEY_PASSWORD=…
npx nx run web:android-release
```

Output: `apps/web/android/app/build/outputs/bundle/release/app-release.aab` (unsigned if the keystore variables are absent). Upload it in Play Console; enable Play App Signing on the first upload.

## 5. iOS

```bash
npx nx run web:ios-archive
```

Output: `dist/ios/App.xcarchive`. Signing uses the team and profiles configured in Xcode (`apps/web/ios/App/App.xcodeproj`). Open the archive in Xcode Organizer → Distribute App → App Store Connect. Local-network HTTP to a dev API is allowed by `NSAllowsLocalNetworking`; release builds should only talk to the https API above.

## 6. Before submitting

- [ ] Version and build number bumped (`nx run web:native-version`)
- [ ] `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` point at production; `EVENTS_ADMIN_TOKEN` set on the API
- [ ] App opens offline (cached feed, saved stories) and recovers when the network returns
- [ ] Privacy details: the app stores bookmarks under an anonymous device id (ADR-006) and sends no location (ADR-009)
- [ ] Screenshots, description and privacy policy URL in each store listing
