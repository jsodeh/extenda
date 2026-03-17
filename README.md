# Extenda - AI Browser Agent

An AI-powered browser agent that automates workflows across 14+ integrations with 219 available tools.

## Features

- **219 AI Tools**: 6 base tools + 213 adapter actions across Gmail, Calendar, Slack, Jira, and more
- **Advanced Workflows**: Step dependencies, parallel execution, conditional logic, result injection
- **Workflow Templates**: Pre-built automation for common tasks
- **OAuth Integration**: Secure authentication for 11 providers with AES-256-GCM encryption
- **Smart UI**: Onboarding wizard, approval gates, settings management, history tracking
- **Customization**: Prompt engineering, BYOM (Bring Your Own Model), preferences

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Google Cloud project (for Gemini API)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/extenda.git
cd extenda

# Install dependencies
pnpm install

# Setup environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env with your credentials

# Run migrations
cd apps/api
pnpm run migrate

# Start development servers
cd ../..
pnpm dev
```

### Load Extension

1. Build extension: `pnpm run build --filter extension`
2. Open Chrome → Extensions → Enable Developer Mode
3. Click "Load unpacked" → Select `apps/extension/dist`

## Architecture

```
Extenda/
├── apps/
│   ├── api/          # Hono API server
│   │   ├── adapters/    # 14 OAuth adapters
│   │   ├── services/    # Orchestrator, OAuth manager
│   │   ├── tools/       # Tool registry
│   │   └── routes/      # API endpoints
│   └── extension/    # Chrome extension
│       ├── components/  # React components
│       ├── pages/       # UI pages
│       └── content/     # Content scripts
└── packages/
    └── shared/       # Shared types
```

## Usage

### Basic Workflow

1. Open extension side panel
2. Type intent: "Summarize my last 5 emails"
3. AI creates workflow plan
4. Review and approve
5. Workflow executes automatically

### Using Templates

1. Navigate to Templates page
2. Select template (e.g., "Email Summary")
3. Fill parameters
4. Click "Create Workflow"

### Custom Workflows

Create workflows with dependencies:

```json
{
  "steps": [
    {
      "id": "fetch",
      "tool": "GmailScraper",
      "params": {"limit": 10}
    },
    {
      "id": "summarize",
      "tool": "AIProcessor",
      "params": {"content": "${fetch.result}"},
      "dependencies": ["fetch"]
    }
  ]
}
```

## Configuration

### OAuth Setup

1. Create OAuth apps for each provider
2. Add credentials to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback/google
   ```

### AI Model

Configure AI provider in Settings → AI Model:
- Provider: Google Gemini / OpenAI / Anthropic
- Model: gemini-pro / gpt-4 / claude-3
- API Key: Your key

## Development

### Running Tests

```bash
# Extension tests
cd apps/extension
pnpm test

# API tests  
cd apps/api
pnpm test
```

### Building

```bash
# Build all
pnpm run build

# Build specific package
pnpm run build --filter api
pnpm run build --filter extension
```

## Production Deployment

This section covers deploying Extenda API to Google Cloud Run with Cloud SQL.

### Prerequisites

1. **Google Cloud CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Required APIs enabled**:
   ```bash
   gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com
   ```

### Step 1: Create Cloud SQL Instance

```bash
# Create PostgreSQL instance
gcloud sql instances create extenda \
  --database-version=POSTGRES_17 \
  --tier=db-f1-micro \
  --region=us-central1

# Set postgres user password
gcloud sql users set-password postgres \
  --instance=extenda \
  --password='YOUR_SECURE_PASSWORD'

# Create database
gcloud sql databases create extenda --instance=extenda
```

### Step 2: Configure OAuth in Google Cloud Console

1. Go to [APIs & Credentials](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add **Authorized redirect URIs**:
   ```
   https://YOUR-SERVICE-URL.run.app/oauth/callback/google
   https://YOUR-SERVICE-URL.run.app/oauth/auth/callback/google
   ```
4. Note down `Client ID` and `Client Secret`

### Step 3: Deploy to Cloud Run

Deploy from the **monorepo root** (uses the Dockerfile):

```bash
# Initial deployment (from project root)
gcloud run deploy extenda-api \
  --source=. \
  --region=us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances="YOUR_PROJECT_ID:us-central1:extenda" \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=postgres://postgres:YOUR_PASSWORD@/extenda?host=/cloudsql/YOUR_PROJECT_ID:us-central1:extenda" \
  --set-env-vars="JWT_SECRET=YOUR_64_CHAR_HEX_SECRET" \
  --set-env-vars="ENCRYPTION_KEY=YOUR_64_CHAR_HEX_KEY" \
  --set-env-vars="GEMINI_API_KEY=YOUR_GEMINI_KEY" \
  --set-env-vars="GOOGLE_CLIENT_ID=YOUR_OAUTH_CLIENT_ID" \
  --set-env-vars="GOOGLE_CLIENT_SECRET=YOUR_OAUTH_SECRET" \
  --set-env-vars="GOOGLE_REDIRECT_URI=https://YOUR-SERVICE-URL.run.app/oauth/callback/google" \
  --set-env-vars="GOOGLE_AUTH_REDIRECT_URI=https://YOUR-SERVICE-URL.run.app/oauth/auth/callback/google"
```

After first deployment, note the Service URL and update redirect URIs:
1. Update Google Cloud Console OAuth redirect URIs with actual service URL
2. Re-deploy or update env vars:
   ```bash
   gcloud run services update extenda-api --region=us-central1 \
     --update-env-vars="GOOGLE_REDIRECT_URI=https://extenda-api-XXXXX.us-central1.run.app/oauth/callback/google" \
     --update-env-vars="GOOGLE_AUTH_REDIRECT_URI=https://extenda-api-XXXXX.us-central1.run.app/oauth/auth/callback/google"
   ```

### Step 4: Update Extension for Production

Update the WebSocket URL in `apps/extension/src/lib/websocket.ts`:
```typescript
const WS_URL = 'wss://YOUR-SERVICE-URL.run.app';
```

Rebuild and reload the extension:
```bash
pnpm run build --filter extension
```

### Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | `production` or `development` | Yes |
| `DATABASE_URL` | PostgreSQL connection string (Cloud SQL socket format) | Yes |
| `JWT_SECRET` | 64-char hex for JWT signing | Yes |
| `ENCRYPTION_KEY` | 64-char hex for OAuth token encryption | Yes |
| `GEMINI_API_KEY` | Google AI API key | Yes |
| `GOOGLE_CLIENT_ID` | OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback for integrations | Yes |
| `GOOGLE_AUTH_REDIRECT_URI` | OAuth callback for login | Yes |

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Updating Deployments

**IMPORTANT**: Use `--update-env-vars` to add/modify without wiping existing vars:

```bash
# ✅ CORRECT: Adds/updates specific vars only
gcloud run services update extenda-api --region=us-central1 \
  --update-env-vars="NEW_VAR=value"

# ❌ WRONG: This wipes ALL existing env vars
gcloud run deploy extenda-api --source=. \
  --set-env-vars="ONLY_THIS_VAR=value"
```

To redeploy code without changing env vars:
```bash
gcloud run deploy extenda-api --source=. --region=us-central1
```

### Viewing Logs

```bash
# Recent logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=extenda-api' \
  --limit=50 --format="table(timestamp,textPayload)"

# Stream logs
gcloud beta run services logs tail extenda-api --region=us-central1
```

### Deployment Checklist

- [ ] Cloud SQL instance created with password set
- [ ] Database `extenda` created in Cloud SQL
- [ ] OAuth redirect URIs registered in Google Cloud Console
- [ ] All environment variables configured
- [ ] Extension WebSocket URL updated
- [ ] Extension rebuilt and reloaded

## API Reference

### Endpoints

- `GET /oauth/authorize/:provider` - Initiate OAuth
- `GET /oauth/status` - Get connected providers
- `GET /api/preferences` - Get user preferences
- `GET /api/templates` - List workflow templates
- `POST /api/templates/execute` - Execute template

### WebSocket Events

#### Client → Server
- `workflow:start` - Start workflow
- `tool:result` - Tool execution result

#### Server → Client
- `workflow:plan` - Workflow plan created
- `workflow:step_start` - Step started
- `workflow:step_complete` - Step completed
- `workflow:complete` - Workflow finished

## Troubleshooting

### Extension Won't Load
- Check manifest.json syntax
- Verify all files in dist/
- Check console for errors

### OAuth Fails
- Verify redirect URIs match
- Check OAuth consent screen settings
- Ensure credentials are correct

### Workflow Errors
- Check tool name matches registry
- Verify parameters are correct
- Check dependencies are valid

## Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request

## License

MIT License - see LICENSE file

## Support

- Documentation: [docs link]
- Issues: [GitHub Issues]
- Discord: [Discord invite]
