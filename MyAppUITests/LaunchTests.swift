import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOnboardingLeadsToNewsAndEventDetail() {
        let app = XCUIApplication()
        // Start from a clean state: reset the onboarding flag. Debug builds use mock events.
        app.launchArguments += ["-hasCompletedOnboarding", "NO"]
        app.launch()

        let button = app.buttons["onboarding.primaryButton"]
        if button.waitForExistence(timeout: 5) {
            while button.exists {
                button.tap()
            }
        }
        XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))

        let row = app.buttons["event.row.quake"]
        XCTAssertTrue(row.waitForExistence(timeout: 10), "the confirmed sample event is listed")
        row.tap()

        XCTAssertTrue(app.navigationBars["Event"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Turkey earthquake: Strong quake hits Malatya province"].exists)
    }
}
