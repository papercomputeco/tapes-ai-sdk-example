# Tapes + Vercel AI SDK Integration POC

A proof-of-concept showing how to integrate [Tapes](https://tapes.dev) with the [Vercel AI SDK](https://sdk.vercel.ai/) using a custom fetch wrapper.

## Overview

This integration routes AI SDK requests through a local Tapes proxy for:
- 📼 **Recording** all LLM requests/responses
- 🔍 **Searchable** conversation history
- 🔄 **Replay** and checkpointing of agent sessions
- 📊 **Observability** without modifying the AI SDK

### Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────────┐
│   AI SDK    │ ───► │ Tapes Proxy │ ───► │ LLM Provider    │
│ (your app)  │      │ (localhost) │      │ (OpenAI/Claude) │
└─────────────┘      └─────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌─────────────┐
                     │   SQLite    │
                     │  (storage)  │
                     └─────────────┘
```

## Quick Start

### 1. Install Tapes

```bash
curl -fsSL https://download.tapes.dev/install | bash
```

### 2. Start Tapes Services

```bash
# In terminal 1: Start Tapes server
tapes serve
```

### 3. Install Dependencies

```bash
cd tapes-ai-sdk-example
npm install
```

### 4. Set API Keys

```bash
# For OpenAI
export OPENAI_API_KEY=sk-...

# Or for Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
export PROVIDER=anthropic
```

### 5. Run

```bash
# Smoke test + start server (runs examples, then chat, then web UI)
npm start

# Or run individually:
npm run dev      # examples only
npm run chat     # interactive CLI chat
npm run server   # web UI only
```

## Usage

### Using the Provider Wrapper

The `tapes/ai.js` module centralizes all proxy and provider configuration:

```javascript
// Pre-configured singletons (reads env vars at import time)
import { model, config } from './tapes/ai.js';

const { text } = await generateText({
  model,
  prompt: 'Hello, world!',
});
```

### Per-Session Models

For server use where each request needs its own session tracking:

```javascript
import { createSessionModel } from './tapes/ai.js';

const model = createSessionModel('user-123-chat');
```

### Full Customization

```javascript
import { createTapesProvider } from './tapes/ai.js';

const { provider, model } = createTapesProvider({
  sessionId: 'my-session',
  provider: 'anthropic',
  model: 'claude-sonnet-4-5-20250929',
  debug: true,
});
```

### Low-Level Fetch Wrapper

For direct control, use `tapes-fetch.js` directly:

```javascript
import { createTapesFetch } from './tapes-fetch.js';
import { createOpenAI } from '@ai-sdk/openai';

const tapesFetch = createTapesFetch({
  proxyUrl: 'http://localhost:8080',
  headers: { 'X-Tapes-Session': 'my-session-id' },
});

const openai = createOpenAI({
  fetch: tapesFetch,
  apiKey: process.env.OPENAI_API_KEY,
});
```

### Web Chat UI

The `npm run server` command launches an Express server with a browser-based chat interface at `http://localhost:3000`. It uses `streamText` to stream responses in real-time through the Tapes proxy and renders them in a dark-themed chat UI with session tracking and conversation clearing.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAPES_PROXY_URL` | `http://localhost:8080` | Tapes proxy address |
| `PROVIDER` | `openai` | LLM provider (`openai` or `anthropic`) |
| `MODEL` | `gpt-4o-mini` / `claude-sonnet-4-5-20250929` | Model to use |
| `PORT` | `3000` | Web UI server port |
| `DEBUG` | `false` | Enable debug logging |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |

### Custom Headers

Add metadata to your requests for better organization:

```javascript
const tapesFetch = createTapesFetch({
  proxyUrl: 'http://localhost:8080',
  headers: {
    'X-Tapes-Session': 'user-123-chat',
    'X-Tapes-App': 'my-chatbot',
    'X-Tapes-Environment': 'production',
  },
});
```

## Querying Recorded Data

After running conversations through Tapes:

```bash
# Search conversations
tapes search "your query"

# View recent activity
tapes log

# Checkout a previous state
tapes checkout <hash>
```

## Files

- `tapes/ai.js` - Pre-configured provider wrapper (main entry point)
- `tapes-fetch.js` - Low-level custom fetch wrapper for Tapes proxy
- `index.js` - Example usage (generateText, streamText, multi-turn conversation)
- `chat.js` - Interactive CLI chat
- `server.js` - Express web server with chat UI
- `public/index.html` - Web chat interface

## License

MIT
