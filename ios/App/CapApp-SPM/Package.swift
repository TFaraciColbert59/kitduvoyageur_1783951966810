// swift-tools-version: 5.9
import PackageDescription

// DO NOT MODIFY THIS FILE - managed by Capacitor CLI commands
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.0"),
        .package(name: "CapacitorApp", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/app"),
        .package(name: "CapacitorCamera", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/camera"),
        .package(name: "CapacitorGeolocation", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/geolocation"),
        .package(name: "CapacitorHaptics", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/haptics"),
        .package(name: "CapacitorKeyboard", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/keyboard"),
        .package(name: "CapacitorNetwork", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/network"),
        .package(name: "CapacitorPreferences", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/preferences"),
        .package(name: "CapacitorSplashScreen", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/splash-screen"),
        .package(name: "CapacitorStatusBar", path: "../../../../../../Documents/deepseek-harness/default-workspace/kitduvoyageur_1783951966810/node_modules/@capacitor/status-bar")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "CapacitorApp", package: "CapacitorApp"),
                .product(name: "CapacitorCamera", package: "CapacitorCamera"),
                .product(name: "CapacitorGeolocation", package: "CapacitorGeolocation"),
                .product(name: "CapacitorHaptics", package: "CapacitorHaptics"),
                .product(name: "CapacitorKeyboard", package: "CapacitorKeyboard"),
                .product(name: "CapacitorNetwork", package: "CapacitorNetwork"),
                .product(name: "CapacitorPreferences", package: "CapacitorPreferences"),
                .product(name: "CapacitorSplashScreen", package: "CapacitorSplashScreen"),
                .product(name: "CapacitorStatusBar", package: "CapacitorStatusBar")
            ]
        )
    ]
)
