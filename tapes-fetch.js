/**
 * Tapes Proxy Fetch Wrapper
 *
 * Creates a custom fetch function that routes AI SDK requests through
 * the Tapes proxy for observability and recording.
 *
 * Usage:
 *   import { createTapesFetch } from './tapes-fetch.js';
 *
 *   const tapesFetch = createTapesFetch({
 *     proxyUrl: 'http://localhost:8080',
 *     // Optional: headers to add to all requests
 *     headers: { 'X-Tapes-Session': 'my-session-id' },
 *     // Optional: retry configuration
 *     retry: { maxAttempts: 3, initialDelayMs: 500, maxDelayMs: 5000 },
 *     // Optional: failover to direct URL when proxy is down
 *     failover: true,
 *   });
 *
 *   // Use with AI SDK provider
 *   const openai = createOpenAI({ fetch: tapesFetch });
 */

/**
 * @typedef {Object} RetryConfig
 * @property {number} [maxAttempts=3] - Maximum number of retry attempts
 * @property {number} [initialDelayMs=500] - Initial delay between retries in ms
 * @property {number} [maxDelayMs=5000] - Maximum delay between retries in ms
 */

/**
 * @typedef {Object} TapesConfig
 * @property {string} proxyUrl - The Tapes proxy URL (e.g., 'http://localhost:8080')
 * @property {Record<string, string>} [headers] - Additional headers to include
 * @property {boolean} [debug] - Enable debug logging
 * @property {RetryConfig} [retry] - Retry configuration for failed requests
 * @property {boolean} [failover] - When true, fall back to direct URL if all proxy retries fail
 */

const RETRYABLE_NETWORK_ERRORS = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'fetch failed', 'UND_ERR_CONNECT_TIMEOUT'];
const RETRYABLE_STATUS_CODES = [502, 503, 504];

/**
 * Returns whether an error is retryable (network error or server error).
 * @param {Error|null} error
 * @param {Response|null} response
 * @returns {boolean}
 */
function isRetryable(error, response) {
  if (error) {
    const message = error.message || '';
    const code = error.cause?.code || '';
    return RETRYABLE_NETWORK_ERRORS.some(e => message.includes(e) || code.includes(e));
  }
  if (response) {
    return RETRYABLE_STATUS_CODES.includes(response.status);
  }
  return false;
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a fetch function that routes requests through the Tapes proxy.
 *
 * The proxy URL replaces the base URL of the original request while
 * preserving the path and query parameters.
 *
 * @param {TapesConfig} config
 * @returns {typeof fetch}
 */
export function createTapesFetch(config) {
  const { proxyUrl, headers: extraHeaders = {}, debug = false } = config;
  const retryConfig = {
    maxAttempts: config.retry?.maxAttempts ?? 3,
    initialDelayMs: config.retry?.initialDelayMs ?? 500,
    maxDelayMs: config.retry?.maxDelayMs ?? 5000,
  };
  const failover = config.failover ?? false;

  // Normalize proxy URL (remove trailing slash)
  const normalizedProxyUrl = proxyUrl.replace(/\/$/, '');

  /**
   * Custom fetch that routes through Tapes proxy
   * @param {RequestInfo | URL} input
   * @param {RequestInit} [init]
   * @returns {Promise<Response>}
   */
  return async function tapesFetch(input, init) {
    // Parse the original URL
    const originalUrl = typeof input === 'string'
      ? new URL(input)
      : input instanceof URL
        ? input
        : new URL(input.url);

    // Build the proxied URL: proxy base + original path + query
    const proxiedUrl = new URL(
      originalUrl.pathname + originalUrl.search,
      normalizedProxyUrl
    );

    if (debug) {
      console.log(`[tapes] Proxying: ${originalUrl.href} → ${proxiedUrl.href}`);
    }

    // Merge headers
    const headers = new Headers(init?.headers);

    // Add extra headers from config
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }

    // Forward the original host as a header (useful for multi-tenant proxies)
    headers.set('X-Tapes-Original-Host', originalUrl.host);

    const requestInit = { ...init, headers };

    // Retry loop for proxy requests
    let lastError = null;
    let lastResponse = null;

    for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
      try {
        const response = await fetch(proxiedUrl.href, requestInit);

        if (isRetryable(null, response) && attempt < retryConfig.maxAttempts - 1) {
          const delay = Math.min(retryConfig.initialDelayMs * 2 ** attempt, retryConfig.maxDelayMs);
          if (debug) {
            console.log(`[tapes] Proxy returned ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`);
          }
          lastResponse = response;
          await sleep(delay);
          continue;
        }

        if (debug) {
          console.log(`[tapes] Response: ${response.status} ${response.statusText}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        if (isRetryable(error, null) && attempt < retryConfig.maxAttempts - 1) {
          const delay = Math.min(retryConfig.initialDelayMs * 2 ** attempt, retryConfig.maxDelayMs);
          if (debug) {
            console.log(`[tapes] Proxy request failed (${error.cause?.code || error.message}), retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxAttempts})`);
          }
          await sleep(delay);
          continue;
        }
      }
    }

    // All proxy retries exhausted — try failover to direct URL
    if (failover) {
      if (debug) {
        console.log(`[tapes] All proxy retries failed, failing over to direct: ${originalUrl.href}`);
      }
      try {
        const directHeaders = new Headers(init?.headers);
        // Don't add proxy-specific headers for direct requests
        const response = await fetch(originalUrl.href, { ...init, headers: directHeaders });
        if (debug) {
          console.log(`[tapes] Failover response: ${response.status} ${response.statusText}`);
        }
        return response;
      } catch (failoverError) {
        if (debug) {
          console.log(`[tapes] Failover also failed: ${failoverError.cause?.code || failoverError.message}`);
        }
        throw failoverError;
      }
    }

    // No failover — throw the last error or return the last bad response
    if (lastError) throw lastError;
    return lastResponse;
  };
}

/**
 * Creates a fetch function for a specific provider through Tapes.
 * This is a convenience wrapper that sets up the proxy for common providers.
 *
 * @param {'openai' | 'anthropic' | 'ollama'} provider
 * @param {Omit<TapesConfig, 'proxyUrl'> & { tapesUrl?: string }} config
 * @returns {typeof fetch}
 */
export function createProviderFetch(provider, config = {}) {
  const tapesUrl = config.tapesUrl || 'http://localhost:8080';

  return createTapesFetch({
    proxyUrl: tapesUrl,
    headers: {
      'X-Tapes-Provider': provider,
      ...config.headers,
    },
    debug: config.debug,
    retry: config.retry,
    failover: config.failover,
  });
}

export default createTapesFetch;
