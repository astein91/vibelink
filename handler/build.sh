#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/.build"
APP_NAME="Vibelink Handler"
APP_BUNDLE="$BUILD_DIR/$APP_NAME.app"

echo "🔨 Building Vibelink Handler..."

# Build the Swift executable
cd "$SCRIPT_DIR"
swift build -c release

# Create app bundle structure
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

# Copy executable
cp "$BUILD_DIR/release/VibelinkHandler" "$APP_BUNDLE/Contents/MacOS/"

# Copy Info.plist
cp "$SCRIPT_DIR/Info.plist" "$APP_BUNDLE/Contents/"

echo "✅ Built: $APP_BUNDLE"
echo ""
echo "To install, run:"
echo "  ./install.sh"
