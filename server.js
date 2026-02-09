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
import { createSessionModel, config } from './tapes/ai.js';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;

// Per-session conversation storage (keyed by session ID)
const sessions = new Map();

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
    const model = createSessionModel(sessionId);
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
  console.log(`  Provider: ${config.provider}`);
  console.log(`  Model:    ${config.model}`);
  console.log(`  Proxy:    ${config.proxyUrl}\n`);
});
