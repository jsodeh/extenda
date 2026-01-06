# Extenda - AI Executive Assistant

An AI-powered Chrome extension that automates workflows across 14+ integrations with 219 available tools.

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
