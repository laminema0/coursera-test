#!/usr/bin/env bash
# Compiles and tests all non-UI Swift code (Core package + the app's models, repositories,
# stores and view models) on Linux in Docker. Catches compile errors without a Mac.
# Usage: scripts/swift-linux-check.sh            (needs Docker)
#        SWIFT_IMAGE=swift:6.1-noble scripts/swift-linux-check.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${SWIFT_IMAGE:-swift:6.1-noble}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# Files that import SwiftUI/UIKit can't build on Linux; everything else must.
mkdir -p "$WORK/Sources/MyApp" "$WORK/Tests/MyAppTests"
grep -rL --include='*.swift' -E '^import (SwiftUI|UIKit)' "$ROOT/MyApp" | xargs -I{} cp {} "$WORK/Sources/MyApp/"
cp "$ROOT"/MyAppTests/*.swift "$WORK/Tests/MyAppTests/"
cp -R "$ROOT/Packages/Core" "$WORK/Core" && rm -rf "$WORK/Core/.build"

cat > "$WORK/Package.swift" <<'SWIFT'
// swift-tools-version:5.10
import PackageDescription
let core: [Target.Dependency] = [
    .product(name: "CoreNetworking", package: "Core"),
    .product(name: "CorePersistence", package: "Core"),
    .product(name: "CoreLogging", package: "Core"),
]
let package = Package(
    name: "AppCheck",
    platforms: [.macOS(.v14)],
    dependencies: [.package(path: "Core")],
    targets: [
        .target(name: "MyApp", dependencies: core, swiftSettings: [.enableExperimentalFeature("StrictConcurrency")]),
        .testTarget(name: "MyAppTests", dependencies: ["MyApp"] + core),
    ]
)
SWIFT

echo "== Core package"
docker run --rm -v "$ROOT/Packages/Core":/src -w /src "$IMAGE" bash -c 'swift test --scratch-path /tmp/build'
echo "== App (non-UI code): $(ls "$WORK/Sources/MyApp" | wc -l) files"
docker run --rm -v "$WORK":/src -w /src "$IMAGE" swift test
