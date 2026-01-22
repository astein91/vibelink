#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Vibelink Handler"
APP_BUNDLE="$SCRIPT_DIR/$APP_NAME.app"
INSTALL_PATH="/Applications/$APP_NAME.app"

# Create app bundle first
"$SCRIPT_DIR/create-app-bundle.sh"

echo ""
echo "📦 Installing Vibelink Handler..."

# Remove old installation
if [ -d "$INSTALL_PATH" ]; then
    echo "Removing old installation..."
    rm -rf "$INSTALL_PATH"
fi

# Copy to Applications
cp -R "$APP_BUNDLE" "$INSTALL_PATH"

# Reset Launch Services to recognize the new URL scheme
echo "Registering vibelink:// URL scheme..."
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$INSTALL_PATH"

echo ""
echo "✅ Installed successfully!"
echo ""
echo "The vibelink:// URL scheme is now registered."
echo ""
echo "Test it with:"
echo "  open 'vibelink://demo'"
echo ""
echo "Note: The backend isn't set up yet, so this will fail to download."
echo "      But you should see the notification attempt!"
