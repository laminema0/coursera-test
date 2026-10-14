import Foundation

/// Build-time configuration. Values come from Configs/*.xcconfig via Info.plist.
struct AppConfiguration: Sendable {
    enum Environment: String, Sendable {
        case debug, staging, release
    }

    let environment: Environment
    let apiBaseURL: URL
    let useMockData: Bool

    static let current = AppConfiguration(infoDictionary: Bundle.main.infoDictionary ?? [:])

    static let preview = AppConfiguration(
        environment: .debug,
        apiBaseURL: URL(string: "https://preview.invalid")!,
        useMockData: true
    )

    init(environment: Environment, apiBaseURL: URL, useMockData: Bool) {
        self.environment = environment
        self.apiBaseURL = apiBaseURL
        self.useMockData = useMockData
    }

    init(infoDictionary info: [String: Any]) {
        let environmentName = info["APP_ENVIRONMENT"] as? String ?? ""
        let urlString = info["API_BASE_URL"] as? String ?? ""
        let mockFlag = (info["USE_MOCK_DATA"] as? String ?? "").uppercased()

        guard let url = URL(string: urlString), url.scheme != nil else {
            preconditionFailure("API_BASE_URL is missing or invalid in Info.plist: '\(urlString)'")
        }
        self.init(
            environment: Environment(rawValue: environmentName) ?? .debug,
            apiBaseURL: url,
            useMockData: mockFlag == "YES" || mockFlag == "TRUE" || mockFlag == "1"
        )
    }
}
