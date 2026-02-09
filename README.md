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
# Web chat UI
npm start
# Open http://localhost:3000

# CLI chat
npm run chat

# Run all demo examples
npm run dev
```

## Usage

### Basic Integration

```javascript
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createTapesFetch } from './tapes-fetch.js';

// Create Tapes-wrapped fetch
const tapesFetch = createTapesFetch({
  proxyUrl: 'http://localhost:8080',
  headers: {
    'X-Tapes-Session': 'my-session-id', // Optional: track sessions
  },
});

// Create provider with custom fetch
const openai = createOpenAI({
  fetch: tapesFetch,
  apiKey: process.env.OPENAI_API_KEY,
});

// Use normally - requests are now recorded by Tapes!
const { text } = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Hello, world!',
});
```

### With Anthropic

```javascript
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  fetch: tapesFetch,
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-5-20250929'),
  prompt: 'Hello!',
});
```

### Web Chat UI

The `npm start` command launches an Express server with a browser-based chat interface at `http://localhost:3000`. It uses `generateText` to send requests through the Tapes proxy and renders responses in a dark-themed chat UI with session tracking and conversation clearing.

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

- `server.js` - Express web server with `/api/chat` endpoint
- `public/index.html` - Browser chat UI
- `tapes-fetch.js` - Custom fetch wrapper for Tapes proxy
- `index.js` - Example usage (generateText, streamText, multi-turn)
- `chat.js` - Interactive CLI chat

## License

MIT
