import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import {
  loadConfig,
  saveConfig,
  resetConfig,
  getConfigPath,
  getWatchlistPath,
} from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'config',
    description: 'Manage Lana CLI settings, API keys, and endpoint preferences',
  },
  args: {
    action: {
      type: 'positional',
      description: 'Config action: get | set | reset | path',
      required: false,
    },
    key: {
      type: 'string',
      description: 'Set your Helius / Lana AI API key',
      alias: ['apiKey', 'k'],
    },
    endpoint: {
      type: 'string',
      description: 'Set custom API endpoint URL',
    },
    allowCustomHost: {
      type: 'boolean',
      description: 'Allow sending API credentials to custom endpoint hosts',
    },
    format: {
      type: 'string',
      description: 'Set default output format (table | json | md | csv)',
    },
    json: {
      type: 'boolean',
      description: 'Print config in JSON format',
      default: false,
    },
  },
  async run({ args }) {
    const action = (args.action || (args as any)._?.[0] || 'get').toLowerCase();

    if (action === 'reset' || action === 'clear') {
      const ok = resetConfig();
      if (ok) {
        consola.success('Lana configuration file deleted and reset successfully.');
      } else {
        consola.info('No configuration file found to reset.');
      }
      return;
    }

    if (action === 'path') {
      console.log(`${pc.bold('Config File:   ')} ${getConfigPath()}`);
      console.log(`${pc.bold('Watchlist File:')} ${getWatchlistPath()}`);
      return;
    }

    if (action === 'set') {
      const updates: Record<string, any> = {};
      if (args.key) {
        // Accept key directly — no remote validation (beta key support)
        updates.apiKey = args.key;
      }
      if (args.endpoint) updates.endpoint = args.endpoint;
      if (args.format) updates.defaultFormat = args.format;
      if (args.allowCustomHost !== undefined) updates.allowCustomHost = Boolean(args.allowCustomHost);

      if (Object.keys(updates).length === 0) {
        consola.warn('No configuration parameters specified to set.');
        consola.info('Usage: lana config set --key <NEW_API_KEY>');
        return;
      }

      const updated = saveConfig(updates);
      consola.success('Lana configuration updated successfully.');
      if (args.key) {
        consola.info(`API Key set: ${pc.cyan(args.key.slice(0, 4) + '...' + args.key.slice(-4))}`);
      }
      if (args.json) {
        console.log(JSON.stringify(updated, null, 2));
      }
      return;
    }

    // Default: 'get'
    const config = loadConfig();
    const activeKey =
      process.env.LANA_API_KEY ||
      process.env.HELIUS_API_KEY ||
      config.apiKey;

    if (args.json) {
      console.log(JSON.stringify({ ...config, activeApiKeySet: Boolean(activeKey) }, null, 2));
      return;
    }

    console.log(pc.bold(pc.cyan('\n⚙️  Lana CLI Active Configuration:')));
    console.log(`  Config Path:    ${pc.dim(getConfigPath())}`);
    console.log(
      `  API Key:        ${
        activeKey
          ? pc.green(`Configured (${activeKey.slice(0, 4)}...${activeKey.slice(-4)})`)
          : pc.yellow('Not set (run `lana login` to configure)')
      }`
    );
    console.log(`  Default Format: ${pc.white(config.defaultFormat || 'table')}`);
    const activeEndpoint = process.env.LANA_API_URL || config.endpoint || 'https://beta.helius-rpc.com/v1/lana/messages';
    console.log(`  API Endpoint:   ${pc.dim(activeEndpoint)}${process.env.LANA_API_URL ? pc.cyan(' (via LANA_API_URL)') : ''}`);
    console.log(`  Custom Host Opt-in: ${config.allowCustomHost ? pc.green('Enabled') : pc.dim('Disabled')}\n`);
    console.log(pc.dim('Config commands:'));
    console.log(`  ${pc.cyan('lana config get')}              ${pc.dim('View active configuration status')}`);
    console.log(`  ${pc.cyan('lana config set --key <KEY>')}  ${pc.dim('Update or change API key')}`);
    console.log(`  ${pc.cyan('lana config reset')}            ${pc.dim('Reset / delete local config (re-triggers onboarding)')}`);
    console.log(`  ${pc.cyan('lana config path')}             ${pc.dim('Show config and watchlist file paths')}\n`);
  },
});
