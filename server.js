/**
 * Web Chat Server for Tapes + Vercel AI SDK
 *
 * Serves a chat UI and streams AI responses through the Tapes proxy.
 *
 * Usage:
 *   1. Start Tapes: `tapes serve --provider anthropic --upstream https://api.anthropic.com`
 *   2. Run: `ANTHROPIC_API_KEY=... PROVIDER=anthropic npm start`
 *   3. Open http://localhost:3000
 */

import express from 'express';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createTapesFetch } from './tapes-fetch.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
const TAPES_PROXY_URL = process.env.TAPES_PROXY_URL || 'http://localhost:8080';
const PROVIDER = process.env.PROVIDER || 'openai';
const MODEL = process.env.MODEL || (PROVIDER === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o-mini');

// Per-session conversation storage (keyed by session ID)
const sessions = new Map();

function createModel(sessionId) {
  const tapesFetch = createTapesFetch({
    proxyUrl: TAPES_PROXY_URL,
    headers: { 'X-Tapes-Session': sessionId },
  });

  const provider = PROVIDER === 'anthropic'
    ? createAnthropic({ fetch: tapesFetch, apiKey: process.env.ANTHROPIC_API_KEY })
    : createOpenAI({ fetch: tapesFetch, apiKey: process.env.OPENAI_API_KEY });

  return provider(MODEL);
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/chat — streaming chat endpoint
app.post('/api/chat', async (req, res) => {
  const { sessionId } = req.body;
  const message = (req.body.message || '').trim();

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'message and sessionId are required' });
  }

  // Get or create session messages
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  const messages = sessions.get(sessionId);
  messages.push({ role: 'user', content: message });

  try {
    const model = createModel(sessionId);
    const { text } = await generateText({
      model,
      messages,
      system: 'You are a helpful assistant. Be concise.',
    });

    if (text) {
      messages.push({ role: 'assistant', content: text });
    } else {
      messages.pop();
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(text);
  } catch (error) {
    console.error('Chat error:', error.message);
    // Remove the failed user message
    messages.pop();
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.end();
    }
  }
});

// DELETE /api/chat — clear session
app.delete('/api/chat', (req, res) => {
  const { sessionId } = req.body;
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  Tapes Chat UI`);
  console.log(`  ─────────────────────────`);
  console.log(`  URL:      http://localhost:${PORT}`);
  console.log(`  Provider: ${PROVIDER}`);
  console.log(`  Model:    ${MODEL}`);
  console.log(`  Proxy:    ${TAPES_PROXY_URL}\n`);
});
