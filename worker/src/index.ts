export interface Env {
  BUCKET: R2Bucket;
  ENVIRONMENT: string;
}

// Rate limiting config - 100MB per hour per IP
const RATE_LIMIT_BYTES_PER_HOUR = 100 * 1024 * 1024; // 100MB
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Install script content
const INSTALL_SCRIPT = `#!/bin/bash
set -e

echo "Installing vibelink-push skill..."

mkdir -p ~/.claude/skills/vibelink-push
curl -fsSL https://vibelink.to/skill/vibelink-push.md > ~/.claude/skills/vibelink-push/SKILL.md

echo ""
echo "✓ Installed vibelink-push skill"
echo "  Restart Claude Code to use /vibelink-push"
`;

// Skill file content (embedded)
const SKILL_CONTENT = `# /vibelink-push

Share the current project via Vibelink.

## What this skill does

1. Analyzes the project to detect name, description, and technologies
2. Detects if this is a remix of another vibelink project
3. Starts the dev server (if applicable)
4. Takes a screenshot of the running app (if browser tools available)
5. Creates or updates \`vibelink.json\` metadata
6. Zips the project (excluding node_modules, .git, etc.)
7. Uploads to vibelink.to
8. Returns the shareable link

## Instructions

When the user runs \`/vibelink-push\`, follow these steps:

### Step 1: Analyze the project

Look for these files to understand the project:
- \`package.json\` - for name, description, dependencies
- \`README.md\` - for description
- \`vibelink.json\` - existing metadata (if any)
- Source files - to detect technologies

Detect technologies by looking at:
- Dependencies in package.json (React, Vue, Svelte, etc.)
- File extensions (.ts, .tsx, .py, .rs, etc.)
- Config files (tailwind.config.js, vite.config.ts, etc.)

### Step 2: Check for existing vibelink.json and detect remixes

Check if \`vibelink.json\` exists and examine it:

**Case A: No vibelink.json exists**
- This is a new project
- Generate a new projectId
- Ask user for name, description, author

**Case B: vibelink.json exists with NO \`forkedFrom\` field**
- This is the original project being updated
- Keep the same projectId
- Update metadata if needed

**Case C: vibelink.json exists WITH a \`forkedFrom\` field, but same author**
- This is the user's own remix being updated
- Keep the same projectId
- Update metadata if needed

**Case D: vibelink.json exists and project is in ~/vibelinks/ directory**
- This was downloaded from vibelink - it's a remix!
- MUST generate a NEW projectId (never overwrite someone else's project)
- Set \`forkedFrom\` to the original projectId
- Ask user: "This looks like a remix of {originalName}. What do you want to call your version?"
- Suggest a name like "{originalName} Remix" or let them choose

### Step 3: Check for existing project ID

**For NEW projects:**
- Do NOT generate a project ID - the server will generate one
- The server returns the generated ID in the response

**For UPDATES (when vibelink.json already has a projectId and you have a saved token):**
- Use the existing projectId from vibelink.json
- Include the saved author token

### Step 4: Try to capture a preview screenshot

If browser automation tools (mcp__claude-in-chrome__*) are available:

1. Detect the dev server command and port from package.json scripts or common patterns
2. Start the dev server in the background
3. Wait for it to be ready (check if port is listening)
4. Navigate to localhost:{port} using mcp__claude-in-chrome__navigate
5. Take a screenshot using mcp__claude-in-chrome__computer with action: "screenshot"
6. Save the screenshot to \`./vibelink-preview.png\`
7. Stop the dev server

If browser tools are not available or the app can't be started, skip this step.

### Step 5: Create the zip

Create a zip file excluding:
- \`node_modules/\`
- \`.git/\`
- \`dist/\`
- \`build/\`
- \`.next/\`
- \`__pycache__/\`
- \`*.pyc\`
- \`.env\` (but include \`.env.example\` if it exists)
- \`.DS_Store\`
- \`vibelink-upload.zip\` (previous upload)

Use: \`zip -r vibelink-upload.zip . -x "node_modules/*" -x ".git/*" ...\`

### Step 6: Upload to vibelink.to

**Determine if this is a NEW project or UPDATE:**

Check if vibelink.json has a \`projectId\` AND you have a saved token in \`~/.vibelink-tokens/{projectId}\`:
- If BOTH exist: this is an UPDATE
- Otherwise: this is a NEW project

**Upload the project using curl:**

For NEW projects (server generates the ID):
\`\`\`bash
curl -X POST https://vibelink.to/upload \\
  -F "metadata=@vibelink.json" \\
  -F "zip=@vibelink-upload.zip" \\
  -F "preview=@vibelink-preview.png"  # only if preview exists
\`\`\`

For UPDATES (include projectId and authorToken):
\`\`\`bash
curl -X POST https://vibelink.to/upload \\
  -F "projectId={projectId}" \\
  -F "authorToken={token}" \\
  -F "metadata=@vibelink.json" \\
  -F "zip=@vibelink-upload.zip" \\
  -F "preview=@vibelink-preview.png"  # only if preview exists
\`\`\`

**Handle the response:**

The response JSON includes:
- \`projectId\`: The project's ID (server-generated for new projects)
- \`url\`: The shareable URL
- \`isUpdate\`: Whether this was an update
- \`authorToken\`: (Only for new projects) Save this!

On success (200):
1. Parse the JSON response to get the \`projectId\`
2. If response contains \`authorToken\`:
   - Create tokens directory: \`mkdir -p ~/.vibelink-tokens\`
   - Save token: \`echo "{token}" > ~/.vibelink-tokens/{projectId}\`
   - Update vibelink.json with the server-generated \`projectId\`
3. Display the shareable link

Error responses:
- 403 Forbidden: Invalid or missing author token for update
- 404 Not Found: Trying to update a project that doesn't exist
- 413 Payload Too Large: Project exceeds 100MB limit
- 429 Rate Limited: Exceeded 100MB/hour upload limit

**On successful upload, display:**

For NEW projects:
\`\`\`
Uploaded to Vibelink!

Project: {name}
{Remixed from: {originalName} - if applicable}

https://vibelink.to/{projectId}

Share this link - anyone can open it in Claude Code!

Your author token has been saved to ~/.vibelink-tokens/{projectId}
   You'll need this token to update your project later.
\`\`\`

For UPDATES:
\`\`\`
Updated on Vibelink!

Project: {name}

https://vibelink.to/{projectId}
\`\`\`

### Step 7: Clean up

Optionally remove the zip file after successful upload (keep vibelink.json).

## Example vibelink.json - New project

\`\`\`json
{
  "name": "Weather Dashboard",
  "description": "A real-time weather dashboard with beautiful visualizations",
  "author": "alexstein",
  "projectId": "weather-dashboard-x7k2",
  "technologies": ["React", "TypeScript", "Tailwind CSS", "OpenWeather API"],
  "preview": {
    "type": "image",
    "src": "./vibelink-preview.png"
  }
}
\`\`\`

## Example vibelink.json - Remix

\`\`\`json
{
  "name": "Weather Dashboard Dark Mode",
  "description": "Added dark mode and hourly forecasts to the weather dashboard",
  "author": "friendname",
  "projectId": "weather-dashboard-dark-k9p2",
  "forkedFrom": "weather-dashboard-x7k2",
  "technologies": ["React", "TypeScript", "Tailwind CSS", "OpenWeather API"],
  "preview": {
    "type": "image",
    "src": "./vibelink-preview.png"
  }
}
\`\`\`

## Important notes

- Always ask for confirmation before uploading
- Don't include sensitive files (.env, credentials, etc.)
- NEVER overwrite someone else's project - always create a new ID for remixes
- If the project is in ~/vibelinks/, it was downloaded and is definitely a remix
- Give credit by setting \`forkedFrom\` when remixing
- Author tokens are stored in \`~/.vibelink-tokens/\` - these are needed to update projects
- If you lose your author token, you cannot update that project (create a new one instead)

## Limits

**Per-project size limit: 100MB**

Vibelink is for small vibe-coded projects, not large repositories.

After creating the zip, check its size:
\`\`\`bash
du -h vibelink-upload.zip
\`\`\`

- **Under 100MB**: Good to go!
- **Over 100MB**: Stop and warn the user. Suggest:
  - Make sure node_modules, .git, dist, build are excluded
  - Remove large assets (videos, large images)
  - Consider if this project is too big for vibelink

**Rate limit: 100MB per hour per user**

Users can upload up to 100MB total per hour. If rate limited, they'll need to wait before uploading more.
`;

// Public metadata (returned to users, stored in vibelink.json)
interface VibelinkMetadata {
  name: string;
  description: string;
  author?: string;
  projectId?: string;
  forkedFrom?: string;
  preview?: {
    type: 'image' | 'mockup' | 'auto';
    src?: string;
    layout?: string;
    components?: string[];
  };
  createdAt: string;
  technologies?: string[];
}

// Private project data (stored separately, contains auth info)
interface ProjectAuth {
  tokenHash: string;  // SHA-256 hash of the author token
  createdAt: string;
  lastUpdated: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Landing page
      if (path === '/' || path === '') {
        return new Response(landingPageHTML(), {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      // Skill download endpoint
      if (path === '/skill/vibelink-push.md') {
        return new Response(SKILL_CONTENT, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': 'attachment; filename="vibelink-push.md"',
          },
        });
      }

      // Install script endpoint
      if (path === '/install.sh') {
        return new Response(INSTALL_SCRIPT, {
          headers: {
            'Content-Type': 'text/plain',
          },
        });
      }

      // Upload endpoint
      if (path === '/upload' && request.method === 'POST') {
        return handleUpload(request, env);
      }

      // Parse project routes: /{projectId} or /{projectId}/download or /{projectId}/metadata
      const match = path.match(/^\/([a-zA-Z0-9_-]+)(\/(.+))?$/);
      if (!match) {
        return new Response('Not found', { status: 404 });
      }

      const projectId = match[1];
      const action = match[3];

      // Check if project exists
      const metadataKey = `${projectId}/vibelink.json`;
      const metadataObj = await env.BUCKET.get(metadataKey);

      if (!metadataObj) {
        return new Response(notFoundPageHTML(projectId), {
          status: 404,
          headers: { 'Content-Type': 'text/html' },
        });
      }

      const metadata: VibelinkMetadata = await metadataObj.json();

      // Download the zip
      if (action === 'download') {
        const zipKey = `${projectId}/project.zip`;
        const zipObj = await env.BUCKET.get(zipKey);

        if (!zipObj) {
          return new Response('Project archive not found', { status: 404 });
        }

        return new Response(zipObj.body, {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${projectId}.zip"`,
            ...corsHeaders,
          },
        });
      }

      // Return metadata as JSON
      if (action === 'metadata') {
        return new Response(JSON.stringify(metadata, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Preview image
      if (action === 'preview.png') {
        const previewKey = `${projectId}/preview.png`;
        const previewObj = await env.BUCKET.get(previewKey);

        if (!previewObj) {
          // Return a placeholder or 404
          return new Response('No preview available', { status: 404 });
        }

        return new Response(previewObj.body, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Generate .command launcher file (legacy, may have permission issues)
      if (action === 'open.command') {
        const commandScript = generateLauncherScript(projectId, metadata.name);
        return new Response(commandScript, {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${projectId}.command"`,
          },
        });
      }

      // Shell script for curl | bash (recommended method)
      if (action === 'open') {
        const openScript = generateOpenScript(projectId, metadata.name);
        return new Response(openScript, {
          headers: {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // Check if preview image actually exists in R2
      const previewKey = `${projectId}/preview.png`;
      const previewExists = await env.BUCKET.head(previewKey);

      // Default: serve the preview page
      return new Response(previewPageHTML(projectId, metadata, !!previewExists), {
        headers: { 'Content-Type': 'text/html' },
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response('Internal server error', { status: 500 });
    }
  },
};

const MAX_UPLOAD_SIZE_MB = 100;
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

// Rate limiting using R2 to track upload sizes per IP
interface RateLimitData {
  uploads: { timestamp: number; bytes: number }[];
}

async function checkRateLimit(clientIP: string, uploadSize: number, env: Env): Promise<{ allowed: boolean; retryAfterMinutes?: number; remainingBytes?: number }> {
  const rateLimitKey = `_ratelimit/${hashIP(clientIP)}.json`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  try {
    const existing = await env.BUCKET.get(rateLimitKey);
    if (!existing) {
      return { allowed: true, remainingBytes: RATE_LIMIT_BYTES_PER_HOUR };
    }

    const data: RateLimitData = await existing.json();
    // Filter to only uploads within the time window
    const recentUploads = data.uploads.filter(u => u.timestamp > windowStart);
    const totalBytes = recentUploads.reduce((sum, u) => sum + u.bytes, 0);
    const remainingBytes = RATE_LIMIT_BYTES_PER_HOUR - totalBytes;

    if (totalBytes + uploadSize > RATE_LIMIT_BYTES_PER_HOUR) {
      // Find when enough quota will be freed
      const oldestInWindow = Math.min(...recentUploads.map(u => u.timestamp));
      const retryAfterMs = oldestInWindow + RATE_LIMIT_WINDOW_MS - now;
      const retryAfterMinutes = Math.ceil(retryAfterMs / 60000);
      return { allowed: false, retryAfterMinutes, remainingBytes: Math.max(0, remainingBytes) };
    }

    return { allowed: true, remainingBytes };
  } catch {
    // If rate limit check fails, allow the upload (fail open)
    return { allowed: true, remainingBytes: RATE_LIMIT_BYTES_PER_HOUR };
  }
}

async function recordUpload(clientIP: string, uploadSize: number, env: Env): Promise<void> {
  const rateLimitKey = `_ratelimit/${hashIP(clientIP)}.json`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  try {
    let uploads: { timestamp: number; bytes: number }[] = [];

    const existing = await env.BUCKET.get(rateLimitKey);
    if (existing) {
      const data: RateLimitData = await existing.json();
      // Keep only recent uploads + add new one
      uploads = data.uploads.filter(u => u.timestamp > windowStart);
    }

    uploads.push({ timestamp: now, bytes: uploadSize });

    await env.BUCKET.put(rateLimitKey, JSON.stringify({ uploads }), {
      httpMetadata: { contentType: 'application/json' },
    });
  } catch {
    // Non-critical, continue even if recording fails
  }
}

// Simple hash function to avoid storing raw IPs
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// SHA-256 hash for author tokens
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a short random project ID (URL-friendly)
function generateProjectId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => chars[b % chars.length]).join('');
}

async function handleUpload(request: Request, env: Env): Promise<Response> {
  // Get client IP for rate limiting
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';

  const formData = await request.formData();
  const clientProjectId = formData.get('projectId') as string | null;  // Only used for updates
  const metadataRaw = formData.get('metadata');
  const zipFile = formData.get('zip') as File;
  const previewFile = formData.get('preview') as File | null;
  const authorToken = formData.get('authorToken') as string | null;

  // Handle metadata as either string or File
  let metadata: string;
  if (metadataRaw instanceof File) {
    metadata = await metadataRaw.text();
  } else {
    metadata = metadataRaw as string;
  }

  if (!metadata || !zipFile) {
    return new Response('Missing required fields: metadata, zip', { status: 400 });
  }

  // Determine if this is an update or new upload
  // Updates require both projectId AND authorToken
  const isUpdate = !!(clientProjectId && authorToken);

  let projectId: string;
  if (isUpdate) {
    // Validate provided project ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(clientProjectId)) {
      return new Response('Invalid project ID format.', { status: 400 });
    }
    projectId = clientProjectId;
  } else {
    // Generate new project ID server-side
    projectId = generateProjectId();
  }

  // Check file size limit
  if (zipFile.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMB = (zipFile.size / (1024 * 1024)).toFixed(1);
    return new Response(
      `Project too large: ${sizeMB}MB exceeds the ${MAX_UPLOAD_SIZE_MB}MB limit. ` +
      `Vibelink is for small vibe-coded projects. Make sure node_modules and other large directories are excluded.`,
      { status: 413 }
    );
  }

  // Calculate total upload size for rate limiting
  const totalUploadSize = zipFile.size + (previewFile?.size || 0);

  // Check rate limit with upload size
  const rateLimitResult = await checkRateLimit(clientIP, totalUploadSize, env);
  if (!rateLimitResult.allowed) {
    const remainingMB = ((rateLimitResult.remainingBytes || 0) / (1024 * 1024)).toFixed(1);
    return new Response(
      `Rate limit exceeded. You can upload 100MB per hour. ` +
      `You have ${remainingMB}MB remaining. Try again in ${rateLimitResult.retryAfterMinutes} minutes.`,
      {
        status: 429,
        headers: { 'Retry-After': String((rateLimitResult.retryAfterMinutes || 60) * 60) }
      }
    );
  }

  // Check if project already exists
  const authKey = `${projectId}/_auth.json`;
  const existingAuth = await env.BUCKET.get(authKey);
  const existingMetadata = await env.BUCKET.get(`${projectId}/vibelink.json`);

  let newAuthorToken: string | null = null;

  if (isUpdate) {
    // Client is trying to update - verify the project exists and token is valid
    if (!existingAuth) {
      return new Response(
        `Project "${projectId}" not found. Cannot update a project that doesn't exist.`,
        { status: 404 }
      );
    }

    const authData: ProjectAuth = await existingAuth.json();
    const providedTokenHash = await hashToken(authorToken!);

    if (providedTokenHash !== authData.tokenHash) {
      return new Response(
        `Invalid author token for project "${projectId}". ` +
        `Only the original author can update this project.`,
        { status: 403 }
      );
    }

    // Update the auth record with new timestamp
    authData.lastUpdated = new Date().toISOString();
    await env.BUCKET.put(authKey, JSON.stringify(authData), {
      httpMetadata: { contentType: 'application/json' },
    });
  } else {
    // New project - ID was generated server-side, create author token
    newAuthorToken = generateToken();
    const tokenHash = await hashToken(newAuthorToken);
    const authData: ProjectAuth = {
      tokenHash,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    await env.BUCKET.put(authKey, JSON.stringify(authData), {
      httpMetadata: { contentType: 'application/json' },
    });
  }

  // Store the zip
  await env.BUCKET.put(`${projectId}/project.zip`, zipFile.stream(), {
    httpMetadata: { contentType: 'application/zip' },
  });

  // Store metadata (preserve original createdAt if updating)
  const parsedMetadata = JSON.parse(metadata);
  let existingCreatedAt: string | undefined;
  if (existingMetadata) {
    try {
      const existing: VibelinkMetadata = await existingMetadata.json();
      existingCreatedAt = existing.createdAt;
    } catch {
      // Ignore parsing errors
    }
  }

  const metadataObj: VibelinkMetadata = {
    ...parsedMetadata,
    createdAt: existingCreatedAt || new Date().toISOString(),
  };
  await env.BUCKET.put(`${projectId}/vibelink.json`, JSON.stringify(metadataObj), {
    httpMetadata: { contentType: 'application/json' },
  });

  // Store preview if provided
  if (previewFile) {
    await env.BUCKET.put(`${projectId}/preview.png`, previewFile.stream(), {
      httpMetadata: { contentType: 'image/png' },
    });
  }

  // Record successful upload for rate limiting
  await recordUpload(clientIP, totalUploadSize, env);

  // Build response
  const response: {
    success: boolean;
    url: string;
    projectId: string;
    isUpdate: boolean;
    authorToken?: string;
    message?: string;
  } = {
    success: true,
    url: `https://vibelink.to/${projectId}`,
    projectId,
    isUpdate,
  };

  if (newAuthorToken) {
    response.authorToken = newAuthorToken;
    response.message = 'IMPORTANT: Save your author token! You need it to update this project. It cannot be recovered.';
  }

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function landingPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vibelink - Share Your Vibe Coded Apps</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 600px;
    }
    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      background: linear-gradient(90deg, #00d4ff, #9b59b6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 1.25rem;
      color: #a0a0a0;
      margin-bottom: 2rem;
    }
    .features {
      display: grid;
      gap: 1rem;
      margin-top: 2rem;
      text-align: left;
    }
    .feature {
      background: rgba(255,255,255,0.05);
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .feature h3 { color: #00d4ff; margin-bottom: 0.5rem; }
    code {
      background: rgba(0,212,255,0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .install {
      margin-top: 2.5rem;
      padding: 1.5rem;
      background: rgba(155,89,182,0.1);
      border-radius: 12px;
      border: 1px solid rgba(155,89,182,0.3);
      text-align: left;
    }
    .install h2 {
      color: #9b59b6;
      font-size: 1.25rem;
      margin-bottom: 1rem;
      text-align: center;
    }
    .install-cmd {
      background: rgba(0,0,0,0.3);
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.9rem;
      margin: 0.75rem 0;
      overflow-x: auto;
      white-space: nowrap;
    }
    .install p {
      color: #ccc;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }
    .install .or {
      text-align: center;
      color: #666;
      margin: 1rem 0;
      font-size: 0.85rem;
    }
    .install a {
      color: #00d4ff;
      text-decoration: none;
    }
    .install a:hover {
      text-decoration: underline;
    }
    .install .path {
      color: #888;
      font-size: 0.8rem;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>vibelink</h1>
    <p class="tagline">Share your vibe coded apps instantly</p>
    <div class="features">
      <div class="feature">
        <h3>1. Push</h3>
        <p>Run <code>/vibelink-push</code> in Claude Code to share your project</p>
      </div>
      <div class="feature">
        <h3>2. Share</h3>
        <p>Get a link like <code>vibelink.to/your-project</code></p>
      </div>
      <div class="feature">
        <h3>3. Vibe</h3>
        <p>Others click the link, it opens directly in Claude Code</p>
      </div>
    </div>
    <div class="install">
      <h2>Install the Skill</h2>
      <p>Run this in your terminal:</p>
      <div class="install-cmd">curl -fsSL vibelink.to/install.sh | bash</div>
      <p class="or">- or -</p>
      <p><a href="/skill/vibelink-push.md" download>Download vibelink-push.md</a> manually</p>
      <p class="path">Save to: ~/.claude/skills/vibelink-push/SKILL.md</p>
    </div>
    <p style="margin-top: 2rem; color: #666; font-size: 0.85rem;">Currently macOS only. Windows &amp; Linux coming soon.</p>
  </div>
</body>
</html>`;
}

function previewPageHTML(projectId: string, metadata: VibelinkMetadata, previewExists: boolean): string {
  // Only show preview if the image actually exists in R2
  const previewSrc = previewExists ? `/${projectId}/preview.png` : null;
  const technologies = metadata.technologies?.join(', ') || 'Not specified';
  const forkedFrom = metadata.forkedFrom;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(metadata.name)} - Vibelink</title>
  <meta property="og:title" content="${escapeHtml(metadata.name)}">
  <meta property="og:description" content="${escapeHtml(metadata.description)}">
  ${previewSrc ? `<meta property="og:image" content="https://vibelink.to${previewSrc}">` : ''}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    .back {
      color: #00d4ff;
      text-decoration: none;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      display: inline-block;
    }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.1);
      overflow: hidden;
    }
    .preview {
      background: #0d0d1a;
      aspect-ratio: 16/9;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
      font-size: 1.5rem;
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .content {
      padding: 2rem;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .author {
      color: #888;
      margin-bottom: 0.5rem;
    }
    .remix-badge {
      color: #9b59b6;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .remix-badge a {
      color: #00d4ff;
      text-decoration: none;
    }
    .remix-badge a:hover {
      text-decoration: underline;
    }
    .description {
      font-size: 1.1rem;
      color: #ccc;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }
    .meta {
      display: flex;
      gap: 2rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .meta-item {
      color: #888;
    }
    .meta-item strong {
      color: #00d4ff;
      display: block;
      font-size: 0.8rem;
      text-transform: uppercase;
      margin-bottom: 0.25rem;
    }
    .button {
      display: inline-block;
      background: linear-gradient(90deg, #00d4ff, #9b59b6);
      color: #fff;
      padding: 1rem 2rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 1.1rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,212,255,0.3);
    }
    .button-secondary {
      background: rgba(255,255,255,0.1);
      margin-left: 1rem;
    }
    .install-note {
      margin-top: 1.5rem;
      padding: 1.25rem;
      background: rgba(0,212,255,0.08);
      border-radius: 8px;
      font-size: 0.9rem;
      color: #ccc;
      border: 1px solid rgba(0,212,255,0.2);
    }
    .install-note h4 {
      color: #00d4ff;
      margin-bottom: 0.75rem;
      font-size: 0.95rem;
    }
    .install-note code {
      background: rgba(0,212,255,0.15);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .install-note ol {
      margin: 0.5rem 0 0 1.25rem;
      line-height: 1.8;
    }
    .install-note a {
      color: #00d4ff;
      text-decoration: none;
    }
    .install-note a:hover {
      text-decoration: underline;
    }
    .security-warning {
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
      background: rgba(255,193,7,0.1);
      border-radius: 8px;
      font-size: 0.85rem;
      color: #ccc;
      border: 1px solid rgba(255,193,7,0.3);
    }
    .security-warning strong {
      color: #ffc107;
    }
    .open-command {
      margin: 1.5rem 0;
      padding: 1.25rem;
      background: rgba(0,212,255,0.08);
      border-radius: 8px;
      border: 1px solid rgba(0,212,255,0.2);
    }
    .open-command h4 {
      color: #00d4ff;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    .open-command > p {
      color: #aaa;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }
    .command-box {
      display: flex;
      align-items: center;
      background: rgba(0,0,0,0.4);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      gap: 0.75rem;
    }
    .command-box code {
      flex: 1;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.85rem;
      color: #0f0;
      word-break: break-all;
      background: none;
      padding: 0;
    }
    .copy-btn {
      background: rgba(0,212,255,0.2);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 4px;
      padding: 0.4rem 0.6rem;
      cursor: pointer;
      font-size: 1rem;
      transition: background 0.2s;
    }
    .copy-btn:hover {
      background: rgba(0,212,255,0.4);
    }
    .copied-msg {
      color: #0f0;
      font-size: 0.8rem;
      margin-top: 0.5rem;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .copied-msg.show {
      opacity: 1;
    }
    .share-footer {
      margin-top: 2rem;
      padding: 1.25rem;
      background: rgba(155,89,182,0.1);
      border-radius: 8px;
      border: 1px solid rgba(155,89,182,0.3);
      text-align: center;
    }
    .share-footer h4 {
      color: #9b59b6;
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    .share-footer p {
      color: #ccc;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
    }
    .share-footer code {
      background: rgba(0,0,0,0.3);
      padding: 0.4rem 0.75rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.85rem;
      display: inline-block;
    }
    .share-footer a {
      color: #00d4ff;
      text-decoration: none;
    }
    .share-footer a:hover {
      text-decoration: underline;
    }
  </style>
  <script>
    function copyCommand() {
      const cmd = document.getElementById('open-cmd').textContent;
      navigator.clipboard.writeText(cmd).then(() => {
        const msg = document.getElementById('copied-msg');
        msg.classList.add('show');
        setTimeout(() => msg.classList.remove('show'), 2000);
      });
    }
  </script>
</head>
<body>
  <div class="container">
    <a href="/" class="back">&larr; vibelink</a>
    <div class="card">
      ${previewSrc ? `
      <div class="preview">
        <img src="${previewSrc}" alt="Preview of ${escapeHtml(metadata.name)}">
      </div>
      ` : ''}
      <div class="content">
        <h1>${escapeHtml(metadata.name)}</h1>
        ${metadata.author ? `<p class="author">by ${escapeHtml(metadata.author)}</p>` : ''}
        ${forkedFrom ? `<p class="remix-badge">🔀 Remixed from <a href="/${forkedFrom}">${forkedFrom}</a></p>` : ''}
        <p class="description">${escapeHtml(metadata.description)}</p>
        <div class="meta">
          <div class="meta-item">
            <strong>Technologies</strong>
            ${escapeHtml(technologies)}
          </div>
          <div class="meta-item">
            <strong>Created</strong>
            ${new Date(metadata.createdAt).toLocaleDateString()}
          </div>
        </div>

        <div class="open-command">
          <h4>Open in Claude Code</h4>
          <p>Copy and paste this command into Terminal:</p>
          <div class="command-box">
            <code id="open-cmd">curl -fsSL https://vibelink.to/${projectId}/open | bash</code>
            <button onclick="copyCommand()" class="copy-btn" title="Copy to clipboard">📋</button>
          </div>
          <p class="copied-msg" id="copied-msg">Copied!</p>
        </div>

        <div style="margin-top: 1rem;">
          <a href="/${projectId}/download" class="button button-secondary">Download ZIP</a>
        </div>

        <div class="install-note">
          <h4>📋 Requirements (macOS only)</h4>
          <p>This project opens in <strong>Claude Code</strong> - an AI-powered coding assistant that will help you run and explore it.</p>
          <ol>
            <li>Download <a href="https://claude.ai/download">Claude for macOS</a></li>
            <li>Open Claude and run <code>/install-claude-code</code></li>
            <li>Run the command above in Terminal</li>
          </ol>
          <p style="margin-top: 0.75rem; color: #888; font-size: 0.85rem;">
            Don't have Claude Code? The script will still download the project and guide you through installation.
            <br>Windows &amp; Linux support coming soon - for now, use "Download ZIP" instead.
          </p>
        </div>
        <div class="security-warning">
          <strong>⚠️ Security note:</strong> This project was uploaded by a community member.
          Review the code before running it. Claude Code will ask for your approval before executing commands.
        </div>
      </div>
    </div>
    <div class="share-footer">
      <h4>Want to share your own project?</h4>
      <p>Install the vibelink skill for Claude Code:</p>
      <code>curl -fsSL vibelink.to/install.sh | bash</code>
      <p style="margin-top: 0.75rem; font-size: 0.8rem; color: #888;">
        Or <a href="/skill/vibelink-push.md" download>download manually</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function notFoundPageHTML(projectId: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found - Vibelink</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; color: #00d4ff; }
    p { color: #888; margin: 1rem 0; }
    a { color: #00d4ff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Project <strong>${escapeHtml(projectId)}</strong> not found</p>
    <p><a href="/">Back to vibelink</a></p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateLauncherScript(projectId: string, projectName: string): string {
  return `#!/bin/bash
# =============================================================================
# ${projectName}
# Downloaded from vibelink.to/${projectId}
# =============================================================================

set -e

echo ""
echo "🚀 Opening ${projectName} in Claude Code..."
echo ""

# Setup
VIBELINKS_DIR="$HOME/vibelinks"
PROJECT_DIR="$VIBELINKS_DIR/${projectId}"
ZIP_URL="https://vibelink.to/${projectId}/download"

# Create directory
mkdir -p "$VIBELINKS_DIR"

# Download
echo "📦 Downloading project..."
curl -fsSL "$ZIP_URL" -o "$VIBELINKS_DIR/${projectId}.zip"

# Extract
echo "📂 Extracting..."
rm -rf "$PROJECT_DIR"
unzip -q "$VIBELINKS_DIR/${projectId}.zip" -d "$PROJECT_DIR"
rm "$VIBELINKS_DIR/${projectId}.zip"

# Handle nested directory (if zip contains single folder)
CONTENTS=($PROJECT_DIR/*)
if [ \${#CONTENTS[@]} -eq 1 ] && [ -d "\${CONTENTS[0]}" ]; then
    ACTUAL_DIR="\${CONTENTS[0]}"
else
    ACTUAL_DIR="$PROJECT_DIR"
fi

# Find claude
CLAUDE_PATH=""
for path in "$HOME/.local/bin/claude" "/usr/local/bin/claude" "/opt/homebrew/bin/claude"; do
    if [ -x "$path" ]; then
        CLAUDE_PATH="$path"
        break
    fi
done

if [ -z "$CLAUDE_PATH" ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "⚠️  Claude Code is not installed"
    echo "════════════════════════════════════════════════════════════════"
    echo ""
    echo "Vibelink projects are designed to open in Claude Code, which"
    echo "provides an AI assistant to help you run and explore the project."
    echo ""
    echo "To install Claude Code:"
    echo "  1. Visit https://claude.ai/download"
    echo "  2. Download and install Claude for macOS"
    echo "  3. Open Claude and run: /install-claude-code"
    echo "  4. Then run this launcher again!"
    echo ""
    echo "────────────────────────────────────────────────────────────────"
    echo "Your project was still downloaded to:"
    echo "  $ACTUAL_DIR"
    echo ""
    echo "You can open it manually with any code editor, but you'll miss"
    echo "the AI-powered onboarding experience."
    echo "────────────────────────────────────────────────────────────────"
    echo ""
    # Open the folder in Finder so they can still access it
    open "$ACTUAL_DIR"
    # Also open the download page in browser
    open "https://claude.ai/download"
    exit 0
fi

echo ""
echo "✅ Opening in Claude Code..."
echo ""

cd "$ACTUAL_DIR"

# Launch Claude with an initial prompt to onboard the user
exec "$CLAUDE_PATH" "Hey! I just downloaded this project from vibelink. Can you:
1. Tell me what this project is and what it does
2. Install any dependencies needed
3. Start the dev server or run it
4. Give me a quick tour of the key files

Let's go!"
`;
}

function generateOpenScript(projectId: string, projectName: string): string {
  // Same as launcher script but formatted for curl | bash
  return generateLauncherScript(projectId, projectName);
}
