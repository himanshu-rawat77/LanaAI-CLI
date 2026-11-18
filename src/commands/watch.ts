import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../utils/config.js';
import { renderWatchlist } from '../utils/output.js';
import { isValidSolanaAddress } from '../utils/format.js';

export default defineCommand({
  meta: {
    name: 'watch',
    description: 'Local target watchlist management (saved in ~/.config/lana/watchlist.json)',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Solana wallet address',
      required: false,
    },
    add: {
      type: 'boolean',
      description: 'Add the target address to watchlist',
      default: false,
    },
    remove: {
      type: 'boolean',
      description: 'Remove address from watchlist',
      alias: ['rm', 'delete'],
      default: false,
    },
    list: {
      type: 'boolean',
      description: 'List all tracked targets',
      alias: ['ls'],
      default: false,
    },
    label: {
      type: 'string',
      description: 'Human-readable label / name for target',
      alias: ['l'],
    },
    tag: {
      type: 'string',
      description: 'Comma-separated tags (e.g. "whale,sniper,mev")',
      alias: ['t'],
    },
    notes: {
      type: 'string',
      description: 'Investigative notes for this subject',
      alias: ['n'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON format',
      default: false,
    },
  },
  async run({ args }) {
    const rawPositional = (args.target || (args as any)._?.[0] || '').trim();

    // Check if user requested listing
    if (args.list || (!args.add && !args.remove && !rawPositional)) {
      const items = loadWatchlist();
      renderWatchlist(items, args.json);
      return;
    }

    // Check if remove action
    if (args.remove) {
      const target = rawPositional;
      if (!target) {
        consola.error('Error: Please specify the address to remove.');
        consola.info('Usage: lana watch <address> --remove');
        process.exit(1);
      }
      const success = removeFromWatchlist(target);
      if (success) {
        consola.success(`Target ${pc.cyan(target)} removed from watchlist.`);
      } else {
        consola.warn(`Address ${pc.yellow(target)} was not found in your watchlist.`);
      }
      return;
    }

    // Default or explicit add action
    const target = rawPositional;
    if (!target) {
      consola.error('Error: Please provide a target Solana address to watch.');
      consola.info('Usage: lana watch <address> --add --label "Raydium Whale" --tag "whale,bot"');
      process.exit(1);
    }

    if (!isValidSolanaAddress(target)) {
      consola.warn(`Warning: '${target}' does not look like a standard Solana address.`);
    }

    const tags = args.tag ? args.tag.split(',').map(s => s.trim()).filter(Boolean) : undefined;
    const { created, item } = addToWatchlist({
      address: target,
      label: args.label,
      tags,
      notes: args.notes,
    });

    if (created) {
      consola.success(`Added new target to watchlist: ${pc.cyan(item.address)} [${item.label}]`);
    } else {
      consola.success(`Updated target in watchlist: ${pc.cyan(item.address)} [${item.label}]`);
    }

    if (args.json) {
      console.log(JSON.stringify(item, null, 2));
    }
  },
});
