// swift-tools-version:5.10
import PackageDescription

let strict: [SwiftSetting] = [.enableExperimentalFeature("StrictConcurrency")]

let package = Package(
    name: "Core",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "CoreNetworking", targets: ["CoreNetworking"]),
        .library(name: "CorePersistence", targets: ["CorePersistence"]),
        .library(name: "CoreLogging", targets: ["CoreLogging"])
    ],
    targets: [
        .target(name: "CoreLogging", swiftSettings: strict),
        .target(name: "CoreNetworking", dependencies: ["CoreLogging"], swiftSettings: strict),
        .target(name: "CorePersistence", swiftSettings: strict),
        .testTarget(name: "CoreNetworkingTests", dependencies: ["CoreNetworking"]),
        .testTarget(name: "CorePersistenceTests", dependencies: ["CorePersistence"])
    ]
)
