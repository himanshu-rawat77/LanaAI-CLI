import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import {
  saveConfig,
  getConfigPath,
  askQuestion,
  askMasked,
  openBrowser,
} from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'login',
    description: 'Authenticate and save your Helius / Lana API key',
  },
  args: {
    key: {
      type: 'string',
      description: 'API key to save directly',
      alias: ['k', 'apiKey'],
    },
  },
  async run({ args }) {
    console.log(pc.bold(pc.cyan('\n🔑 LANA AI // AUTHENTICATION SETUP\n')));

    let apiKey = args.key?.trim();

    if (!apiKey) {
      console.log(`  ${pc.cyan('[1]')} Enter existing API key`);
      console.log(`  ${pc.cyan('[2]')} Open browser to get free key from helius.dev\n`);

      const choice = await askQuestion(`${pc.bold(pc.cyan('› Select an option [1-2] (default: 1):'))} `);
      if (choice.trim() === '2') {
        console.log(pc.dim('\nOpening https://helius.dev in your browser...'));
        openBrowser('https://helius.dev');
        console.log(pc.dim('Log in, create an API key, and paste it below.\n'));
      }

      apiKey = await askMasked(`${pc.bold(pc.cyan('› Paste API Key:'))} `);
    }

    if (!apiKey) {
      consola.warn('No API key provided. Operation cancelled.');
      return;
    }

    // Accept key directly — no remote validation (beta key support)
    saveConfig({ apiKey });
    consola.success(`API key securely stored in ${pc.bold(getConfigPath())}`);
    console.log(pc.dim('You can now run any lana command with live Solana data.\n'));
  },
});
