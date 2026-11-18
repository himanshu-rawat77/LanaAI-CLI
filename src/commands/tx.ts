import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderTx } from '../utils/output.js';
import { isValidTxSignature } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'tx',
    description: 'Plain-English breakdown of a Solana transaction + money movements',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Solana transaction signature',
      required: false,
    },
    signature: {
      type: 'string',
      description: 'Solana transaction signature (flag alternative)',
      alias: ['s', 'sig'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON for scripting',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode without decorative output',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logs',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'API key for Lana / Helius',
    },
  },
  async run({ args }) {
    const sig = (args.target || args.signature || (args as any)._?.[0] || '').trim();

    if (!sig) {
      consola.error('Error: Please provide a transaction signature.');
      consola.info('Usage: lana tx <signature> or lana tx --signature <signature>');
      process.exit(1);
    }

    if (!isValidTxSignature(sig)) {
      consola.warn(`Warning: '${sig}' does not look like a standard Solana signature format.`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Deconstructing Solana transaction ${pc.yellow(sig)}...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
      });

      const txExplainer = await client.tx(sig);

      if (!args.quiet && !args.json) {
        consola.success('Transaction parsed.\n');
      }

      renderTx(txExplainer, args.json);
    } catch (err: any) {
      consola.error(`Failed to explain transaction: ${err.message || err}`);
      process.exit(1);
    }
  },
});
