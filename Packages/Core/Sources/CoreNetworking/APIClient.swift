import CoreLogging
import Foundation

public protocol APIClientProtocol: Sendable {
    func send<Response: Decodable>(_ endpoint: Endpoint<Response>) async throws -> Response
}

/// Adds headers (e.g. auth token) to every request.
public protocol RequestInterceptor: Sendable {
    func adapt(_ request: URLRequest) async throws -> URLRequest
}

public final class APIClient: APIClientProtocol, @unchecked Sendable {
    // @unchecked: all stored properties are immutable after init.
    private let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder
    private let interceptors: [RequestInterceptor]

    public init(
        baseURL: URL,
        session: URLSession = .shared,
        decoder: JSONDecoder = .api,
        interceptors: [RequestInterceptor] = []
    ) {
        self.baseURL = baseURL
        self.session = session
        self.decoder = decoder
        self.interceptors = interceptors
    }

    public func send<Response: Decodable>(_ endpoint: Endpoint<Response>) async throws -> Response {
        var request = try endpoint.urlRequest(baseURL: baseURL)
        for interceptor in interceptors {
            request = try await interceptor.adapt(request)
        }

        let method = request.httpMethod ?? ""
        let urlString = request.url?.absoluteString ?? ""
        Log.network.debug("➡️ \(method, privacy: .public) \(urlString, privacy: .public)")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            Log.network.error("Transport error: \(error.localizedDescription, privacy: .public)")
            throw APIError.transport(error.code)
        }

        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        let status = http.statusCode
        let path = request.url?.path ?? ""
        Log.network.debug("⬅️ \(status) \(path, privacy: .public)")

        guard (200..<300).contains(http.statusCode) else {
            throw APIError.httpStatus(code: http.statusCode, body: data)
        }

        if Response.self == EmptyResponse.self, let empty = EmptyResponse() as? Response {
            return empty
        }

        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            let typeName = String(describing: Response.self)
            let reason = String(describing: error)
            Log.network.error("Decoding \(typeName, privacy: .public) failed: \(reason, privacy: .public)")
            throw APIError.decoding(String(describing: error))
        }
    }
}

public extension JSONDecoder {
    /// Default decoder for the API: snake_case keys, ISO-8601 dates.
    static var api: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }
}
