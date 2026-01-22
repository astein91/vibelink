#!/bin/bash
set -e

# ============================================================================
# Vibelink Handler - Sign and Notarize for macOS Distribution
# ============================================================================
#
# Prerequisites:
# 1. Apple Developer account ($99/year)
# 2. Developer ID Application certificate installed in Keychain
# 3. App-specific password for notarization
#
# Setup (one-time):
#   export APPLE_TEAM_ID="YOUR_TEAM_ID"           # From developer.apple.com
#   export APPLE_ID="your@email.com"              # Your Apple ID
#   export APPLE_APP_PASSWORD="xxxx-xxxx-xxxx"    # App-specific password
#
# Or create a .env file in this directory with those values.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="Vibelink Handler"
APP_BUNDLE="$SCRIPT_DIR/$APP_NAME.app"
ZIP_PATH="$SCRIPT_DIR/VibelinkHandler.zip"

# Load .env if exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
fi

# Check required env vars
if [ -z "$APPLE_TEAM_ID" ] || [ -z "$APPLE_ID" ] || [ -z "$APPLE_APP_PASSWORD" ]; then
    echo "❌ Missing required environment variables."
    echo ""
    echo "Set these before running:"
    echo "  export APPLE_TEAM_ID=\"YOUR_TEAM_ID\""
    echo "  export APPLE_ID=\"your@email.com\""
    echo "  export APPLE_APP_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\""
    echo ""
    echo "Or create a .env file with these values."
    exit 1
fi

SIGNING_IDENTITY="Developer ID Application: ($APPLE_TEAM_ID)"

echo "🔨 Building app bundle..."
"$SCRIPT_DIR/create-app-bundle.sh"

echo ""
echo "🔏 Signing with identity: $SIGNING_IDENTITY"

# Sign the app
codesign --force --options runtime --timestamp \
    --sign "$SIGNING_IDENTITY" \
    "$APP_BUNDLE"

# Verify signature
echo "✅ Verifying signature..."
codesign --verify --verbose "$APP_BUNDLE"

echo ""
echo "📦 Creating zip for notarization..."
rm -f "$ZIP_PATH"
ditto -c -k --keepParent "$APP_BUNDLE" "$ZIP_PATH"

echo ""
echo "🚀 Submitting to Apple for notarization..."
echo "   (This may take a few minutes)"

# Submit for notarization
xcrun notarytool submit "$ZIP_PATH" \
    --apple-id "$APPLE_ID" \
    --team-id "$APPLE_TEAM_ID" \
    --password "$APPLE_APP_PASSWORD" \
    --wait

echo ""
echo "📎 Stapling notarization ticket..."
xcrun stapler staple "$APP_BUNDLE"

# Recreate zip with stapled app
rm -f "$ZIP_PATH"
ditto -c -k --keepParent "$APP_BUNDLE" "$ZIP_PATH"

echo ""
echo "✅ Done! Signed and notarized."
echo ""
echo "Outputs:"
echo "  - $APP_BUNDLE (signed + notarized)"
echo "  - $ZIP_PATH (ready for distribution)"
echo ""
echo "Users can now download and run without Gatekeeper warnings."
