import XCTest

/// Walks through the app's screens and attaches a screenshot of each to the test result.
/// Runs only when screenshots are requested (TEST_RUNNER_SCREENSHOTS=1), see .github/workflows/screenshots.yml.
final class ScreenshotTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["SCREENSHOTS"] == "1", "Screenshots not requested")
        continueAfterFailure = true
    }

    @MainActor
    func testCaptureLightScreens() {
        XCUIDevice.shared.appearance = .light
        captureAll(theme: "light", includeOnboarding: true)
    }

    @MainActor
    func testCaptureDarkScreens() {
        XCUIDevice.shared.appearance = .dark
        captureAll(theme: "dark", includeOnboarding: false)
    }

    @MainActor
    private func captureAll(theme: String, includeOnboarding: Bool) {
        app = XCUIApplication()
        app.launchArguments += ["-hasCompletedOnboarding", includeOnboarding ? "NO" : "YES"]
        app.launch()

        if includeOnboarding {
            let button = app.buttons["onboarding.primaryButton"]
            if button.waitForExistence(timeout: 10) {
                snap("01-onboarding-1", theme)
                // Tap through every page; the last tap ("Get Started") leaves onboarding.
                var page = 2
                while button.exists && page <= 8 {
                    button.tap()
                    sleep(1)
                    if button.exists {
                        snap("01-onboarding-\(page)", theme)
                    }
                    page += 1
                }
            }
        }

        XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["event.row.quake"].waitForExistence(timeout: 10))
        sleep(1)
        snap("02-news", theme)
        app.swipeUp()
        sleep(1)
        snap("03-news-scrolled", theme)
        app.swipeDown()
        app.swipeDown()

        openStory("quake")
        snap("04-detail-top", theme)
        app.swipeUp()
        sleep(1)
        snap("05-detail-numbers", theme)
        app.swipeUp()
        sleep(1)
        snap("06-detail-sources", theme)
        app.swipeUp()
        sleep(1)
        snap("07-detail-end", theme)
        app.navigationBars.buttons.element(boundBy: 0).tap()

        openStory("minister")
        snap("08-detail-disputed", theme)
        app.navigationBars.buttons.element(boundBy: 0).tap()

        let guide = app.navigationBars["News"].buttons["What the colors mean"]
        if guide.waitForExistence(timeout: 5) {
            guide.tap()
            sleep(1)
            snap("09-colors-guide", theme)
            app.buttons["Done"].tap()
        }

        app.tabBars.buttons["Sources"].tap()
        sleep(2)
        snap("10-sources", theme)

        app.tabBars.buttons["Settings"].tap()
        sleep(1)
        snap("11-settings", theme)
    }

    @MainActor
    private func openStory(_ id: String) {
        let row = app.buttons["event.row.\(id)"]
        for _ in 0..<4 where !row.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        row.tap()
        XCTAssertTrue(app.navigationBars["Event"].waitForExistence(timeout: 5))
        sleep(1)
    }

    @MainActor
    private func snap(_ name: String, _ theme: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "\(theme)-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
