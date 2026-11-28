import Foundation
import CoreGraphics
import ImageIO

/// Gestionnaire natif des packs offline dans l'App Group (`NSURLIsExcludedFromBackupKey = true`).
/// Lit les tuiles MNT AWS Terrarium PNG 100 % hors-ligne (monde entier) pour `AltitudeFusionEngine`,
/// applique un plafond LRU (1,5 Go) et exclut strictement le cache de la sauvegarde iCloud (Guideline 2.23).
public final class OfflinePackManager {
    public static let maxStorageBytes: Int64 = 1_500 * 1024 * 1024 // 1,5 Go
    private let rootDir: URL

    public init() {
        if let groupUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: TrackerDatabase.appGroupIdentifier) {
            rootDir = groupUrl.appendingPathComponent("offline_packs", isDirectory: true)
        } else {
            let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
            rootDir = caches.appendingPathComponent("lkdv_offline_packs", isDirectory: true)
        }
        try? FileManager.default.createDirectory(at: rootDir, withIntermediateDirectories: true)
        markExcludedFromCloudBackup(rootDir)
    }

    public func markExcludedFromCloudBackup(_ url: URL) {
        var mutableUrl = url
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? mutableUrl.setResourceValues(values)
    }

    /// Décode l'altitude (en mètres) depuis une tuile PNG AWS Terrarium mise en cache
    /// (`elevation_m = (R * 256 + G + B / 256) - 32768`), 100 % hors-ligne mondialement.
    public func queryOfflineDemElevationM(lat: Double, lng: Double, zoom: Int = 12) -> Double? {
        guard lat >= -85.0511 && lat <= 85.0511 else { return nil }
        let n = pow(2.0, Double(zoom))
        let xFloat = (lng + 180.0) / 360.0 * n
        let latRad = lat * .pi / 180.0
        let yFloat = (1.0 - log(tan(latRad) + 1.0 / cos(latRad)) / .pi) / 2.0 * n

        let tileX = Int(floor(xFloat))
        let tileY = Int(floor(yFloat))
        let pixelX = min(255, max(0, Int((xFloat - Double(tileX)) * 256.0)))
        let pixelY = min(255, max(0, Int((yFloat - Double(tileY)) * 256.0)))

        let tileUrl = rootDir
            .appendingPathComponent("terrarium/\(zoom)/\(tileX)/\(tileY).png")
        guard FileManager.default.fileExists(atPath: tileUrl.path),
              let src = CGImageSourceCreateWithURL(tileUrl as CFURL, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
            return nil
        }

        let width = cgImage.width
        let height = cgImage.height
        guard pixelX < width, pixelY < height else { return nil }

        var rgba = [UInt8](repeating: 0, count: 4)
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: &rgba,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return nil
        }
        ctx.draw(cgImage, in: CGRect(x: -pixelX, y: -(height - 1 - pixelY), width: width, height: height))

        let r = Double(rgba[0])
        let g = Double(rgba[1])
        let b = Double(rgba[2])
        let elevation = (r * 256.0 + g + b / 256.0) - 32768.0
        guard elevation > -500.0 && elevation < 9000.0 else { return nil }
        return elevation
    }

    /// Purge LRU des tuiles les plus anciennes si le quota de 1,5 Go est dépassé.
    public func enforceStorageBudget() {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(
            at: rootDir,
            includingPropertiesForKeys: [.fileSizeKey, .contentAccessDateKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return }

        var files: [(url: URL, size: Int64, accessed: Date)] = []
        var totalSize: Int64 = 0
        for case let fileUrl as URL in enumerator {
            guard let vals = try? fileUrl.resourceValues(forKeys: [.fileSizeKey, .contentAccessDateKey, .isRegularFileKey]),
                  vals.isRegularFile == true else { continue }
            let size = Int64(vals.fileSize ?? 0)
            totalSize += size
            files.append((fileUrl, size, vals.contentAccessDate ?? .distantPast))
        }
        guard totalSize > Self.maxStorageBytes else { return }
        files.sort { $0.accessed < $1.accessed }
        for file in files {
            try? fm.removeItem(at: file.url)
            totalSize -= file.size
            if totalSize <= Self.maxStorageBytes * 85 / 100 {
                break
            }
        }
    }
}
