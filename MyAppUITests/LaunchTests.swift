import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOnboardingLeadsToHome() {
        let app = XCUIApplication()
        // Start from a clean state: reset the onboarding flag.
        app.launchArguments += ["-hasCompletedOnboarding", "NO"]
        app.launch()

        let button = app.buttons["onboarding.primaryButton"]
        if button.waitForExistence(timeout: 5) {
            while button.exists {
                button.tap()
            }
        }
        XCTAssertTrue(app.navigationBars["Home"].waitForExistence(timeout: 5))
    }
}
