import Foundation
import SQLite3

/// Base SQLite WAL native dans l'App Group (`group.com.lekitduvoyageur.app`).
/// Garantit une persistance atomique « zéro perte » indépendante de WKWebView/IndexedDB,
/// partagée avec `LkdvWidgetsExtension` (`LiveActivityIntent`) et `NativeOfflineSurvivalView`.
public final class TrackerDatabase {
    public static let appGroupIdentifier = "group.com.lekitduvoyageur.app"
    private static let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.lekitduvoyageur.tracker.sqlite", qos: .utility)
    private var writesSinceCheckpoint = 0

    public struct LocalSessionRow: Codable, Sendable {
        public let sessionId: String
        public let userId: String
        public let canonicalSlug: String
        public let specVersion: String
        public var domainState: String
        public let writerLeaseId: String
        public let startedUtcMs: Int64
        public var endedUtcMs: Int64?
        public var activeMovingMs: Int64
        public var elapsedTotalMs: Int64
        public var distanceM: Double
        public var elevGainM: Double
        public var elevLossM: Double
        public var baroAltRefM: Double?
        public var lastPointSeq: Int
        public var updatedUtcMs: Int64
    }

    public struct TrackPointRow: Codable, Sendable {
        public let sessionId: String
        public let seq: Int
        public let recordedUtcMs: Int64
        public let monotonicUptimeMs: Int64
        public let bootEpochId: Int
        public let lat: Double
        public let lng: Double
        public let altBaroM: Double?
        public let altGpsM: Double?
        public let altDemM: Double?
        public let horizAccM: Double
        public let vertAccM: Double?
        public let speedMs: Double?
        public let bearingDeg: Double?
        public let hrBpm: Int?
        public let powerW: Int?
        public let cadenceRpm: Double?
        public let isMoving: Bool
        public let isOutlier: Bool
    }

    public struct OfflineRefugeRow: Codable, Sendable {
        public let id: String
        public let name: String
        public let kind: String
        public let lat: Double
        public let lng: Double
        public let altM: Double?
        public let phone: String?
    }

    public init(customDirectory: URL? = nil) throws {
        let baseDir: URL
        if let customDirectory {
            baseDir = customDirectory
        } else if let groupUrl = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier) {
            baseDir = groupUrl.appendingPathComponent("db", isDirectory: true)
        } else {
            let docs = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            baseDir = docs.appendingPathComponent("lkdv-tracker-db", isDirectory: true)
        }
        try FileManager.default.createDirectory(at: baseDir, withIntermediateDirectories: true)
        let dbUrl = baseDir.appendingPathComponent("explorer_tracker.sqlite")
        if sqlite3_open_v2(dbUrl.path, &db, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) != SQLITE_OK {
            throw NSError(domain: "LkdvTrackerDatabase", code: 1, userInfo: [NSLocalizedDescriptionKey: "Impossible d'ouvrir SQLite WAL"])
        }
        try exec("PRAGMA journal_mode = WAL;")
        try exec("PRAGMA synchronous = NORMAL;")
        try exec("PRAGMA foreign_keys = ON;")
        try exec("PRAGMA busy_timeout = 3000;")
        try createSchema()
    }

    deinit {
        if let db {
            sqlite3_close(db)
        }
    }

    private func exec(_ sql: String) throws {
        var errMsg: UnsafeMutablePointer<CChar>?
        if sqlite3_exec(db, sql, nil, nil, &errMsg) != SQLITE_OK {
            let msg = errMsg.map { String(cString: $0) } ?? "SQLite error"
            sqlite3_free(errMsg)
            throw NSError(domain: "LkdvTrackerDatabase", code: 2, userInfo: [NSLocalizedDescriptionKey: msg])
        }
    }

    private func createSchema() throws {
        let ddl = """
        CREATE TABLE IF NOT EXISTS local_sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            canonical_slug TEXT NOT NULL,
            spec_version TEXT NOT NULL,
            domain_state TEXT NOT NULL,
            writer_lease_id TEXT NOT NULL,
            started_utc_ms INTEGER NOT NULL,
            ended_utc_ms INTEGER,
            active_moving_ms INTEGER NOT NULL DEFAULT 0,
            elapsed_total_ms INTEGER NOT NULL DEFAULT 0,
            distance_m REAL NOT NULL DEFAULT 0,
            elev_gain_m REAL NOT NULL DEFAULT 0,
            elev_loss_m REAL NOT NULL DEFAULT 0,
            baro_alt_ref_m REAL,
            last_point_seq INTEGER NOT NULL DEFAULT 0,
            live_activity_id TEXT,
            live_activity_started_utc_ms INTEGER,
            updated_utc_ms INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_track_points (
            session_id TEXT NOT NULL REFERENCES local_sessions(session_id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            recorded_utc_ms INTEGER NOT NULL,
            monotonic_uptime_ms INTEGER NOT NULL,
            boot_epoch_id INTEGER NOT NULL DEFAULT 1,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            alt_baro_m REAL,
            alt_gps_m REAL,
            alt_dem_m REAL,
            horiz_acc_m REAL NOT NULL,
            vert_acc_m REAL,
            speed_ms REAL,
            bearing_deg REAL,
            hr_bpm INTEGER,
            power_w INTEGER,
            cadence_rpm REAL,
            is_moving INTEGER NOT NULL DEFAULT 1,
            is_outlier INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (session_id, seq)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS local_laps (
            lap_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES local_sessions(session_id) ON DELETE CASCADE,
            lap_index INTEGER NOT NULL,
            lap_kind TEXT NOT NULL,
            start_seq INTEGER NOT NULL,
            end_seq INTEGER,
            started_utc_ms INTEGER NOT NULL,
            ended_utc_ms INTEGER,
            metrics_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_events (
            event_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES local_sessions(session_id) ON DELETE CASCADE,
            event_type TEXT NOT NULL,
            occurred_utc_ms INTEGER NOT NULL,
            lat REAL,
            lng REAL,
            payload_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS local_media_queue (
            media_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES local_sessions(session_id) ON DELETE CASCADE,
            local_rel_path TEXT NOT NULL,
            thumb_rel_path TEXT,
            mime_type TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            lat REAL,
            lng REAL,
            captured_utc_ms INTEGER NOT NULL,
            upload_state TEXT NOT NULL DEFAULT 'pending',
            r2_object_key TEXT
        );
        CREATE TABLE IF NOT EXISTS local_sync_outbox (
            op_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            op_type TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            next_retry_utc_ms INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
        );
        CREATE TABLE IF NOT EXISTS pending_intent_commands (
            command_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            intent_kind TEXT NOT NULL,
            payload_json TEXT NOT NULL DEFAULT '{}',
            created_utc_ms INTEGER NOT NULL,
            consumed INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS offline_refuges (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            alt_m REAL,
            phone TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_offline_refuges_bbox ON offline_refuges (lat, lng);
        """
        try exec(ddl)
    }

    public func upsertSession(_ row: LocalSessionRow) {
        queue.sync {
            let sql = """
            INSERT INTO local_sessions (
                session_id, user_id, canonical_slug, spec_version, domain_state,
                writer_lease_id, started_utc_ms, ended_utc_ms, active_moving_ms,
                elapsed_total_ms, distance_m, elev_gain_m, elev_loss_m,
                baro_alt_ref_m, last_point_seq, updated_utc_ms
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(session_id) DO UPDATE SET
                domain_state=excluded.domain_state,
                ended_utc_ms=excluded.ended_utc_ms,
                active_moving_ms=excluded.active_moving_ms,
                elapsed_total_ms=excluded.elapsed_total_ms,
                distance_m=excluded.distance_m,
                elev_gain_m=excluded.elev_gain_m,
                elev_loss_m=excluded.elev_loss_m,
                baro_alt_ref_m=excluded.baro_alt_ref_m,
                last_point_seq=excluded.last_point_seq,
                updated_utc_ms=excluded.updated_utc_ms;
            """
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, row.sessionId, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 2, row.userId, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 3, row.canonicalSlug, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 4, row.specVersion, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 5, row.domainState, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 6, row.writerLeaseId, -1, Self.sqliteTransient)
            sqlite3_bind_int64(stmt, 7, row.startedUtcMs)
            if let ended = row.endedUtcMs { sqlite3_bind_int64(stmt, 8, ended) } else { sqlite3_bind_null(stmt, 8) }
            sqlite3_bind_int64(stmt, 9, row.activeMovingMs)
            sqlite3_bind_int64(stmt, 10, row.elapsedTotalMs)
            sqlite3_bind_double(stmt, 11, row.distanceM)
            sqlite3_bind_double(stmt, 12, row.elevGainM)
            sqlite3_bind_double(stmt, 13, row.elevLossM)
            if let ref = row.baroAltRefM { sqlite3_bind_double(stmt, 14, ref) } else { sqlite3_bind_null(stmt, 14) }
            sqlite3_bind_int(stmt, 15, Int32(row.lastPointSeq))
            sqlite3_bind_int64(stmt, 16, row.updatedUtcMs)
            sqlite3_step(stmt)
        }
    }

    public func appendPoint(_ pt: TrackPointRow) {
        queue.sync {
            let sql = """
            INSERT OR REPLACE INTO local_track_points (
                session_id, seq, recorded_utc_ms, monotonic_uptime_ms, boot_epoch_id,
                lat, lng, alt_baro_m, alt_gps_m, alt_dem_m, horiz_acc_m, vert_acc_m,
                speed_ms, bearing_deg, hr_bpm, power_w, cadence_rpm, is_moving, is_outlier
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
            """
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, pt.sessionId, -1, Self.sqliteTransient)
            sqlite3_bind_int(stmt, 2, Int32(pt.seq))
            sqlite3_bind_int64(stmt, 3, pt.recordedUtcMs)
            sqlite3_bind_int64(stmt, 4, pt.monotonicUptimeMs)
            sqlite3_bind_int(stmt, 5, Int32(pt.bootEpochId))
            sqlite3_bind_double(stmt, 6, pt.lat)
            sqlite3_bind_double(stmt, 7, pt.lng)
            if let v = pt.altBaroM { sqlite3_bind_double(stmt, 8, v) } else { sqlite3_bind_null(stmt, 8) }
            if let v = pt.altGpsM { sqlite3_bind_double(stmt, 9, v) } else { sqlite3_bind_null(stmt, 9) }
            if let v = pt.altDemM { sqlite3_bind_double(stmt, 10, v) } else { sqlite3_bind_null(stmt, 10) }
            sqlite3_bind_double(stmt, 11, pt.horizAccM)
            if let v = pt.vertAccM { sqlite3_bind_double(stmt, 12, v) } else { sqlite3_bind_null(stmt, 12) }
            if let v = pt.speedMs { sqlite3_bind_double(stmt, 13, v) } else { sqlite3_bind_null(stmt, 13) }
            if let v = pt.bearingDeg { sqlite3_bind_double(stmt, 14, v) } else { sqlite3_bind_null(stmt, 14) }
            if let v = pt.hrBpm { sqlite3_bind_int(stmt, 15, Int32(v)) } else { sqlite3_bind_null(stmt, 15) }
            if let v = pt.powerW { sqlite3_bind_int(stmt, 16, Int32(v)) } else { sqlite3_bind_null(stmt, 16) }
            if let v = pt.cadenceRpm { sqlite3_bind_double(stmt, 17, v) } else { sqlite3_bind_null(stmt, 17) }
            sqlite3_bind_int(stmt, 18, pt.isMoving ? 1 : 0)
            sqlite3_bind_int(stmt, 19, pt.isOutlier ? 1 : 0)
            sqlite3_step(stmt)

            writesSinceCheckpoint += 1
            if writesSinceCheckpoint >= 15 {
                writesSinceCheckpoint = 0
                sqlite3_wal_checkpoint_v2(db, nil, SQLITE_CHECKPOINT_PASSIVE, nil, nil)
            }
        }
    }

    public func appendEvent(sessionId: String, type: String, lat: Double?, lng: Double?, payloadJson: String) {
        queue.sync {
            let sql = "INSERT INTO local_events (event_id, session_id, event_type, occurred_utc_ms, lat, lng, payload_json) VALUES (?,?,?,?,?,?,?);"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, UUID().uuidString, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 2, sessionId, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 3, type, -1, Self.sqliteTransient)
            sqlite3_bind_int64(stmt, 4, Int64(Date().timeIntervalSince1970 * 1000))
            if let lat { sqlite3_bind_double(stmt, 5, lat) } else { sqlite3_bind_null(stmt, 5) }
            if let lng { sqlite3_bind_double(stmt, 6, lng) } else { sqlite3_bind_null(stmt, 6) }
            sqlite3_bind_text(stmt, 7, payloadJson, -1, Self.sqliteTransient)
            sqlite3_step(stmt)
        }
    }

    public func readRecoverableSession() -> LocalSessionRow? {
        queue.sync {
            let sql = """
            SELECT session_id, user_id, canonical_slug, spec_version, domain_state,
                   writer_lease_id, started_utc_ms, ended_utc_ms, active_moving_ms,
                   elapsed_total_ms, distance_m, elev_gain_m, elev_loss_m,
                   baro_alt_ref_m, last_point_seq, updated_utc_ms
            FROM local_sessions
            WHERE domain_state IN ('recording','paused_manual','paused_auto','bivouac_sleep')
            ORDER BY updated_utc_ms DESC LIMIT 1;
            """
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_step(stmt) == SQLITE_ROW else { return nil }
            return LocalSessionRow(
                sessionId: String(cString: sqlite3_column_text(stmt, 0)),
                userId: String(cString: sqlite3_column_text(stmt, 1)),
                canonicalSlug: String(cString: sqlite3_column_text(stmt, 2)),
                specVersion: String(cString: sqlite3_column_text(stmt, 3)),
                domainState: String(cString: sqlite3_column_text(stmt, 4)),
                writerLeaseId: String(cString: sqlite3_column_text(stmt, 5)),
                startedUtcMs: sqlite3_column_int64(stmt, 6),
                endedUtcMs: sqlite3_column_type(stmt, 7) == SQLITE_NULL ? nil : sqlite3_column_int64(stmt, 7),
                activeMovingMs: sqlite3_column_int64(stmt, 8),
                elapsedTotalMs: sqlite3_column_int64(stmt, 9),
                distanceM: sqlite3_column_double(stmt, 10),
                elevGainM: sqlite3_column_double(stmt, 11),
                elevLossM: sqlite3_column_double(stmt, 12),
                baroAltRefM: sqlite3_column_type(stmt, 13) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 13),
                lastPointSeq: Int(sqlite3_column_int(stmt, 14)),
                updatedUtcMs: sqlite3_column_int64(stmt, 15)
            )
        }
    }

    public func readTrackPoints(sessionId: String, includeOutliers: Bool = false) -> [TrackPointRow] {
        queue.sync {
            let filter = includeOutliers ? "" : "AND is_outlier = 0"
            let sql = """
            SELECT seq, recorded_utc_ms, monotonic_uptime_ms, boot_epoch_id,
                   lat, lng, alt_baro_m, alt_gps_m, alt_dem_m, horiz_acc_m,
                   vert_acc_m, speed_ms, bearing_deg, hr_bpm, power_w, cadence_rpm,
                   is_moving, is_outlier
            FROM local_track_points
            WHERE session_id = ? \(filter)
            ORDER BY seq ASC;
            """
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, sessionId, -1, Self.sqliteTransient)
            var out: [TrackPointRow] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                out.append(TrackPointRow(
                    sessionId: sessionId,
                    seq: Int(sqlite3_column_int(stmt, 0)),
                    recordedUtcMs: sqlite3_column_int64(stmt, 1),
                    monotonicUptimeMs: sqlite3_column_int64(stmt, 2),
                    bootEpochId: Int(sqlite3_column_int(stmt, 3)),
                    lat: sqlite3_column_double(stmt, 4),
                    lng: sqlite3_column_double(stmt, 5),
                    altBaroM: sqlite3_column_type(stmt, 6) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 6),
                    altGpsM: sqlite3_column_type(stmt, 7) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 7),
                    altDemM: sqlite3_column_type(stmt, 8) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 8),
                    horizAccM: sqlite3_column_double(stmt, 9),
                    vertAccM: sqlite3_column_type(stmt, 10) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 10),
                    speedMs: sqlite3_column_type(stmt, 11) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 11),
                    bearingDeg: sqlite3_column_type(stmt, 12) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 12),
                    hrBpm: sqlite3_column_type(stmt, 13) == SQLITE_NULL ? nil : Int(sqlite3_column_int(stmt, 13)),
                    powerW: sqlite3_column_type(stmt, 14) == SQLITE_NULL ? nil : Int(sqlite3_column_int(stmt, 14)),
                    cadenceRpm: sqlite3_column_type(stmt, 15) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 15),
                    isMoving: sqlite3_column_int(stmt, 16) == 1,
                    isOutlier: sqlite3_column_int(stmt, 17) == 1
                ))
            }
            return out
        }
    }

    public func enqueueIntentCommand(sessionId: String, intentKind: String, payloadJson: String = "{}") {
        queue.sync {
            let sql = "INSERT INTO pending_intent_commands (command_id, session_id, intent_kind, payload_json, created_utc_ms, consumed) VALUES (?,?,?,?,?,0);"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, UUID().uuidString, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 2, sessionId, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 3, intentKind, -1, Self.sqliteTransient)
            sqlite3_bind_text(stmt, 4, payloadJson, -1, Self.sqliteTransient)
            sqlite3_bind_int64(stmt, 5, Int64(Date().timeIntervalSince1970 * 1000))
            sqlite3_step(stmt)
        }
    }

    public func consumePendingIntentCommands() -> [(id: String, sessionId: String, intentKind: String, payloadJson: String)] {
        queue.sync {
            let sql = "SELECT command_id, session_id, intent_kind, payload_json FROM pending_intent_commands WHERE consumed = 0 ORDER BY created_utc_ms ASC;"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return [] }
            defer { sqlite3_finalize(stmt) }
            var results: [(String, String, String, String)] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                results.append((
                    String(cString: sqlite3_column_text(stmt, 0)),
                    String(cString: sqlite3_column_text(stmt, 1)),
                    String(cString: sqlite3_column_text(stmt, 2)),
                    String(cString: sqlite3_column_text(stmt, 3))
                ))
            }
            if !results.isEmpty {
                try? exec("UPDATE pending_intent_commands SET consumed = 1 WHERE consumed = 0;")
            }
            return results
        }
    }

    public func nearestRefuge(lat: Double, lng: Double, radiusDeg: Double = 0.25) -> OfflineRefugeRow? {
        queue.sync {
            let sql = """
            SELECT id, name, kind, lat, lng, alt_m, phone
            FROM offline_refuges
            WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?;
            """
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return nil }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_double(stmt, 1, lat - radiusDeg)
            sqlite3_bind_double(stmt, 2, lat + radiusDeg)
            sqlite3_bind_double(stmt, 3, lng - radiusDeg)
            sqlite3_bind_double(stmt, 4, lng + radiusDeg)

            var best: OfflineRefugeRow?
            var bestDistSq = Double.infinity
            while sqlite3_step(stmt) == SQLITE_ROW {
                let rLat = sqlite3_column_double(stmt, 3)
                let rLng = sqlite3_column_double(stmt, 4)
                let dLat = rLat - lat
                let dLng = (rLng - lng) * cos(lat * .pi / 180.0)
                let distSq = dLat * dLat + dLng * dLng
                if distSq < bestDistSq {
                    bestDistSq = distSq
                    best = OfflineRefugeRow(
                        id: String(cString: sqlite3_column_text(stmt, 0)),
                        name: String(cString: sqlite3_column_text(stmt, 1)),
                        kind: String(cString: sqlite3_column_text(stmt, 2)),
                        lat: rLat,
                        lng: rLng,
                        altM: sqlite3_column_type(stmt, 5) == SQLITE_NULL ? nil : sqlite3_column_double(stmt, 5),
                        phone: sqlite3_column_type(stmt, 6) == SQLITE_NULL ? nil : String(cString: sqlite3_column_text(stmt, 6))
                    )
                }
            }
            return best
        }
    }

    public func deleteSession(sessionId: String) {
        queue.sync {
            let sql = "DELETE FROM local_sessions WHERE session_id = ?;"
            var stmt: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
            defer { sqlite3_finalize(stmt) }
            sqlite3_bind_text(stmt, 1, sessionId, -1, Self.sqliteTransient)
            sqlite3_step(stmt)
            sqlite3_wal_checkpoint_v2(db, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil)
        }
    }

    public func checkpointTruncate() {
        queue.sync {
            sqlite3_wal_checkpoint_v2(db, nil, SQLITE_CHECKPOINT_TRUNCATE, nil, nil)
        }
    }
}
