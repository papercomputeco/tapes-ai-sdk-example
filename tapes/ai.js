/**
 * Tapes AI Provider Wrapper
 *
 * Centralizes provider configuration so consumer files don't repeat
 * proxy/fetch/model boilerplate.
 *
 * Exports:
 *   createTapesProvider({ sessionId, ... }) — full customization
 *   createSessionModel(sessionId)          — quick per-request model
 *   provider / model / config              — pre-configured singletons
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createTapesFetch } from '../tapes-fetch.js';

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULTS = {
  proxyUrl: process.env.TAPES_PROXY_URL || 'http://localhost:8080',
  provider: process.env.PROVIDER || 'openai',
  model: process.env.MODEL,
  debug: process.env.DEBUG === 'true',
};

function defaultModel(providerName) {
  return DEFAULTS.model || (providerName === 'anthropic' ? 'claude-sonnet-4-5-20250929' : 'gpt-4o-mini');
}

// ── Factory: full customization ─────────────────────────────────────

/**
 * Create a Tapes-proxied provider and model.
 *
 * @param {Object} opts
 * @param {string}  [opts.sessionId]  — X-Tapes-Session header value
 * @param {string}  [opts.provider]   — 'openai' | 'anthropic' (default: env PROVIDER)
 * @param {string}  [opts.model]      — model id (default: env MODEL or provider default)
 * @param {boolean} [opts.debug]      — enable fetch debug logging
 * @param {string}  [opts.proxyUrl]   — Tapes proxy URL
 * @param {Record<string,string>} [opts.headers] — extra headers
 * @returns {{ provider: Function, model: import('ai').LanguageModel }}
 */
export function createTapesProvider(opts = {}) {
  const providerName = opts.provider ?? DEFAULTS.provider;
  const modelId = opts.model ?? defaultModel(providerName);
  const proxyUrl = opts.proxyUrl ?? DEFAULTS.proxyUrl;
  const debug = opts.debug ?? DEFAULTS.debug;

  const tapesFetch = createTapesFetch({
    proxyUrl,
    debug,
    headers: {
      ...(opts.sessionId ? { 'X-Tapes-Session': opts.sessionId } : {}),
      ...opts.headers,
    },
  });

  const aiProvider = providerName === 'anthropic'
    ? createAnthropic({ fetch: tapesFetch, apiKey: process.env.ANTHROPIC_API_KEY })
    : createOpenAI({ fetch: tapesFetch, apiKey: process.env.OPENAI_API_KEY });

  return { provider: aiProvider, model: aiProvider(modelId) };
}

// ── Factory: session-only shortcut (for server.js per-request use) ──

/**
 * Returns an AI SDK model instance configured for a specific session.
 * @param {string} sessionId
 * @returns {import('ai').LanguageModel}
 */
export function createSessionModel(sessionId) {
  return createTapesProvider({ sessionId }).model;
}

// ── Pre-configured singletons ───────────────────────────────────────

const _default = createTapesProvider({
  sessionId: `demo-${Date.now()}`,
});

/** Default provider function (based on PROVIDER env var) */
export const provider = _default.provider;

/** Default model instance (based on PROVIDER + MODEL env vars) */
export const model = _default.model;

/** Frozen config object for banner/logging */
export const config = Object.freeze({
  proxyUrl: DEFAULTS.proxyUrl,
  provider: DEFAULTS.provider,
  model: defaultModel(DEFAULTS.provider),
  debug: DEFAULTS.debug,
});
