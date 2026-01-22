import AppKit
import Foundation

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSAppleEventManager.shared().setEventHandler(
            self,
            andSelector: #selector(handleURLEvent(_:withReplyEvent:)),
            forEventClass: AEEventClass(kInternetEventClass),
            andEventID: AEEventID(kAEGetURL)
        )
    }

    @objc func handleURLEvent(_ event: NSAppleEventDescriptor, withReplyEvent replyEvent: NSAppleEventDescriptor) {
        guard let urlString = event.paramDescriptor(forKeyword: AEKeyword(keyDirectObject))?.stringValue,
              let url = URL(string: urlString) else {
            showError("Invalid URL received")
            return
        }

        handleVibelinkURL(url)
    }

    func handleVibelinkURL(_ url: URL) {
        // Parse: vibelink://open/abc123 or vibelink://abc123
        let projectId = url.host ?? url.pathComponents.dropFirst().first ?? ""

        guard !projectId.isEmpty else {
            showError("No project ID found in URL: \(url)")
            return
        }

        print("Opening vibelink project: \(projectId)")

        Task {
            await downloadAndOpen(projectId: projectId)
        }
    }

    func downloadAndOpen(projectId: String) async {
        let vibelinksDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("vibelinks")
        let projectDir = vibelinksDir.appendingPathComponent(projectId)
        let zipPath = vibelinksDir.appendingPathComponent("\(projectId).zip")

        // Create vibelinks directory if needed
        try? FileManager.default.createDirectory(at: vibelinksDir, withIntermediateDirectories: true)

        // Download the zip
        let downloadURL = URL(string: "https://vibelink.app/\(projectId)/download")!

        showNotification(title: "Vibelink", message: "Downloading \(projectId)...")

        do {
            let (tempURL, response) = try await URLSession.shared.download(from: downloadURL)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                showError("Failed to download project: HTTP \((response as? HTTPURLResponse)?.statusCode ?? 0)")
                return
            }

            // Move to final location
            try? FileManager.default.removeItem(at: zipPath)
            try FileManager.default.moveItem(at: tempURL, to: zipPath)

            // Unzip
            try? FileManager.default.removeItem(at: projectDir)
            let unzipProcess = Process()
            unzipProcess.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
            unzipProcess.arguments = ["-o", zipPath.path, "-d", projectDir.path]
            unzipProcess.standardOutput = FileHandle.nullDevice
            unzipProcess.standardError = FileHandle.nullDevice
            try unzipProcess.run()
            unzipProcess.waitUntilExit()

            guard unzipProcess.terminationStatus == 0 else {
                showError("Failed to unzip project")
                return
            }

            // Clean up zip
            try? FileManager.default.removeItem(at: zipPath)

            // Find the actual project directory (might be nested)
            let actualProjectDir = findProjectRoot(in: projectDir)

            // Open Claude Code in the project directory
            openClaudeCode(at: actualProjectDir)

            showNotification(title: "Vibelink", message: "Opened \(projectId) in Claude Code!")

            // Quit after a delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                NSApp.terminate(nil)
            }

        } catch {
            showError("Download failed: \(error.localizedDescription)")
        }
    }

    func findProjectRoot(in directory: URL) -> URL {
        // If there's a single subdirectory, that's probably the actual project
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )) ?? []

        if contents.count == 1,
           let first = contents.first,
           (try? first.resourceValues(forKeys: [.isDirectoryKey]).isDirectory) == true {
            return first
        }

        return directory
    }

    func openClaudeCode(at directory: URL) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-c", "cd '\(directory.path)' && claude"]
        process.environment = ProcessInfo.processInfo.environment

        // Add common paths
        var env = process.environment ?? [:]
        let additionalPaths = [
            "/usr/local/bin",
            "/opt/homebrew/bin",
            "\(FileManager.default.homeDirectoryForCurrentUser.path)/.local/bin"
        ]
        env["PATH"] = (env["PATH"] ?? "") + ":" + additionalPaths.joined(separator: ":")
        process.environment = env

        do {
            try process.run()
        } catch {
            // Fallback: try to open Terminal with claude command
            let script = """
                tell application "Terminal"
                    activate
                    do script "cd '\(directory.path)' && claude"
                end tell
            """

            let appleScript = NSAppleScript(source: script)
            appleScript?.executeAndReturnError(nil)
        }
    }

    func showNotification(title: String, message: String) {
        let notification = NSUserNotification()
        notification.title = title
        notification.informativeText = message
        NSUserNotificationCenter.default.deliver(notification)
    }

    func showError(_ message: String) {
        DispatchQueue.main.async {
            let alert = NSAlert()
            alert.messageText = "Vibelink Error"
            alert.informativeText = message
            alert.alertStyle = .critical
            alert.runModal()
            NSApp.terminate(nil)
        }
    }
}

// Main entry point
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
