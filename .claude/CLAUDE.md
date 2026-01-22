# Vibelink

Share vibe-coded apps instantly with a link.

## Project Structure

```
vibelink/
├── handler/          # macOS URL scheme handler (vibelink://)
├── worker/           # Cloudflare Worker + R2 backend
├── web/              # Preview page (served by worker)
├── spec/             # vibelink.json schema
└── .claude/skills/   # Claude Code skills
```

## Development

### URL Handler (macOS)

```bash
cd handler
./install.sh    # Build and install the handler
```

Test with: `open 'vibelink://test-project'`

### Worker (Cloudflare)

```bash
cd worker
npm install
npm run dev     # Local development
npm run deploy  # Deploy to Cloudflare
```

Requires:
- Cloudflare account
- R2 bucket named `vibelink-projects`
- Secret: `UPLOAD_SECRET`

## Skills

- `/vibelink-push` - Package and share the current project
