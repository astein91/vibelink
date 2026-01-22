# Vibelink

Share your vibe-coded apps instantly with a link.

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Push your project                                           │
│  $ claude                                                       │
│  > /vibelink-push                                               │
│  → Creates vibelink.json + screenshot                           │
│  → Uploads to vibelink.app                                      │
│  → Returns: https://vibelink.app/my-app-x7k2                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Share the link                                              │
│  vibelink.app/my-app-x7k2 shows:                                │
│  - App name & description                                       │
│  - Screenshot preview                                           │
│  - Technologies used                                            │
│  - "Open in Claude Code" button                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Receiver clicks "Open in Claude Code"                       │
│  → vibelink:// URL triggers handler                             │
│  → Downloads and unzips project                                 │
│  → Opens Claude Code in project directory                       │
│  → Claude auto-detects and runs the project                     │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### For sharing (push)

The `/vibelink-push` skill is included in this repo. Copy `.claude/skills/vibelink-push.md` to your Claude Code skills.

### For receiving (open links)

```bash
# Install the URL handler
cd handler
./install.sh
```

Or (once deployed):
```bash
curl -fsSL vibelink.app/install.sh | bash
```

## vibelink.json spec

```json
{
  "name": "My Cool App",
  "description": "A weather dashboard with real-time updates",
  "author": "yourname",
  "technologies": ["React", "TypeScript", "Tailwind"],
  "preview": {
    "type": "image",
    "src": "./vibelink-preview.png"
  }
}
```

## Architecture

| Component | Description |
|-----------|-------------|
| `handler/` | macOS app that handles `vibelink://` URLs |
| `worker/` | Cloudflare Worker serving preview pages + downloads |
| `spec/` | JSON schema for vibelink.json |

## Privacy

Vibelink uses link-based privacy:
- Projects are stored with random IDs
- Not searchable or indexed
- Anyone with the link can access
- No account required

## Development

```bash
# Run the worker locally
cd worker
npm install
npm run dev

# Build the handler
cd handler
./install.sh
```

## License

MIT
