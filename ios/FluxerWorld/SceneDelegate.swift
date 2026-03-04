import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = ViewController()
        window.backgroundColor = UIColor(red: 0.075, green: 0.078, blue: 0.102, alpha: 1)
        self.window = window
        window.makeKeyAndVisible()

        // Handle cold-start deep link
        if let url = connectionOptions.urlContexts.first?.url {
            NotificationCenter.default.post(name: .fluxerDeepLink, object: url)
        }
    }

    // Handle deep links while app is running
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            NotificationCenter.default.post(name: .fluxerDeepLink, object: url)
        }
    }

    // Handle Universal Links (https://fluxer.world/...)
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let url = userActivity.webpageURL {
            NotificationCenter.default.post(name: .fluxerDeepLink, object: url)
        }
    }
}
