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
 *     headers: { 'X-Tapes-Session': 'my-session-id' }
 *   });
 *   
 *   // Use with AI SDK provider
 *   const openai = createOpenAI({ fetch: tapesFetch });
 */

/**
 * @typedef {Object} TapesConfig
 * @property {string} proxyUrl - The Tapes proxy URL (e.g., 'http://localhost:8080')
 * @property {Record<string, string>} [headers] - Additional headers to include
 * @property {boolean} [debug] - Enable debug logging
 */

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
    
    // Make the request through the proxy
    const response = await fetch(proxiedUrl.href, {
      ...init,
      headers,
    });
    
    if (debug) {
      console.log(`[tapes] Response: ${response.status} ${response.statusText}`);
    }

    return response;
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
  });
}

export default createTapesFetch;
