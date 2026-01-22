#!/bin/bash
# Vibelink URL Handler
# Handles vibelink:// URLs to download and open projects in Claude Code

set -e

URL="$1"
VIBELINKS_DIR="$HOME/vibelinks"

# Parse the URL: vibelink://projectid or vibelink://open/projectid
PROJECT_ID=$(echo "$URL" | sed -E 's|vibelink://([^/]+)(/.*)?|\1|')

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "vibelink:" ]; then
    osascript -e 'display notification "No project ID found in URL" with title "Vibelink Error"'
    exit 1
fi

# If PROJECT_ID is "open", get the next path component
if [ "$PROJECT_ID" = "open" ]; then
    PROJECT_ID=$(echo "$URL" | sed -E 's|vibelink://open/([^/]+).*|\1|')
fi

echo "Opening vibelink project: $PROJECT_ID"

# Create vibelinks directory
mkdir -p "$VIBELINKS_DIR"

# Notify user
osascript -e "display notification \"Downloading $PROJECT_ID...\" with title \"Vibelink\""

# Download the zip
DOWNLOAD_URL="https://vibelink.app/$PROJECT_ID/download"
ZIP_PATH="$VIBELINKS_DIR/$PROJECT_ID.zip"
PROJECT_DIR="$VIBELINKS_DIR/$PROJECT_ID"

if ! curl -fSL "$DOWNLOAD_URL" -o "$ZIP_PATH" 2>/dev/null; then
    osascript -e "display notification \"Failed to download project\" with title \"Vibelink Error\""
    exit 1
fi

# Remove old project directory if exists
rm -rf "$PROJECT_DIR"

# Unzip
unzip -q -o "$ZIP_PATH" -d "$PROJECT_DIR"

# Clean up zip
rm -f "$ZIP_PATH"

# Find the actual project root (if nested in single folder)
CONTENTS=$(ls -1 "$PROJECT_DIR" | head -2)
CONTENT_COUNT=$(echo "$CONTENTS" | wc -l | tr -d ' ')

if [ "$CONTENT_COUNT" = "1" ] && [ -d "$PROJECT_DIR/$CONTENTS" ]; then
    ACTUAL_DIR="$PROJECT_DIR/$CONTENTS"
else
    ACTUAL_DIR="$PROJECT_DIR"
fi

# Notify success
osascript -e "display notification \"Opening in Claude Code...\" with title \"Vibelink\""

# Open Claude Code
# Try different methods to find claude
CLAUDE_PATH=""
for path in "$HOME/.local/bin/claude" "/usr/local/bin/claude" "/opt/homebrew/bin/claude"; do
    if [ -x "$path" ]; then
        CLAUDE_PATH="$path"
        break
    fi
done

if [ -n "$CLAUDE_PATH" ]; then
    # Open a new terminal window with claude
    osascript <<EOF
tell application "Terminal"
    activate
    do script "cd '$ACTUAL_DIR' && '$CLAUDE_PATH'"
end tell
EOF
else
    # Fallback: just open the directory
    osascript -e "display notification \"Claude not found. Opening folder instead.\" with title \"Vibelink\""
    open "$ACTUAL_DIR"
fi
