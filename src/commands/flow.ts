import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderFlow } from '../utils/output.js';
import { isValidSolanaAddress } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'flow',
    description: 'Multi-hop fund flow summary and hierarchical visual graph (default depth: 2)',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Target Solana wallet address',
      required: false,
    },
    address: {
      type: 'string',
      description: 'Target address (flag alternative)',
      alias: ['a'],
    },
    depth: {
      type: 'string',
      description: 'Hop depth for graph traversal (1-5, default: 2)',
      default: '2',
      alias: ['d'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON tree structure',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode without spinners',
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
    const address = (args.target || args.address || (args as any)._?.[0] || '').trim();
    const depthNum = Math.max(1, Math.min(5, parseInt(args.depth || '2', 10) || 2));

    if (!address) {
      consola.error('Error: Please provide a target Solana address.');
      consola.info('Usage: lana flow <address> [--depth <n>]');
      process.exit(1);
    }

    if (!isValidSolanaAddress(address)) {
      consola.warn(`Warning: '${address}' does not match standard Solana address length.`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Tracing multi-hop fund flow for ${pc.cyan(address)} (depth: ${depthNum})...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      const flow = await client.flow(address, depthNum);

      if (!args.quiet && !args.json) {
        consola.success('Fund flow graph constructed.\n');
      }

      renderFlow(flow, args.json);
    } catch (err: any) {
      consola.error(`Failed to trace fund flows: ${err.message || err}`);
      process.exit(1);
    }
  },
});
