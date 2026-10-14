// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "DesignSystem",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "DesignSystem", targets: ["DesignSystem"])
    ],
    targets: [
        .target(
            name: "DesignSystem",
            swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]
        )
    ]
)
