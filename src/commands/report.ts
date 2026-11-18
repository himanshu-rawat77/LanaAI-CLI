import fs from 'node:fs';
import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import {
  renderLookup,
  printJson,
  formatDossierMarkdown,
  exportToCsv,
} from '../utils/output.js';
import { isValidSolanaAddress } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'report',
    description: 'Generate an exportable research report for a Solana address (formats: table, json, csv, md)',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Target Solana address for report generation',
      required: false,
    },
    address: {
      type: 'string',
      description: 'Target address (flag alternative)',
      alias: ['a'],
    },
    format: {
      type: 'string',
      description: 'Output format: table | json | csv | md',
      default: 'table',
      alias: ['f'],
    },
    out: {
      type: 'string',
      description: 'File path to save the generated report',
      alias: ['o'],
    },
    quiet: {
      type: 'boolean',
      description: 'Suppress informational logs',
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
    const format = (args.format || 'table').toLowerCase();

    if (!address) {
      consola.error('Error: Please provide a target Solana address.');
      consola.info('Usage: lana report <address> [--format json|csv|md|table] [--out <file>]');
      process.exit(1);
    }

    if (!isValidSolanaAddress(address)) {
      consola.warn(`Warning: '${address}' does not match standard Solana address length.`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet) {
        consola.start(`Generating research report for ${pc.cyan(address)} [Format: ${pc.yellow(format)}]...`);
      }

      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      const profile = await client.lookup(address);
      let outputContent = '';

      if (format === 'json') {
        outputContent = JSON.stringify(profile, null, 2);
      } else if (format === 'csv') {
        outputContent = exportToCsv(profile);
      } else if (format === 'md' || format === 'markdown') {
        const dossier = await client.dossier(address);
        outputContent = formatDossierMarkdown(dossier);
      }

      if (args.out) {
        fs.writeFileSync(args.out, outputContent || JSON.stringify(profile, null, 2), 'utf-8');
        consola.success(`Report written to ${pc.green(args.out)}`);
        return;
      }

      if (!args.quiet) {
        consola.success('Report ready.\n');
      }

      if (format === 'json') {
        console.log(outputContent);
      } else if (format === 'csv') {
        console.log(outputContent);
      } else if (format === 'md' || format === 'markdown') {
        console.log(outputContent);
      } else {
        renderLookup(profile, false);
      }
    } catch (err: any) {
      consola.error(`Failed to generate report: ${err.message || err}`);
      process.exit(1);
    }
  },
});
