#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Vibelink Handler"
APP_BUNDLE="$SCRIPT_DIR/$APP_NAME.app"

echo "📦 Creating Vibelink Handler app bundle..."

# Remove old bundle
rm -rf "$APP_BUNDLE"

# Create app bundle structure
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Create the main executable that calls our handler script
cat > "$APP_BUNDLE/Contents/MacOS/VibelinkHandler" << 'EXEC'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANDLER="$SCRIPT_DIR/../Resources/vibelink-handler.sh"

# The URL is passed as a command line argument by macOS
exec "$HANDLER" "$@"
EXEC

chmod +x "$APP_BUNDLE/Contents/MacOS/VibelinkHandler"

# Copy the handler script to Resources
cp "$SCRIPT_DIR/vibelink-handler.sh" "$APP_BUNDLE/Contents/Resources/"
chmod +x "$APP_BUNDLE/Contents/Resources/vibelink-handler.sh"

# Create Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>VibelinkHandler</string>
    <key>CFBundleIdentifier</key>
    <string>app.vibelink.handler</string>
    <key>CFBundleName</key>
    <string>Vibelink Handler</string>
    <key>CFBundleDisplayName</key>
    <string>Vibelink</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <true/>
    <key>LSBackgroundOnly</key>
    <false/>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>Vibelink URL</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>vibelink</string>
            </array>
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
        </dict>
    </array>
</dict>
</plist>
PLIST

echo "✅ Created: $APP_BUNDLE"
echo ""
echo "To install, run:"
echo "  ./install.sh"
