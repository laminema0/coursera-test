# iOS Application — Master Plan

> **Product:** a news app that brings together news from X (Twitter) and publishers.
> How the X data is fetched is designed in **[X-INTEGRATION.md](X-INTEGRATION.md)**.

This document lists every phase of building the app, from idea to App Store and after.
Phase 3 (Foundation) is already set up in this repository. Each phase ends with a **Definition of Done (DoD)**.

---

## Phase 0 — Product Discovery
| Step | Output |
|---|---|
| Problem statement & target users (personas) | 1-page product brief |
| Competitor analysis | Feature/price comparison table |
| MVP scope: must-have vs. later features (MoSCoW) | Prioritized backlog |
| Success metrics (activation, retention D1/D7/D30, conversion) | KPI sheet |
| Monetization model (free, paid, subscription, ads) | Decision record |

**DoD:** MVP feature list is frozen and every feature has acceptance criteria.

## Phase 1 — UX / UI Design
1. Information architecture: screen map and navigation (tabs vs. stack).
2. User flows: onboarding, sign-in, core task, settings, error and empty states.
3. Low-fi wireframes, then hi-fi mockups in Figma.
4. Design system: color tokens (light/dark), typography (Dynamic Type), spacing, components.
5. Accessibility: contrast, VoiceOver labels, hit targets ≥ 44pt, Reduce Motion.
6. App icon, launch screen, App Store screenshots.

**DoD:** Clickable prototype is validated with 3–5 users, and the tokens match `Packages/DesignSystem`.

## Phase 2 — Architecture & Technical Decisions
| Area | Decision (default) |
|---|---|
| UI | SwiftUI, iOS 17+ (`@Observable`, `NavigationStack`) |
| Pattern | MVVM + Repository; views stay thin, view models are testable |
| Modularity | Local Swift packages: `Core` (Networking, Persistence, Logging), `DesignSystem`, and later one package per feature |
| Dependency Injection | `AppContainer` is built once at launch and passed down through the environment |
| Concurrency | async/await, `@MainActor` view models, strict concurrency checking |
| Networking | `URLSession` + typed `Endpoint<Response>` + `APIClient` |
| Persistence | `UserDefaults` for preferences, Keychain for secrets, SwiftData for app data (Phase 5) |
| Environments | Debug / Staging / Release via `.xcconfig` |
| Project generation | XcodeGen (`project.yml`): no `.pbxproj` merge conflicts |
| Quality | SwiftLint, Swift Testing, XCUITest, GitHub Actions CI |

**DoD:** Decisions are recorded as ADRs in `docs/adr/`.

## Phase 3 — Foundation ✅ (this repository)
- [x] Folder structure, XcodeGen project, 3 build configurations
- [x] App entry point, `AppContainer` (DI), `AppState`, `RootView`
- [x] Navigation: `MainTabView` with a typed `Router` per tab
- [x] Networking layer (`Endpoint`, `APIClient`, `APIError`) + unit tests
- [x] Persistence (`KeyValueStore`: UserDefaults, in-memory, Keychain) + unit tests
- [x] Logging (`os.Logger` categories)
- [x] Design System (tokens + `PrimaryButtonStyle`, `LoadingView`, `ErrorStateView`)
- [x] Sample features: Onboarding, Home (list → detail, loading/error states), Settings
- [x] Mock data mode, so the app runs with no backend
- [x] Assets, String Catalog, Privacy Manifest
- [x] SwiftLint config, `.gitignore`, CI workflow

## Phase 4 — Core Features (MVP)
1. **Authentication:** Sign in with Apple, email/password, token storage in Keychain, token refresh.
2. **Onboarding:** value screens, permission priming (notifications/location only when needed).
3. **Main feature(s):** replace the `Home` sample with the real domain (models → repository → view model → views).
4. **Profile & Settings:** account, preferences, logout, delete account (Apple requires this).
5. **Search / filtering**, if relevant.

Per feature: model → repository protocol + live/mock implementations → view model + tests → views → UI test.

## Phase 5 — Data & Backend Integration
- API contract (OpenAPI), auth headers, retries/backoff, pagination.
- SwiftData models, offline cache, sync strategy, migrations.
- Image loading and caching.

## Phase 6 — Platform Capabilities (as needed)
Push notifications (APNs), deep links / Universal Links, widgets (WidgetKit), App Intents / Siri,
in-app purchases (StoreKit 2), Live Activities, share extension.

## Phase 7 — Quality, Security & Performance
- Unit test coverage ≥ 70% for view models and repositories; UI tests for critical flows.
- Accessibility audit (VoiceOver, Dynamic Type XXL, contrast).
- Localization (String Catalog), RTL layout check.
- Instruments: launch time < 400 ms, no leaks, smooth scrolling.
- Security: ATS on, secrets only in Keychain, certificate pinning if required, no secrets in the repo.

## Phase 8 — Release
1. Apple Developer account, bundle ID, signing (automatic or fastlane match).
2. App Store Connect record, privacy nutrition labels, Privacy Manifest review.
3. Crash reporting + analytics (e.g. Firebase Crashlytics / TelemetryDeck), with consent if required.
4. TestFlight internal → external beta.
5. Store listing: name, subtitle, keywords, screenshots (6.9" + 13" iPad if universal), preview video.
6. Submit for review; phased release.

## Phase 9 — Post-Launch
Monitor crashes and KPIs → collect feedback → prioritize → ship every 2–4 weeks. Keep up with yearly iOS releases (WWDC, June).

---

## App Sections (screen map — starting template)
```
App
├── Onboarding (first launch only)
│   └── Welcome → (Sign in) → Permissions
└── MainTabView
    ├── Home      → Item Detail
    ├── (Feature tabs, added in Phase 4)
    └── Settings  → About / Environment info / Reset
```

## Repository Layout
```
project.yml                 XcodeGen spec (generates MyApp.xcodeproj)
Configs/                    Debug / Staging / Release .xcconfig
MyApp/
  App/                      Entry point, AppContainer (DI), AppState, RootView
  Configuration/            AppConfiguration (reads xcconfig values via Info.plist)
  Navigation/               Router, routes, MainTabView
  Features/<Name>/          Views, ViewModels, Repositories for each feature
  Resources/                Assets, String Catalog, PrivacyInfo.xcprivacy
MyAppTests/                 Unit tests (Swift Testing)
MyAppUITests/               UI tests (XCUITest)
Packages/Core/              CoreNetworking, CorePersistence, CoreLogging (+ tests)
Packages/DesignSystem/      Tokens and reusable SwiftUI components
```

## Open Questions (needed before Phase 4)
1. What is the app's core purpose and its 3–5 MVP features?
2. Is there an existing backend/API, or should we choose one (custom, Firebase, Supabase, CloudKit)?
3. Is sign-in required? Which providers?
4. iPhone only, or iPad as well? Minimum iOS version (default: 17)?
5. Monetization model?
6. Final app name and bundle identifier?
