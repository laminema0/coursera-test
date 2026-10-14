@testable import MyApp
import Testing

struct AppConfigurationTests {
    @Test func parsesInfoDictionary() {
        let configuration = AppConfiguration(infoDictionary: [
            "APP_ENVIRONMENT": "staging",
            "API_BASE_URL": "https://api.example.com/v1",
            "USE_MOCK_DATA": "YES"
        ])
        #expect(configuration.environment == .staging)
        #expect(configuration.apiBaseURL.absoluteString == "https://api.example.com/v1")
        #expect(configuration.useMockData)
    }
}
