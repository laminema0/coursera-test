import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    /// Launches from a clean state and taps through onboarding. Debug builds use the sample events.
    @MainActor
    private func launchPastOnboarding() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments += ["-hasCompletedOnboarding", "NO"]
        app.launch()

        let button = app.buttons["onboarding.primaryButton"]
        if button.waitForExistence(timeout: 5) {
            while button.exists {
                button.tap()
            }
        }
        XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))
        return app
    }

    @MainActor
    func testOnboardingLeadsToNewsAndEventDetail() {
        let app = launchPastOnboarding()

        let row = app.buttons["event.row.quake"]
        XCTAssertTrue(row.waitForExistence(timeout: 10), "the confirmed sample event is listed")
        row.tap()

        XCTAssertTrue(app.navigationBars["Event"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Turkey earthquake: Strong quake hits Malatya province"].exists)
    }

    @MainActor
    func testStatusFilterShowsOnlyThatStatus() {
        let app = launchPastOnboarding()
        XCTAssertTrue(app.buttons["event.row.quake"].waitForExistence(timeout: 10))

        // The first chips are on screen on every iPhone width.
        app.buttons["filter.confirmed"].tap()
        XCTAssertTrue(app.buttons["event.row.quake"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["event.row.shooting"].exists)

        app.buttons["filter.all"].tap()
        XCTAssertTrue(app.buttons["event.row.shooting"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testColorGuideOpensFromNews() {
        let app = launchPastOnboarding()
        app.buttons["What the colors mean"].tap()
        XCTAssertTrue(app.navigationBars["What the Colors Mean"].waitForExistence(timeout: 5))
        app.buttons["Done"].tap()
        XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testSourcesAndSettingsTabs() {
        let app = launchPastOnboarding()

        app.tabBars.buttons["Sources"].tap()
        XCTAssertTrue(app.navigationBars["Sources"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.descendants(matching: .any)["source.row.bbc-world"].waitForExistence(timeout: 5))

        app.tabBars.buttons["Settings"].tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForExistence(timeout: 5))
        let alerts = app.switches["settings.alerts"]
        XCTAssertTrue(alerts.exists)
        XCTAssertEqual(alerts.value as? String, "0", "alerts stay off until the user turns them on")
    }
}
