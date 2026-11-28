import Foundation
import Capacitor
import CoreBluetooth

/// Pont BLE GATT background (`bluetooth-central`) avec State Restoration (Lot 04).
/// Reçoit HR (`0x180D`/`0x2A37`), Cycling Power (`0x1818`/`0x2A63`), CSC (`0x1816`/`0x2A5B`),
/// RSC (`0x1814`/`0x2A53`) et FTMS (`0x1826`) même lorsque la WKWebView est suspendue,
/// et pousse directement FC/Puissance dans `LkdvNativeTrackerEngine` (0 trou écran verrouillé).
@objc(LkdvBleBackgroundBridge)
public final class LkdvBleBackgroundBridge: CAPPlugin, CAPBridgedPlugin, CBCentralManagerDelegate, CBPeripheralDelegate {
    public let identifier = "LkdvBleBackgroundBridge"
    public let jsName = "LkdvBleBackground"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopScan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connectPeripheral", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnectAll", returnType: CAPPluginReturnPromise),
    ]

    private static let restoreIdentifier = "com.lekitduvoyageur.ble.central"
    private static let supportedServiceUUIDs: [CBUUID] = [
        CBUUID(string: "180D"), // Heart Rate
        CBUUID(string: "1814"), // Running Speed and Cadence
        CBUUID(string: "1816"), // Cycling Speed and Cadence
        CBUUID(string: "1818"), // Cycling Power
        CBUUID(string: "1826"), // Fitness Machine (FTMS)
    ]

    private var centralManager: CBCentralManager?
    private var discoveredPeripherals: [UUID: CBPeripheral] = [:]
    private var connectedPeripherals: [UUID: CBPeripheral] = [:]

    public override func load() {
        centralManager = CBCentralManager(
            delegate: self,
            queue: DispatchQueue(label: "com.lekitduvoyageur.ble.queue"),
            options: [CBCentralManagerOptionRestoreIdentifierKey: Self.restoreIdentifier]
        )
    }

    @objc func startScan(_ call: CAPPluginCall) {
        guard let central = centralManager, central.state == .poweredOn else {
            call.resolve(["scanning": false, "reason": "bluetooth_off"])
            return
        }
        central.scanForPeripherals(withServices: Self.supportedServiceUUIDs, options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false
        ])
        call.resolve(["scanning": true])
    }

    @objc func stopScan(_ call: CAPPluginCall) {
        centralManager?.stopScan()
        call.resolve(["scanning": false])
    }

    @objc func connectPeripheral(_ call: CAPPluginCall) {
        guard let idStr = call.getString("peripheralId"),
              let uuid = UUID(uuidString: idStr),
              let peripheral = discoveredPeripherals[uuid] else {
            call.reject("Périphérique introuvable")
            return
        }
        peripheral.delegate = self
        centralManager?.connect(peripheral, options: nil)
        call.resolve(["connecting": true, "peripheralId": idStr])
    }

    @objc func disconnectAll(_ call: CAPPluginCall) {
        for (_, p) in connectedPeripherals {
            centralManager?.cancelPeripheralConnection(p)
        }
        connectedPeripherals.removeAll()
        call.resolve(["disconnected": true])
    }

    // MARK: - CBCentralManagerDelegate

    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        notifyListeners("bleState", data: ["poweredOn": central.state == .poweredOn])
    }

    public func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        if let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] {
            for p in peripherals {
                p.delegate = self
                connectedPeripherals[p.identifier] = p
            }
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        discoveredPeripherals[peripheral.identifier] = peripheral
        notifyListeners("bleDeviceDiscovered", data: [
            "peripheralId": peripheral.identifier.uuidString,
            "name": peripheral.name ?? "Capteur BLE",
            "rssi": RSSI.intValue
        ])
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        connectedPeripherals[peripheral.identifier] = peripheral
        peripheral.discoverServices(Self.supportedServiceUUIDs)
        notifyListeners("bleDeviceConnected", data: ["peripheralId": peripheral.identifier.uuidString])
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for ch in chars where ch.properties.contains(.notify) {
            peripheral.setNotifyValue(true, for: ch)
        }
    }

    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value, !data.isEmpty else { return }
        let uuid = characteristic.uuid.uuidString.uppercased()
        let bytes = [UInt8](data)

        if uuid == "2A37", bytes.count >= 2 {
            // Heart Rate Measurement (0x2A37)
            let isUint16 = (bytes[0] & 0x01) != 0
            let bpm: Int = (isUint16 && bytes.count >= 3)
                ? Int(UInt16(bytes[1]) | (UInt16(bytes[2]) << 8))
                : Int(bytes[1])
            LkdvNativeTrackerEngine.shared.ingestBleMetrics(hrBpm: bpm, powerW: nil, cadenceRpm: nil)
        } else if uuid == "2A63", bytes.count >= 4 {
            // Cycling Power Measurement (0x2A63)
            let raw = Int16(bitPattern: UInt16(bytes[2]) | (UInt16(bytes[3]) << 8))
            LkdvNativeTrackerEngine.shared.ingestBleMetrics(hrBpm: nil, powerW: max(0, Int(raw)), cadenceRpm: nil)
        }

        notifyListeners("bleCharacteristicValue", data: [
            "peripheralId": peripheral.identifier.uuidString,
            "characteristicUuid": uuid,
            "base64Value": data.base64EncodedString()
        ])
    }
}
