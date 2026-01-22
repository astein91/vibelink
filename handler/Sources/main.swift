import AppKit
import Foundation

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Get project ID from our own bundle name
        // e.g., "bla4iuj8p8hg.app" -> "bla4iuj8p8hg"
        guard let bundlePath = Bundle.main.bundlePath as NSString? else {
            showError("Could not determine bundle path")
            return
        }

        let bundleName = bundlePath.lastPathComponent
        let projectId = (bundleName as NSString).deletingPathExtension

        // Validate project ID (should be alphanumeric)
        guard !projectId.isEmpty,
              projectId.range(of: "^[a-zA-Z0-9_-]+$", options: .regularExpression) != nil else {
            showError("Invalid project ID: \(projectId)\n\nThis app should be named like 'abc123.app' where abc123 is a vibelink project ID.")
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
        let downloadURL = URL(string: "https://vibelink.to/\(projectId)/download")!

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
            openClaudeCode(at: actualProjectDir, projectId: projectId)

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

    func openClaudeCode(at directory: URL, projectId: String) {
        // Initial prompt for Claude to introduce the project
        let initialPrompt = """
        Hey! I just downloaded this project from vibelink.to/\(projectId). Can you:
        1. Tell me what this project is and what it does
        2. Install any dependencies needed
        3. Start the dev server or run it
        4. Give me a quick tour of the key files

        Let's go!
        """

        // Try to find claude in common locations
        let claudePaths = [
            "\(FileManager.default.homeDirectoryForCurrentUser.path)/.local/bin/claude",
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude"
        ]

        var claudePath: String?
        for path in claudePaths {
            if FileManager.default.isExecutableFile(atPath: path) {
                claudePath = path
                break
            }
        }

        if let claudePath = claudePath {
            // Launch Claude Code directly
            let process = Process()
            process.executableURL = URL(fileURLWithPath: claudePath)
            process.arguments = [initialPrompt]
            process.currentDirectoryURL = directory
            process.environment = ProcessInfo.processInfo.environment

            do {
                try process.run()
                return
            } catch {
                print("Failed to launch claude directly: \(error)")
            }
        }

        // Fallback: open Terminal with claude command
        let escapedPath = directory.path.replacingOccurrences(of: "'", with: "'\\''")
        let escapedPrompt = initialPrompt.replacingOccurrences(of: "'", with: "'\\''").replacingOccurrences(of: "\n", with: "\\n")

        let script = """
            tell application "Terminal"
                activate
                do script "cd '\(escapedPath)' && claude '\(escapedPrompt)'"
            end tell
        """

        let appleScript = NSAppleScript(source: script)
        var error: NSDictionary?
        appleScript?.executeAndReturnError(&error)

        if error != nil {
            // Last resort: just open the folder in Finder
            NSWorkspace.shared.open(directory)
            showError("Could not find Claude Code. Please install it from https://claude.ai/download\n\nYour project was downloaded to:\n\(directory.path)")
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
