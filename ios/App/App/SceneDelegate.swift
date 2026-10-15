import UIKit
import Capacitor
import SwiftUI

/// Exactly one CAPBridgeViewController remains mounted throughout navigation.
/// Native controls never instantiate a second WKWebView.
final class LKDVBridgeViewController: CAPBridgeViewController {
    private(set) var nativeTabBarPlugin: LKDVAccountTabBarPlugin?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        let plugin = LKDVAccountTabBarPlugin()
        bridge?.registerPluginInstance(plugin)
        nativeTabBarPlugin = plugin
        bridge?.registerPluginInstance(LKDVNativeUIPlugin())
    }
}

/// An independent UIKit tab bar keeps Next.js/Capacitor's SINGLE WebView alive.
/// UITabBarController with dummy view controllers was deliberately removed:
/// selecting a dummy controller would detach the WebView, losing its state.
final class LKDVNativeTabBarHost: UIViewController, UITabBarDelegate {
    private let web: LKDVBridgeViewController
    private let tabBar = UITabBar()
    private let tabIds = ["adventures", "community", "explorer", "messages", "me"]
    private var barHeight: NSLayoutConstraint!
    private var isNativeVisible = false
    private var keyboardShown = false
    private var lastRevision = -1
    private let selectionFeedback = UISelectionFeedbackGenerator()
    private let navigationProgress = UIProgressView(progressViewStyle: .bar)
    private var progressTask: DispatchWorkItem?
    private var activeNativeUIRoute = "/"
    private var nativeUIRevision = -1
    private var actionCompletion: ((String?) -> Void)?

    init(web: LKDVBridgeViewController) {
        self.web = web
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("Use init(web:)")
    }

    // Preserve Capacitor's existing status-bar, appearance and orientation
    // behavior even though a UIKit container now owns the UIWindow root.
    override var childForStatusBarStyle: UIViewController? { web }
    override var childForStatusBarHidden: UIViewController? { web }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        web.supportedInterfaceOrientations
    }
    override var shouldAutorotate: Bool { web.shouldAutorotate }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)

        addChild(web)
        web.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(web.view)

        tabBar.translatesAutoresizingMaskIntoConstraints = false
        tabBar.delegate = self
        tabBar.tintColor = UIColor(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0, alpha: 1.0)
        tabBar.items = [
            UITabBarItem(title: "Hub", image: UIImage(systemName: "tent"), tag: 0),
            UITabBarItem(title: "Communauté", image: UIImage(systemName: "person.2"), tag: 1),
            UITabBarItem(title: "Explorer", image: UIImage(systemName: "safari"), tag: 2),
            UITabBarItem(title: "Messages", image: UIImage(systemName: "message"), tag: 3),
            UITabBarItem(title: "Compte", image: UIImage(systemName: "person.crop.circle"), tag: 4)
        ]
        tabBar.selectedItem = tabBar.items?[4]
        tabBar.isHidden = true
        view.addSubview(tabBar)
        navigationProgress.translatesAutoresizingMaskIntoConstraints = false
        navigationProgress.isHidden = true
        navigationProgress.progressTintColor = tabBar.tintColor
        navigationProgress.trackTintColor = .clear
        navigationProgress.progress = 0.32
        view.addSubview(navigationProgress)
        NSLayoutConstraint.activate([
            navigationProgress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            navigationProgress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            navigationProgress.bottomAnchor.constraint(equalTo: tabBar.topAnchor)
        ])
        selectionFeedback.prepare()

        barHeight = tabBar.heightAnchor.constraint(equalToConstant: 49)
        NSLayoutConstraint.activate([
            web.view.topAnchor.constraint(equalTo: view.topAnchor),
            web.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            web.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            web.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            tabBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            barHeight
        ])
        web.didMove(toParent: self)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow(_:)), name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide(_:)), name: UIResponder.keyboardWillHideNotification, object: nil)
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        progressTask?.cancel()
    }

    @objc private func keyboardWillShow(_ notification: Notification) {
        keyboardShown = true
        applyBarLayout()
    }

    @objc private func keyboardWillHide(_ notification: Notification) {
        keyboardShown = false
        applyBarLayout()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // UIKit controls the actual Liquid Glass rendering on iOS 26+.
        // Height includes the home-indicator safe area and rotation.
        let fitting = tabBar.sizeThatFits(CGSize(width: view.bounds.width, height: 0)).height
        let desired = max(49 + view.safeAreaInsets.bottom, fitting)
        if abs(barHeight.constant - desired) > 0.5 {
            barHeight.constant = desired
        }
    }

    var nativeBarHeight: CGFloat { barHeight.constant }

    func setVisible(_ requested: Bool, selectedId: String?, revision: Int) -> Bool {
        // JS route changes are async: older setVisible calls must never
        // overwrite a newer page's selected tab or Compas exclusion.
        guard revision >= lastRevision else { return isNativeVisible }
        lastRevision = revision
        completeNavigation()

        guard #available(iOS 26.0, *), UIDevice.current.userInterfaceIdiom == .phone else {
            if isNativeVisible { switchVisibility(false) }
            return false
        }
        // Null means an unclassified page: the native rail is present but
        // no top-level section is incorrectly highlighted.
        if let id = selectedId, let index = tabIds.firstIndex(of: id) {
            tabBar.selectedItem = tabBar.items?[index]
        } else {
            tabBar.selectedItem = nil
        }
        let visibilityChanged = isNativeVisible != requested
        if visibilityChanged { switchVisibility(requested) }
        // Layout only on first native activation, not on every Next.js route.
        if requested && visibilityChanged { view.layoutIfNeeded() }
        return requested
    }

    private func switchVisibility(_ visible: Bool) {
        isNativeVisible = visible
        applyBarLayout()
    }

    private func applyBarLayout() {
        // A floating tab bar must never cover a web text field when the iOS
        // keyboard opens. The JS active state remains true so it won't
        // briefly render a second React bar while typing.
        let shown = isNativeVisible && !keyboardShown
        if !shown { completeNavigation() }
        // Never detach or resize the WebView; native system glass refracts
        // content beneath it. CSS reserves accessible bottom scrolling space.
        tabBar.isHidden = !shown
        view.setNeedsLayout()
    }

    private func beginNavigation() {
        progressTask?.cancel()
        navigationProgress.isHidden = true
        let task = DispatchWorkItem { [weak self] in
            guard let self = self, self.isNativeVisible, !self.keyboardShown else { return }
            self.navigationProgress.isHidden = false
            self.navigationProgress.progress = 0.32
        }
        progressTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18, execute: task)
    }

    private func completeNavigation() {
        progressTask?.cancel()
        progressTask = nil
        navigationProgress.isHidden = true
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        guard isNativeVisible, tabIds.indices.contains(item.tag) else { return }
        selectionFeedback.selectionChanged()
        selectionFeedback.prepare()
        beginNavigation()
        web.nativeTabBarPlugin?.sendTabSelection(tabIds[item.tag])
    }
}

/// The JS API is backwards-compatible with the earlier Account-only pilot.
/// setVisible now receives the authoritative active destination.
@objc(LKDVAccountTabBarPlugin)
public final class LKDVAccountTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LKDVAccountTabBarPlugin"
    public let jsName = "LKDVAccountTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise)
    ]

    @objc func setVisible(_ call: CAPPluginCall) {
        let requested = call.getBool("visible") ?? false
        let selectedId = call.getString("selectedId")
        let revision = call.getInt("revision") ?? 0
        DispatchQueue.main.async { [weak self] in
            guard let web = self?.bridge?.viewController,
                  let host = web.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false])
                return
            }
            let active = host.setVisible(requested, selectedId: selectedId, revision: revision)
            call.resolve(["active": active, "height": host.nativeBarHeight])
        }
    }

    func sendTabSelection(_ id: String) {
        notifyListeners("tabSelected", data: ["destination": id])
    }
}


    
// Central native UI contract. This host never replaces or reloads the Capacitor WebView.
extension LKDVNativeTabBarHost: UIAdaptivePresentationControllerDelegate {
    func syncNativeRoute(_ path: String, revision: Int) -> Bool {
        guard revision >= nativeUIRevision, path.hasPrefix("/") else { return false }
        nativeUIRevision = revision
        if activeNativeUIRoute != path && actionCompletion != nil {
            finishNativeAction(nil)
        }
        activeNativeUIRoute = path
        return !isNativeUIExcluded
    }

    private var isNativeUIExcluded: Bool {
        activeNativeUIRoute == "/compas" || activeNativeUIRoute.hasPrefix("/compas/")
    }

    func presentNativeActions(title: String, message: String?, actions: [LKDVNativeAction], completion: @escaping (String?) -> Void) -> Bool {
        guard #available(iOS 16.0, *), !isNativeUIExcluded,
              presentedViewController == nil, actionCompletion == nil else { return false }
        actionCompletion = completion
        let content = LKDVNativeActionsView(title: title, message: message, actions: actions,
                                            select: { [weak self] id in self?.finishNativeAction(id) },
                                            close: { [weak self] in self?.finishNativeAction(nil) })
        let controller = UIHostingController(rootView: content)
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
            sheet.preferredCornerRadius = 28
        }
        controller.presentationController?.delegate = self
        present(controller, animated: true)
        return true
    }

    func presentNativePrompt(title: String, placeholder: String, initialValue: String,
                             confirmTitle: String, completion: @escaping (String?) -> Void) -> Bool {
        guard #available(iOS 16.0, *), !isNativeUIExcluded,
              presentedViewController == nil, actionCompletion == nil else { return false }
        actionCompletion = completion
        let content = LKDVNativePromptView(title: title, placeholder: placeholder,
                                          initialValue: initialValue, confirmTitle: confirmTitle,
                                          select: { [weak self] value in self?.finishNativeAction(value) },
                                          close: { [weak self] in self?.finishNativeAction(nil) })
        let controller = UIHostingController(rootView: content)
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium()]
            sheet.prefersGrabberVisible = true
        }
        controller.presentationController?.delegate = self
        present(controller, animated: true)
        return true
    }

    func presentNativeDate(title: String, value: String, completion: @escaping (String?) -> Void) -> Bool {
        guard #available(iOS 16.0, *), !isNativeUIExcluded,
              presentedViewController == nil, actionCompletion == nil else { return false }
        actionCompletion = completion
        let content = LKDVNativeDateView(title: title, value: value,
                                         select: { [weak self] picked in self?.finishNativeAction(picked) },
                                         close: { [weak self] in self?.finishNativeAction(nil) })
        let controller = UIHostingController(rootView: content)
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        controller.presentationController?.delegate = self
        present(controller, animated: true)
        return true
    }

    func presentNativeChoices(title: String, options: [LKDVNativeChoice], selectedId: String?,
                              completion: @escaping (String?) -> Void) -> Bool {
        guard #available(iOS 16.0, *), !isNativeUIExcluded,
              presentedViewController == nil, actionCompletion == nil else { return false }
        actionCompletion = completion
        let content = LKDVNativeChoicesView(title: title, choices: options, selectedId: selectedId,
                                            choose: { [weak self] id in self?.finishNativeAction(id) },
                                            close: { [weak self] in self?.finishNativeAction(nil) })
        let controller = UIHostingController(rootView: content)
        controller.modalPresentationStyle = .pageSheet
        if let sheet = controller.sheetPresentationController {
            sheet.detents = [.medium(), .large()]
            sheet.prefersGrabberVisible = true
        }
        controller.presentationController?.delegate = self
        present(controller, animated: true)
        return true
    }

    func presentNativeShare(_ url: URL) -> Bool {
        guard !isNativeUIExcluded, presentedViewController == nil else { return false }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let popover = share.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 48, width: 1, height: 1)
        }
        present(share, animated: true)
        return true
    }

    private func finishNativeAction(_ selection: String?) {
        guard let callback = actionCompletion else { return }
        actionCompletion = nil
        callback(selection)
        presentedViewController?.dismiss(animated: true)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard let callback = actionCompletion else { return }
        actionCompletion = nil
        callback(nil)
    }
}

struct LKDVNativeAction: Identifiable {
    let id: String
    let title: String
    let destructive: Bool
}

@available(iOS 16.0, *)
private struct LKDVNativeActionsView: View {
    let title: String
    let message: String?
    let actions: [LKDVNativeAction]
    let select: (String) -> Void
    let close: () -> Void

    var body: some View {
        NavigationStack {
            List {
                if let message, !message.isEmpty {
                    Text(message).font(.subheadline).foregroundStyle(.secondary)
                }
                ForEach(actions) { action in
                    Button(role: action.destructive ? .destructive : nil) {
                        select(action.id)
                    } label: {
                        Text(action.title).frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 6)
                    }
                    .accessibilityIdentifier("native-action-\(action.id)")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if #available(iOS 26.0, *) {
                        Button("Fermer", action: close).buttonStyle(.glass)
                    } else {
                        Button("Fermer", action: close)
                    }
                }
            }
        }
        .tint(Color(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0))
    }
}

@available(iOS 16.0, *)
private struct LKDVNativePromptView: View {
    let title: String
    let placeholder: String
    let confirmTitle: String
    let select: (String) -> Void
    let close: () -> Void
    @State private var value: String

    init(title: String, placeholder: String, initialValue: String, confirmTitle: String,
         select: @escaping (String) -> Void, close: @escaping () -> Void) {
        self.title = title
        self.placeholder = placeholder
        self.confirmTitle = confirmTitle
        self.select = select
        self.close = close
        _value = State(initialValue: initialValue)
    }

    var body: some View {
        NavigationStack {
            Form {
                TextField(placeholder.isEmpty ? title : placeholder, text: $value)
                    .textInputAutocapitalization(.sentences)
                    .accessibilityIdentifier("native-prompt-value")
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler", action: close)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmTitle) { select(value) }
                }
            }
        }
    }
}

@available(iOS 16.0, *)
private struct LKDVNativeDateView: View {
    let title: String
    let select: (String) -> Void
    let close: () -> Void
    @State private var date: Date

    static func formatter() -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = .current
        f.dateFormat = "yyyy-MM-dd"
        f.isLenient = false
        return f
    }

    init(title: String, value: String, select: @escaping (String) -> Void,
         close: @escaping () -> Void) {
        self.title = title
        self.select = select
        self.close = close
        _date = State(initialValue: Self.formatter().date(from: value) ?? Date())
    }

    var body: some View {
        NavigationStack {
            VStack {
                DatePicker(title, selection: $date, displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .padding()
                    .accessibilityIdentifier("native-date-picker")
                Spacer(minLength: 0)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annuler", action: close) }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Valider") { select(Self.formatter().string(from: date)) }
                }
            }
        }
    }
}


private struct LKDVNativeChoice: Identifiable {
    let id: String
    let title: String
}

@available(iOS 16.0, *)
private struct LKDVNativeChoicesView: View {
    let title: String
    let choices: [LKDVNativeChoice]
    let selectedId: String?
    let choose: (String) -> Void
    let close: () -> Void
    @State private var search = ""

    private var filtered: [LKDVNativeChoice] {
        let needle = search.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !needle.isEmpty else { return choices }
        return choices.filter { $0.title.localizedStandardContains(needle) }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { choice in
                Button {
                    choose(choice.id)
                } label: {
                    HStack {
                        Text(choice.title)
                            .foregroundStyle(.primary)
                        Spacer()
                        if selectedId == choice.id {
                            Image(systemName: "checkmark")
                                .fontWeight(.semibold)
                                .accessibilityHidden(true)
                        }
                    }
                    .contentShape(Rectangle())
                }
                .accessibilityAddTraits(selectedId == choice.id ? [.isSelected] : [])
                .accessibilityIdentifier("native-choice-\(choice.id)")
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Rechercher")
            .overlay {
                if filtered.isEmpty {
                    Text("Aucun résultat").foregroundStyle(.secondary)
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler", action: close)
                }
            }
        }
        .tint(Color(red: 23.0 / 255.0, green: 64.0 / 255.0, blue: 44.0 / 255.0))
    }
}

/// Native SwiftUI action sheets and system share surface, reusable by any Next.js route.
/// Only the route synchronizer is authoritative; Compas is explicitly excluded.
@objc(LKDVNativeUIPlugin)
public final class LKDVNativeUIPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LKDVNativeUIPlugin"
    public let jsName = "LKDVNativeUI"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setRoute", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentActions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentPrompt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentDate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentChoices", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCapabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise)
    ]

    @objc func setRoute(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), path.hasPrefix("/"),
              path.count < 512 else { call.resolve(["active": false]); return }
        let revision = call.getInt("revision") ?? 0
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            call.resolve(["active": host.syncNativeRoute(path, revision: revision)])
        }
    }

    @objc func presentActions(_ call: CAPPluginCall) {
        guard let rawTitle = call.getString("title"),
              !rawTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              rawTitle.count <= 120,
              let raw = call.getArray("actions") as? [[String: Any]],
              (1...8).contains(raw.count) else {
            call.resolve(["active": false]); return
        }

        var actions: [LKDVNativeAction] = []
        for row in raw {
            guard let id = row["id"] as? String,
                  id.range(of: "^[A-Za-z0-9_.-]{1,64}$", options: .regularExpression) != nil,
                  let title = row["title"] as? String,
                  !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  title.count <= 100 else { call.resolve(["active": false]); return }
            actions.append(LKDVNativeAction(id: id, title: title, destructive: row["destructive"] as? Bool ?? false))
        }
        guard Set(actions.map(\.id)).count == actions.count else {
            call.resolve(["active": false]); return
        }
        let message = call.getString("message").flatMap { $0.count <= 500 ? $0 : nil }
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            if !host.presentNativeActions(title: rawTitle, message: message, actions: actions,
                                          completion: { selected in
                if let selected { call.resolve(["active": true, "actionId": selected]) }
                else { call.resolve(["active": true]) }
            }) {
                call.resolve(["active": false])
            }
        }
    }

    @objc func presentPrompt(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), !title.trimmingCharacters(in: .whitespaces).isEmpty,
              title.count <= 120 else { call.resolve(["active": false]); return }
        let placeholder = call.getString("placeholder") ?? ""
        let initial = call.getString("defaultValue") ?? ""
        let label = call.getString("confirmLabel") ?? "Valider"
        guard placeholder.count <= 200, initial.count <= 4000, (1...100).contains(label.count) else {
            call.resolve(["active": false]); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            if !host.presentNativePrompt(title: title, placeholder: placeholder, initialValue: initial,
                                         confirmTitle: label, completion: { value in
                if let value { call.resolve(["active": true, "value": value]) }
                else { call.resolve(["active": true]) }
            }) {
                call.resolve(["active": false])
            }
        }
    }

    @objc func getCapabilities(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            let exists = self?.bridge?.viewController?.parent is LKDVNativeTabBarHost
            if #available(iOS 16.0, *) {
                call.resolve(["available": exists, "actions": exists, "prompts": exists, "dates": exists, "choices": exists])
            } else {
                call.resolve(["available": exists, "actions": false, "prompts": false, "dates": false, "choices": false])
            }
        }
    }

    @objc func presentDate(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), (1...120).contains(title.count) else {
            call.resolve(["active": false]); return
        }
        let value = call.getString("value") ?? ""
        guard value.isEmpty || value.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil else {
            call.resolve(["active": false]); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            if !host.presentNativeDate(title: title, value: value, completion: { value in
                if let value { call.resolve(["active": true, "value": value]) }
                else { call.resolve(["active": true]) }
            }) { call.resolve(["active": false]) }
        }
    }

    @objc func presentChoices(_ call: CAPPluginCall) {
        guard let title = call.getString("title"), (1...120).contains(title.count),
              let rows = call.getArray("options") as? [[String: Any]],
              (1...100).contains(rows.count) else {
            call.resolve(["active": false]); return
        }
        var choices: [LKDVNativeChoice] = []
        for row in rows {
            guard let id = row["id"] as? String, id.count <= 128,
                  let label = row["title"] as? String,
                  !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  label.count <= 200 else {
                call.resolve(["active": false]); return
            }
            choices.append(LKDVNativeChoice(id: id, title: label))
        }
        guard Set(choices.map(\.id)).count == choices.count else {
            call.resolve(["active": false]); return
        }
        let selectedId = call.getString("selectedId")
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            if !host.presentNativeChoices(title: title, options: choices, selectedId: selectedId,
                                          completion: { id in
                if let id { call.resolve(["active": true, "value": id]) }
                else { call.resolve(["active": true]) }
            }) {
                call.resolve(["active": false])
            }
        }
    }

    @objc func share(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), raw.count < 2048,
              let url = URL(string: raw), url.scheme?.lowercased() == "https",
              url.host != nil else { call.resolve(["active": false]); return }
        DispatchQueue.main.async { [weak self] in
            guard let host = self?.bridge?.viewController?.parent as? LKDVNativeTabBarHost else {
                call.resolve(["active": false]); return
            }
            call.resolve(["active": host.presentNativeShare(url)])
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let stoneBg = UIColor(red: 251.0 / 255.0, green: 250.0 / 255.0, blue: 246.0 / 255.0, alpha: 1)
        let web = LKDVBridgeViewController()
        web.view.backgroundColor = stoneBg

        let window = UIWindow(windowScene: windowScene)
        window.backgroundColor = stoneBg
        window.rootViewController = LKDVNativeTabBarHost(web: web)
        window.makeKeyAndVisible()
        self.window = window

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
