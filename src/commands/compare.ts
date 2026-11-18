import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderCompare } from '../utils/output.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'compare',
    description: 'Side-by-side comparison of multiple wallets (overlaps, similarity, counterparties)',
  },
  args: {
    address1: {
      type: 'positional',
      description: 'First Solana wallet address',
      required: false,
    },
    address2: {
      type: 'positional',
      description: 'Second Solana wallet address',
      required: false,
    },
    json: {
      type: 'boolean',
      description: 'Output comparison data as pure JSON',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress status messages',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose output',
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
    const rawArgs: string[] = [args.address1, args.address2, ...((args as any)._ || [])].filter(
      Boolean
    ) as string[];

    const addresses = Array.from(new Set(rawArgs.map(a => a.trim()))).filter(a => a.length > 0);

    if (addresses.length < 2) {
      consola.error('Error: Please provide at least 2 wallet addresses to compare.');
      consola.info('Usage: lana compare <address1> <address2> [address3...]');
      process.exit(1);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Comparing ${addresses.length} Solana wallets for behavioral congruence...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      const comparison = await client.compare(addresses);

      if (!args.quiet && !args.json) {
        consola.success('Forensic comparison completed.\n');
      }

      renderCompare(comparison, args.json);
    } catch (err: any) {
      consola.error(`Comparison failed: ${err.message || err}`);
      process.exit(1);
    }
  },
});
