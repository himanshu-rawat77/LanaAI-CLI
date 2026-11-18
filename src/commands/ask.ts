import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderAsk } from '../utils/output.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'ask',
    description: 'Natural language Solana intelligence queries with conversational session memory',
  },
  args: {
    query: {
      type: 'positional',
      description: 'Your question or intelligence prompt for Lana AI',
      required: false,
    },
    question: {
      type: 'string',
      description: 'Your question (flag alternative)',
      alias: ['q'],
    },
    session: {
      type: 'string',
      description: 'Session identifier to maintain multi-turn conversational context',
      alias: ['s'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON response',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode without headers',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'API key for Lana / Helius',
    },
    allowCustomHost: {
      type: 'boolean',
      description: 'Allow sending credentials to a custom/untrusted endpoint',
      default: false,
    },
  },
  async run({ args }) {
    const question = (
      args.question ||
      args.query ||
      ((args as any)._ && (args as any)._.length > 0 ? (args as any)._.join(' ') : '')
    ).trim();

    if (!question) {
      consola.error('Error: Please provide a question for Lana AI.');
      consola.info('Usage: lana ask "Explain the recent volume spike on Pump.fun"');
      consola.info('Multi-turn: lana ask "Follow up on that" --session research-1');
      process.exit(1);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Querying Helius Lana AI${args.session ? ` [Session: ${pc.yellow(args.session)}]` : ''}...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      const response = await client.ask(question, args.session);

      if (!args.quiet && !args.json) {
        consola.success('Response received.\n');
      }

      renderAsk(response, args.json);
    } catch (err: any) {
      consola.error(`Lana AI query failed: ${err.message || err}`);
      process.exit(1);
    }
  },
});
