#!/bin/bash
# Vibelink Handler Installer
# Usage: curl -fsSL vibelink.app/install.sh | bash

set -e

echo "Installing Vibelink Handler..."

INSTALL_DIR="$HOME/.vibelink"
APP_NAME="Vibelink Handler"
APP_BUNDLE="$INSTALL_DIR/$APP_NAME.app"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download the handler
echo "Downloading handler..."
curl -fsSL "https://github.com/YOUR_USERNAME/vibelink/releases/latest/download/VibelinkHandler.zip" -o "$INSTALL_DIR/handler.zip"

# Unzip
unzip -o "$INSTALL_DIR/handler.zip" -d "$INSTALL_DIR"
rm "$INSTALL_DIR/handler.zip"

# Move to Applications
echo "Installing to /Applications..."
if [ -d "/Applications/$APP_NAME.app" ]; then
    rm -rf "/Applications/$APP_NAME.app"
fi
cp -R "$APP_BUNDLE" "/Applications/"

# Register URL scheme
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "/Applications/$APP_NAME.app"

echo ""
echo "✅ Vibelink Handler installed!"
echo ""
echo "You can now open vibelink:// URLs."
echo "Try clicking a vibelink or run: open 'vibelink://demo'"
