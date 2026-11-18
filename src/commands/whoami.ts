import { defineCommand } from 'citty';
import pc from 'picocolors';
import { getApiKey, loadConfig, getConfigPath } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'whoami',
    description: 'Display current authentication and environment status',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  async run({ args }) {
    const config = loadConfig();
    const activeKey = getApiKey();
    const isLive = Boolean(activeKey);

    const maskedKey = activeKey
      ? (activeKey.length > 8 ? `${activeKey.slice(0, 4)}...${activeKey.slice(-4)}` : '••••••••')
      : 'Not configured';

    if (args.json) {
      console.log(JSON.stringify({
        authenticated: isLive,
        apiKeyPreview: activeKey ? maskedKey : null,
        configPath: getConfigPath(),
        endpoint: config.endpoint || 'https://beta.helius-rpc.com/v1/lana/messages',
      }, null, 2));
      return;
    }

    console.log(pc.bold(pc.cyan('\n🔍 LANA AI // SYSTEM STATUS\n')));
    console.log(`  ${pc.bold('Status:')}       ${isLive ? pc.green('✔ Authenticated') : pc.yellow('⚠ No API Key Configured')}`);
    console.log(`  ${pc.bold('API Key:')}      ${isLive ? pc.cyan(maskedKey) : pc.dim('Not set (run `lana login` to configure)')}`);
    console.log(`  ${pc.bold('Config File:')}  ${pc.dim(getConfigPath())}`);
    console.log(`  ${pc.bold('Endpoint:')}     ${pc.dim(config.endpoint || 'https://beta.helius-rpc.com/v1/lana/messages')}\n`);
  },
});
