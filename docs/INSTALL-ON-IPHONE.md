# Install the app on your own iPhone (free Apple ID)

You need a Mac with Xcode 16 or newer, a USB cable (or the same Wi-Fi network after the first install),
and an Apple ID. The paid Apple Developer Program ($99/year) is **not** needed for this.

## 1. Get the code and tools
```bash
git clone https://github.com/laminema0/coursera-test.git
cd coursera-test
brew install xcodegen swiftlint
```

## 2. Set your signing team and bundle ID
1. Open Xcode → **Settings → Accounts**, click **+**, and sign in with your Apple ID.
   Xcode creates a **Personal Team** for you.
2. Create your local settings file (it is not committed):
   ```bash
   cp Configs/Local.xcconfig.example Configs/Local.xcconfig
   ```
3. Edit `Configs/Local.xcconfig`:
   - `DEVELOPMENT_TEAM` = your Team ID. To find it: generate the project (step 3), select the **MyApp** target →
     **Signing & Capabilities** → pick your Personal Team; the ID appears in the build settings
     (`DEVELOPMENT_TEAM`). Copy it into the file so it survives `xcodegen generate`.
   - `APP_BUNDLE_ID_BASE` = something unique, e.g. `com.yourname.myapp`. Free accounts can't use `com.example…`.

## 3. Generate and open the project
```bash
xcodegen generate
open MyApp.xcodeproj
```
Run `xcodegen generate` again after pulling changes that add or remove files.

## 4. Prepare the iPhone
1. Connect the iPhone and tap **Trust This Computer** on the phone.
2. Turn on **Developer Mode**: Settings → Privacy & Security → Developer Mode → On (the phone restarts).
   The option appears after the phone has been connected to Xcode once.

## 5. Build and run
1. In Xcode's toolbar choose the **MyApp** scheme and your iPhone as the destination.
2. Press **Run** (⌘R).
3. The first time, iOS blocks the app: on the phone open Settings → General → **VPN & Device Management**,
   tap your Apple ID under "Developer App", and tap **Trust**. Then start the app again.

## 6. Every 7 days
Apps signed with a free Apple ID expire after **7 days**. The app then won't open; connect the phone and press
**Run** in Xcode again. Your saved stories and settings stay. A free account can have at most 3 such apps
installed at once.

## Which data the app shows
| Build | How to run | Data |
|---|---|---|
| Debug | MyApp scheme, Run | **Sample data** built into the app (no server needed) |
| Staging | MyApp-Staging scheme, Run | `API_BASE_URL` from `Configs/Staging.xcconfig` |
| Release | Product → Archive | `API_BASE_URL` from `Configs/Release.xcconfig` |

To use your own backend (see [DEPLOY.md](DEPLOY.md)):
1. Set `API_BASE_URL` in `Configs/Staging.xcconfig` (or in your `Configs/Local.xcconfig`, which overrides it for every build), e.g.
   `API_BASE_URL = https:/$()/news.example.org/v1` (the `/$()/` keeps `//` from starting a comment).
2. Run the **MyApp-Staging** scheme on the phone.
3. Debug can use a backend too: set `USE_MOCK_DATA = NO` in `Configs/Debug.xcconfig`. It points at
   `http://localhost:8787/v1`, which only works in the Simulator; on a phone use your Mac's address on the
   same Wi-Fi (e.g. `http:/$()/192.168.1.20:8787/v1`) or a public HTTPS server.

Settings → Server in the app shows which data source the installed build uses.

## Alerts and background refresh
Turn on **Settings → Breaking News Alerts** in the app and allow notifications. iOS decides when the app may
check for news in the background (usually a few times an hour, less in Low Power Mode or if you rarely open the
app). Background App Refresh must be on: iOS Settings → General → Background App Refresh.

## Troubleshooting
- **"Failed to register bundle identifier"**: the bundle ID is taken; change `APP_BUNDLE_ID_BASE`.
- **"No signing certificate"**: check `DEVELOPMENT_TEAM`, or pick the team in Signing & Capabilities.
- **"Could not launch… untrusted developer"**: trust the profile (step 5.3).
- **Settings lost after `xcodegen generate`**: put them in `Configs/Local.xcconfig`, not only in Xcode.
