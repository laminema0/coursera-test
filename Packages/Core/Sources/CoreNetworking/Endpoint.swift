import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// A typed description of one API call. `Response` is the decoded body type.
public struct Endpoint<Response: Decodable>: Sendable {
    public var path: String
    public var method: HTTPMethod
    public var queryItems: [URLQueryItem]
    public var headers: [String: String]
    public var body: Data?

    public init(
        path: String,
        method: HTTPMethod = .get,
        queryItems: [URLQueryItem] = [],
        headers: [String: String] = [:],
        body: Data? = nil
    ) {
        self.path = path
        self.method = method
        self.queryItems = queryItems
        self.headers = headers
        self.body = body
    }

    /// Convenience initializer that JSON-encodes `body`.
    public init<Body: Encodable>(
        path: String,
        method: HTTPMethod,
        jsonBody: Body,
        encoder: JSONEncoder = JSONEncoder()
    ) throws {
        self.init(
            path: path,
            method: method,
            headers: ["Content-Type": "application/json"],
            body: try encoder.encode(jsonBody)
        )
    }

    public func urlRequest(baseURL: URL) throws -> URLRequest {
        let url = baseURL.appendingPathComponent(path)
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidURL
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }
        guard let finalURL = components.url else { throw APIError.invalidURL }

        var request = URLRequest(url: finalURL)
        request.httpMethod = method.rawValue
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        for (field, value) in headers {
            request.setValue(value, forHTTPHeaderField: field)
        }
        return request
    }
}

/// Use as `Response` for endpoints that return no body (e.g. 204).
public struct EmptyResponse: Decodable, Sendable, Equatable {
    public init() {}
}
