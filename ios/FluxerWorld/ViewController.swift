import UIKit
import WebKit

class ViewController: UIViewController {

    private static let appURL = URL(string: "https://fluxer.world")!
    private static let allowedHosts: Set<String> = [
        "fluxer.world",
        "cdn.fluxer.world",
        "media.fluxer.world",
    ]

    private var webView: WKWebView!
    private var deepLinkObserver: NSObjectProtocol?

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.075, green: 0.078, blue: 0.102, alpha: 1)
        setupWebView()
        webView.load(URLRequest(url: Self.appURL))
        listenForDeepLinks()
    }

    deinit {
        if let observer = deepLinkObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - WebView Setup

    private func setupWebView() {
        let config = WKWebViewConfiguration()

        // Media settings
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true

        // Persistent data store
        config.websiteDataStore = .default()

        // User content controller for JS bridging
        let userContentController = WKUserContentController()
        config.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: config)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = false

        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // MARK: - Deep Link Handling

    private func listenForDeepLinks() {
        deepLinkObserver = NotificationCenter.default.addObserver(
            forName: .fluxerDeepLink,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let url = notification.object as? URL else { return }
            self?.handleDeepLink(url)
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return }

        let targetURL: URL?
        if components.scheme == "fluxerworld" {
            // fluxerworld://path/sub?q=1  →  https://fluxer.world/path/sub?q=1
            let host = components.host ?? ""
            let path = components.path
            let query = components.query.map { "?\($0)" } ?? ""
            let fragment = components.fragment.map { "#\($0)" } ?? ""
            let reconstructed = "https://fluxer.world/\((host + path).trimmingCharacters(in: CharacterSet(charactersIn: "/")))\(query)\(fragment)"
            targetURL = URL(string: reconstructed)
        } else if components.scheme == "https", let host = components.host,
                  Self.allowedHosts.contains(host) {
            targetURL = url
        } else {
            targetURL = nil
        }

        if let targetURL = targetURL {
            webView.load(URLRequest(url: targetURL))
        }
    }

    // MARK: - Back gesture

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}

// MARK: - WKNavigationDelegate

extension ViewController: WKNavigationDelegate {

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        // Allow internal navigation
        if isAllowedURL(url) || url.scheme == "blob" || url.scheme == "about" {
            decisionHandler(.allow)
            return
        }

        // Open external links in Safari
        decisionHandler(.cancel)
        UIApplication.shared.open(url, options: [:], completionHandler: nil)
    }

    private func isAllowedURL(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host else { return false }
        return Self.allowedHosts.contains(host)
    }
}

// MARK: - WKUIDelegate

extension ViewController: WKUIDelegate {

    // Handle window.open() and target=_blank
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // Load in the same WebView instead of a popup
        if let url = navigationAction.request.url {
            if isAllowedURL(url) {
                webView.load(navigationAction.request)
            } else {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        }
        return nil
    }

    // Camera / mic permission requests
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        if origin.host.hasSuffix("fluxer.world") {
            decisionHandler(.grant)
        } else {
            decisionHandler(.deny)
        }
    }
}
