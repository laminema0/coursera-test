# MyApp (iOS)

A SwiftUI starter for an iOS 17+ app: modular, testable, and configured per environment.
See **[docs/PLAN.md](docs/PLAN.md)** for every phase from idea to App Store release.

## Requirements
- macOS with Xcode 16 or newer
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) and SwiftLint: `brew install xcodegen swiftlint`

## Getting Started
```bash
xcodegen generate      # creates MyApp.xcodeproj from project.yml
open MyApp.xcodeproj   # run the "MyApp" scheme on a simulator
```
The Debug build uses **mock data**, so it runs without a backend.
To install on your own iPhone with a free Apple ID, follow **[docs/INSTALL-ON-IPHONE.md](docs/INSTALL-ON-IPHONE.md)**.

## Environments
| Configuration | Scheme | Bundle ID | Mock data |
|---|---|---|---|
| Debug | MyApp | `com.example.myapp.debug` | Yes |
| Staging | MyApp-Staging | `com.example.myapp.staging` | No |
| Release | MyApp (Archive) | `com.example.myapp` | No |

Set API URLs and names in `Configs/*.xcconfig`. Don't put secrets there.

## Architecture
- **MVVM + Repository:** Views → `@Observable` view model → repository protocol → `APIClient` / storage.
- **DI:** `AppContainer` is built at launch and injected with `.environment(...)`.
- **Navigation:** one `Router` (`NavigationPath`) per tab; destinations live in `AppRoute`.
- **Packages:** `Packages/Core` (Networking, Persistence, Logging), `Packages/DesignSystem` (tokens and components).

## Screens
- **News** (first tab): stories grouped by status (⚪ unverified, 🟡 reported, 🟢 corroborated, 🔵 confirmed, 🔴 disputed, ⚫ retracted),
  filter chips, "Breaking" marker, status trail; pull to refresh and auto refresh every minute.
- **Event detail**: status and reason, counts, numbers (most reported, range, latest official, timeline; social chatter apart in purple),
  who said what, status history, sources by origin. Articles open in Safari inside the app.
- **Offline and alerts**: the last stories are cached and shown at launch; background refresh posts local
  notifications when a story starts breaking or becomes confirmed or disputed (Settings switch).
- **Sources**: tier, owner, health and track record. Status colors live in `Packages/DesignSystem` (`TrustStatus`, `VerificationBadge`).

## Adding a Feature
1. Create `MyApp/Features/<Name>/` with model, `<Name>Repository` (protocol + live + mock), view model, and views.
2. Register the repository in `AppContainer`.
3. Add routes to `AppRoute` and `withAppRoutes()`.
4. Add view model tests in `MyAppTests/`.

## Backend (news collection)
`backend/` collects news from 58 free English sources (RSS/Atom feeds, official feeds, and wire agencies' Bluesky accounts) and serves it to the app.
The X API integration is optional (paid) and switches on only with `X_BEARER_TOKEN`.
See [docs/VERIFICATION-STRATEGY.md](docs/VERIFICATION-STRATEGY.md).
```bash
cd backend
npm install
npm test
npm run check-sources   # checks every feed from your machine
npm run analyze         # collect once and print verified events in the terminal
npm start               # API on http://localhost:8787
```
| Endpoint | What it returns |
|---|---|
| `GET /v1/events?status=&since=&limit=` | Events with status (⚪🟡🟢✅🔴⚫), reason, numbers, statements, coverage, sources |
| `GET /v1/articles?since=&limit=` | Raw collected articles with their sources |
| `GET /v1/sources` | All sources with tier, owner, and health |
| `GET /v1/feed` | X posts (only when the paid X integration is on) |

## Tests
```bash
scripts/swift-linux-check.sh   # no Mac needed: builds and tests all non-UI Swift code in Docker
swift test --package-path Packages/Core
xcodebuild test -project MyApp.xcodeproj -scheme MyApp -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Renaming the App
Replace `MyApp` in `project.yml` and in the folder names, and update `APP_BUNDLE_ID_BASE` / `APP_DISPLAY_NAME` in `Configs/Base.xcconfig`.
