import XCTest

/// One launch walks through the main screens: relaunching the app between tests can fail on CI
/// simulators ("Failed to terminate"), so the flows share a single run.
final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testOnboardingAndMainScreens() {
        let app = XCUIApplication()
        // Start from a clean state: reset the onboarding flag. Debug builds use the sample events.
        app.launchArguments += ["-hasCompletedOnboarding", "NO"]
        app.launch()

        XCTContext.runActivity(named: "Onboarding leads to News") { _ in
            let button = app.buttons["onboarding.primaryButton"]
            if button.waitForExistence(timeout: 5) {
                while button.exists {
                    button.tap()
                }
            }
            XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.buttons["event.row.quake"].waitForExistence(timeout: 10), "the confirmed sample event is listed")
        }

        XCTContext.runActivity(named: "Status filter shows only that status") { _ in
            // The first chips are on screen on every iPhone width.
            app.buttons["filter.confirmed"].tap()
            XCTAssertTrue(app.buttons["event.row.quake"].waitForExistence(timeout: 5))
            XCTAssertFalse(app.buttons["event.row.shooting"].exists)
            app.buttons["filter.all"].tap()
            XCTAssertTrue(app.buttons["event.row.shooting"].waitForExistence(timeout: 5))
        }

        XCTContext.runActivity(named: "Event detail") { _ in
            app.buttons["event.row.quake"].tap()
            XCTAssertTrue(app.navigationBars["Event"].waitForExistence(timeout: 5))
            XCTAssertTrue(app.staticTexts["Turkey earthquake: Strong quake hits Malatya province"].exists)
            app.navigationBars["Event"].buttons.firstMatch.tap()
            XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))
        }

        XCTContext.runActivity(named: "Color guide") { _ in
            app.buttons["What the colors mean"].tap()
            XCTAssertTrue(app.navigationBars["What the Colors Mean"].waitForExistence(timeout: 5))
            app.buttons["Done"].tap()
            XCTAssertTrue(app.navigationBars["News"].waitForExistence(timeout: 5))
        }

        XCTContext.runActivity(named: "Sources and Settings tabs") { _ in
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
}
