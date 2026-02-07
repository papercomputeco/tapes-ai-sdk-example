/**
 * Tapes + Vercel AI SDK Integration Example
 * 
 * This demonstrates routing AI SDK requests through a Tapes proxy
 * for observability and recording.
 * 
 * Prerequisites:
 *   1. Start Tapes: `tapes serve`
 *   2. Set your API key: `export OPENAI_API_KEY=...` or `export ANTHROPIC_API_KEY=...`
 *   3. Run: `npm run dev`
 */

import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createTapesFetch } from './tapes-fetch.js';

// Configuration
const TAPES_PROXY_URL = process.env.TAPES_PROXY_URL || 'http://localhost:8080';
const PROVIDER = process.env.PROVIDER || 'openai'; // 'openai' or 'anthropic'
const DEBUG = process.env.DEBUG === 'true';

// Create the Tapes-wrapped fetch
const tapesFetch = createTapesFetch({
  proxyUrl: TAPES_PROXY_URL,
  debug: DEBUG,
  headers: {
    // Optional: Add session/trace identifiers
    'X-Tapes-Session': `demo-${Date.now()}`,
  },
});

// Create provider with custom fetch
function createProvider() {
  if (PROVIDER === 'anthropic') {
    return createAnthropic({
      fetch: tapesFetch,
      // The API key is still sent to the proxy, which forwards to Anthropic
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  
  // Default to OpenAI
  return createOpenAI({
    fetch: tapesFetch,
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Example 1: Simple text generation
async function exampleGenerateText() {
  console.log('\n📝 Example 1: generateText()\n');
  
  const provider = createProvider();
  const model = PROVIDER === 'anthropic' 
    ? provider('claude-sonnet-4-5-20250929')
    : provider('gpt-4o-mini');

  const { text, usage } = await generateText({
    model,
    prompt: 'Explain what content-addressable storage is in one sentence.',
  });
  
  console.log('Response:', text);
  console.log('Usage:', usage);
}

// Example 2: Streaming response
async function exampleStreamText() {
  console.log('\n🌊 Example 2: streamText()\n');
  
  const provider = createProvider();
  const model = PROVIDER === 'anthropic'
    ? provider('claude-sonnet-4-5-20250929')
    : provider('gpt-4o-mini');

  const result = streamText({
    model,
    prompt: 'Write a haiku about debugging code.',
  });
  
  process.stdout.write('Response: ');
  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');
  
  // Get final usage after stream completes
  const usage = await result.usage;
  console.log('Usage:', usage);
}

// Example 3: Multi-turn conversation
async function exampleConversation() {
  console.log('\n💬 Example 3: Multi-turn conversation\n');
  
  const provider = createProvider();
  const model = PROVIDER === 'anthropic'
    ? provider('claude-sonnet-4-5-20250929')
    : provider('gpt-4o-mini');

  const messages = [
    { role: 'user', content: 'My name is Alice.' },
  ];
  
  // First turn
  const response1 = await generateText({
    model,
    messages,
  });
  console.log('User: My name is Alice.');
  console.log('Assistant:', response1.text);
  
  // Add to conversation
  messages.push({ role: 'assistant', content: response1.text });
  messages.push({ role: 'user', content: 'What is my name?' });
  
  // Second turn
  const response2 = await generateText({
    model,
    messages,
  });
  console.log('\nUser: What is my name?');
  console.log('Assistant:', response2.text);
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     Tapes + Vercel AI SDK Integration POC              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nProxy URL: ${TAPES_PROXY_URL}`);
  console.log(`Provider: ${PROVIDER}`);
  console.log(`Debug: ${DEBUG}`);
  
  try {
    await exampleGenerateText();
    await exampleStreamText();
    await exampleConversation();
    
    console.log('\n✅ All examples completed!');
    console.log('\n📼 Check Tapes for recorded conversations:');
    console.log('   tapes search "content-addressable"');
    console.log('   tapes log\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure Tapes is running: tapes serve');
    }
    process.exit(1);
  }
}

main();
