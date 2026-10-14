import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

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
            return NSLocalizedString("You appear to be offline. Check your connection and try again.", comment: "Network error shown to the user")
        case .transport(.timedOut):
            return NSLocalizedString("The request timed out. Please try again.", comment: "Network error shown to the user")
        case .httpStatus(let code, _) where code == 401:
            return NSLocalizedString("Your session has expired. Please sign in again.", comment: "Network error shown to the user")
        case .httpStatus(let code, _) where code >= 500:
            return NSLocalizedString("The server is having problems. Please try again later.", comment: "Network error shown to the user")
        default:
            return NSLocalizedString("Something went wrong. Please try again.", comment: "Network error shown to the user")
        }
    }
}
