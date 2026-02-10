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
import { model, config } from './tapes/ai.js';

// Example 1: Simple text generation
async function exampleGenerateText() {
  console.log('\n📝 Example 1: generateText()\n');

  const { text, usage } = await generateText({
    model,
    prompt: 'Explain what content-addressable storage is in one sentence.',
  });
  
  console.log('Response:', text);
  console.log('Usage:', usage);
}

// Example 2: Streaming text generation
async function exampleStreamText() {
  console.log('\n🌊 Example 2: streamText()\n');

  process.stdout.write('Response: ');
  const result = streamText({
    model,
    prompt: 'What is a merkle tree? One sentence.',
  });

  for await (const chunk of result.textStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

// Example 3: Multi-turn conversation
async function exampleConversation() {
  console.log('\n💬 Example 3: Multi-turn conversation\n');

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
  console.log(`\nProxy URL: ${config.proxyUrl}`);
  console.log(`Provider: ${config.provider}`);
  console.log(`Debug: ${config.debug}`);
  
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
