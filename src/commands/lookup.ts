import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { renderLookup } from '../utils/output.js';
import { isValidSolanaAddress } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'lookup',
    description: 'Truecaller-style wallet profile: risk score, labels, counterparties, and fund origin',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Solana wallet address to inspect',
      required: false,
    },
    address: {
      type: 'string',
      description: 'Solana wallet address (flag alternative)',
      alias: ['a'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON for scripting and piping',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode (suppress spinners and headers)',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose API request/response logging',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'API key for Lana / Helius',
    },
  },
  async run({ args }) {
    const address = (args.target || args.address || (args as any)._?.[0] || '').trim();

    if (!address) {
      consola.error('Error: Please provide a Solana address.');
      consola.info('Usage: lana lookup <address> or lana lookup --address <address>');
      process.exit(1);
    }

    if (!isValidSolanaAddress(address)) {
      consola.warn(`Warning: '${address}' does not look like a standard Base58 Solana public key (32-44 chars).`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Interrogating on-chain profile for ${pc.cyan(address)}...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
      });

      const profile = await client.lookup(address);

      if (!args.quiet && !args.json) {
        consola.success('Profile retrieved successfully.\n');
      }

      renderLookup(profile, args.json);
    } catch (err: any) {
      consola.error(`Failed to lookup address: ${err.message || err}`);
      process.exit(1);
    }
  },
});
