/**
 * Interactive Chat with Tapes Recording
 * 
 * A simple CLI chat that routes through Tapes for recording.
 * 
 * Usage:
 *   1. Start Tapes: `tapes serve`
 *   2. Run: `npm run chat`
 */

import * as readline from 'readline';
import { streamText } from 'ai';
import { createTapesProvider, config } from './tapes/ai.js';

const SESSION_ID = `chat-${Date.now()}`;
const { model } = createTapesProvider({ sessionId: SESSION_ID });
const messages = [];

// CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║          Tapes Chat (AI SDK Integration)               ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log(`\n📼 Session: ${SESSION_ID}`);
console.log(`🤖 Model: ${config.model}`);
console.log(`🔗 Proxy: ${config.proxyUrl}`);
console.log('\nType your message (or "exit" to quit, "clear" to reset)\n');

async function chat(userInput) {
  messages.push({ role: 'user', content: userInput });
  
  process.stdout.write('\n🤖 ');
  
  try {
    const result = streamText({
      model,
      messages,
      system: 'You are a helpful assistant. Be concise.',
    });
    
    let fullResponse = '';
    for await (const chunk of result.textStream) {
      process.stdout.write(chunk);
      fullResponse += chunk;
    }
    
    messages.push({ role: 'assistant', content: fullResponse });
    console.log('\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Make sure Tapes is running: tapes serve\n');
    }
    // Remove failed user message
    messages.pop();
  }
}

function prompt() {
  rl.question('You: ', async (input) => {
    const trimmed = input.trim();
    
    if (trimmed.toLowerCase() === 'exit') {
      console.log('\n📼 Chat recorded! Search with: tapes search "<query>"');
      console.log(`   Session ID: ${SESSION_ID}\n`);
      rl.close();
      return;
    }
    
    if (trimmed.toLowerCase() === 'clear') {
      messages.length = 0;
      console.log('\n🗑️  Conversation cleared.\n');
      prompt();
      return;
    }
    
    if (!trimmed) {
      prompt();
      return;
    }
    
    await chat(trimmed);
    prompt();
  });
}

prompt();
