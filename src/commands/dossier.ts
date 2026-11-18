import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderDossier } from '../utils/output.js';
import { isValidSolanaAddress } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'dossier',
    description: 'Full investigative "case file" forensic report with On-Chain Noir narrative & entity graphs',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Solana wallet address under investigation',
      required: false,
    },
    address: {
      type: 'string',
      description: 'Target wallet address (flag alternative)',
      alias: ['a'],
    },
    json: {
      type: 'boolean',
      description: 'Output raw JSON dossier structure',
      default: false,
    },
    markdown: {
      type: 'boolean',
      description: 'Output report in GitHub-flavored Markdown',
      default: false,
      alias: ['md'],
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode (suppress investigative banners)',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose telemetry logs',
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

    if (!address) {
      consola.error('Error: Please provide a target address for the dossier.');
      consola.info('Usage: lana dossier <address> or lana dossier --address <address>');
      process.exit(1);
    }

    if (!isValidSolanaAddress(address)) {
      consola.warn(`Warning: '${address}' does not match standard Solana address format.`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json && !args.markdown) {
        consola.start(`Compiling comprehensive case dossier for subject ${pc.cyan(address)}...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      const dossier = await client.dossier(address);

      if (!args.quiet && !args.json && !args.markdown) {
        consola.success('Dossier compiled.\n');
      }

      renderDossier(dossier, args.json, args.markdown);
    } catch (err: any) {
      consola.error(`Failed to compile dossier: ${err.message || err}`);
      process.exit(1);
    }
  },
});
