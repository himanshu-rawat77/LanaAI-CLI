import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { loadConfig, saveConfig, getConfigPath } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'logout',
    description: 'Log out and remove saved API credentials from this machine',
  },
  async run() {
    const config = loadConfig();
    if (!config.apiKey) {
      consola.info('No saved API key was found on this system.');
      return;
    }

    saveConfig({ apiKey: undefined });
    consola.success(`Logged out successfully. API key removed from ${pc.bold(getConfigPath())}`);
    console.log(pc.dim('You will be prompted to enter your API key on your next command.\n'));
  },
});
