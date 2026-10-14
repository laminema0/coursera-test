import Foundation

public enum APIError: Error, Equatable, Sendable {
    case invalidURL
    case invalidResponse
    case transport(URLError.Code)
    case httpStatus(code: Int, body: Data)
    case decoding(String)

    /// A short message that is safe to show to the user.
    public var userMessage: String {
        switch self {
        case .transport(.notConnectedToInternet), .transport(.networkConnectionLost):
            return String(localized: "You appear to be offline. Check your connection and try again.")
        case .transport(.timedOut):
            return String(localized: "The request timed out. Please try again.")
        case .httpStatus(let code, _) where code == 401:
            return String(localized: "Your session has expired. Please sign in again.")
        case .httpStatus(let code, _) where code >= 500:
            return String(localized: "The server is having problems. Please try again later.")
        default:
            return String(localized: "Something went wrong. Please try again.")
        }
    }
}
