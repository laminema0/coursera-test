import Foundation

/// Sample domain model. Replace with the real models of the app.
struct Item: Identifiable, Hashable, Decodable, Sendable {
    let id: String
    let title: String
    let subtitle: String
}
