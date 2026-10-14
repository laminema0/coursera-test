@testable import CoreNetworking
import Foundation
import Testing

private struct User: Decodable, Equatable {
    let id: Int
    let fullName: String
}

// Serialized because MockURLProtocol.handler is shared state.
@Suite(.serialized)
struct APIClientTests {
    private let baseURL = URL(string: "https://api.test.com/v1")!
    private var client: APIClient { APIClient(baseURL: baseURL, session: MockURLProtocol.session()) }

    private func respond(status: Int, json: String, check: (@Sendable (URLRequest) -> Void)? = nil) {
        MockURLProtocol.handler = { request in
            check?(request)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
            return (response, Data(json.utf8))
        }
    }

    @Test func buildsRequestWithQueryAndHeaders() throws {
        let endpoint = Endpoint<User>(
            path: "users/1",
            queryItems: [URLQueryItem(name: "expand", value: "profile")],
            headers: ["X-Test": "1"]
        )
        let request = try endpoint.urlRequest(baseURL: baseURL)
        #expect(request.url?.absoluteString == "https://api.test.com/v1/users/1?expand=profile")
        #expect(request.httpMethod == "GET")
        #expect(request.value(forHTTPHeaderField: "X-Test") == "1")
    }

    @Test func decodesSnakeCaseResponse() async throws {
        respond(status: 200, json: #"{"id": 1, "full_name": "Ada"}"#)
        let user = try await client.send(Endpoint<User>(path: "users/1"))
        #expect(user == User(id: 1, fullName: "Ada"))
    }

    @Test func mapsHTTPErrorStatus() async {
        respond(status: 404, json: "{}")
        await #expect(throws: APIError.httpStatus(code: 404, body: Data("{}".utf8))) {
            try await client.send(Endpoint<User>(path: "users/9"))
        }
    }

    @Test func mapsDecodingError() async {
        respond(status: 200, json: #"{"unexpected": true}"#)
        do {
            _ = try await client.send(Endpoint<User>(path: "users/1"))
            Issue.record("Expected decoding error")
        } catch let APIError.decoding(message) {
            #expect(!message.isEmpty)
        } catch {
            Issue.record("Unexpected error \(error)")
        }
    }

    @Test func returnsEmptyResponseWithoutDecoding() async throws {
        respond(status: 204, json: "")
        let result = try await client.send(Endpoint<EmptyResponse>(path: "logout", method: .post))
        #expect(result == EmptyResponse())
    }
}
