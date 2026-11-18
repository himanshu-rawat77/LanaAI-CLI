import { defineCommand } from 'citty';
import pc from 'picocolors';

import lookupCmd from './commands/lookup.js';
import txCmd from './commands/tx.js';
import flowCmd from './commands/flow.js';
import compareCmd from './commands/compare.js';
import dossierCmd from './commands/dossier.js';
import askCmd from './commands/ask.js';
import reportCmd from './commands/report.js';
import watchCmd from './commands/watch.js';
import configCmd from './commands/config.js';
import loginCmd from './commands/login.js';
import logoutCmd from './commands/logout.js';
import whoamiCmd from './commands/whoami.js';
import orbCmd from './commands/orb.js';
import chatCmd, { startInteractiveChat } from './commands/chat.js';

export const main = defineCommand({
  meta: {
    name: 'lana',
    version: '1.1.2',
    description: 'Solana Conversational Intelligence & Forensic Explorer (Unofficial Community CLI built on Helius Lana AI)',
  },
  subCommands: {
    chat: chatCmd,
    lookup: lookupCmd,
    tx: txCmd,
    flow: flowCmd,
    compare: compareCmd,
    dossier: dossierCmd,
    ask: askCmd,
    report: reportCmd,
    watch: watchCmd,
    config: configCmd,
    login: loginCmd,
    logout: logoutCmd,
    whoami: whoamiCmd,
    orb: orbCmd,
  },
  args: {
    verbose: {
      type: 'boolean',
      description: 'Enable verbose API request/response logging',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'Custom Lana / Helius API key',
    },
    allowCustomHost: {
      type: 'boolean',
      description: 'Allow sending credentials to a custom/untrusted endpoint',
      default: false,
    },
  },
  async run({ rawArgs, args }) {
    const firstNonFlag = rawArgs?.find(arg => !arg.startsWith('-'));
    if (
      firstNonFlag &&
      [
        'chat',
        'lookup',
        'tx',
        'flow',
        'compare',
        'dossier',
        'ask',
        'report',
        'watch',
        'config',
        'login',
        'logout',
        'whoami',
        'orb',
      ].includes(firstNonFlag)
    ) {
      return;
    }

    if (rawArgs && rawArgs.length === 1 && (rawArgs[0] === '--help' || rawArgs[0] === '-h')) {
      console.log(pc.bold(pc.cyan(`
  ██╗      █████╗ ███╗   ██╗ █████╗     █████╗ ██╗
  ██║     ██╔══██╗████╗  ██║██╔══██╗   ██╔══██╗██║
  ██║     ███████║██╔██╗ ██║███████║   ███████║██║
  ██║     ██╔══██║██║╚██╗██║██╔══██║   ██╔══██║██║
  ███████╗██║  ██║██║ ╚████║██║  ██║██╗██║  ██║██║
  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝
    `)));
      console.log(pc.bold('  Helius Lana AI — Solana Intelligence & On-Chain Detective Toolkit\n'));
      console.log(`  ${pc.bold('Commands:')}`);
      console.log(`    ${pc.cyan('lana')}                   ${pc.dim('Start interactive REPL chat session (default)')}`);
      console.log(`    ${pc.cyan('lana chat')}              ${pc.dim('Start interactive REPL chat session')}`);
      console.log(`    ${pc.cyan('lana lookup <addr>')}      ${pc.dim('Truecaller-style wallet profile & risk')}`);
      console.log(`    ${pc.cyan('lana tx <sig>')}           ${pc.dim('Plain-English transaction breakdown')}`);
      console.log(`    ${pc.cyan('lana flow <addr>')}         ${pc.dim('Multi-hop fund flow tree visualization')}`);
      console.log(`    ${pc.cyan('lana compare <a1> <a2>')}   ${pc.dim('Forensic multi-wallet comparison')}`);
      console.log(`    ${pc.cyan('lana dossier <addr>')}      ${pc.dim('Full On-Chain Noir case file report')}`);
      console.log(`    ${pc.cyan('lana ask "<prompt>"')}      ${pc.dim('Natural language AI queries with memory')}`);
      console.log(`    ${pc.cyan('lana report <addr>')}       ${pc.dim('Exportable research report (table/json/md/csv)')}`);
      console.log(`    ${pc.cyan('lana watch')}               ${pc.dim('Local watchlist management')}`);
      console.log(`    ${pc.cyan('lana config')}              ${pc.dim('API key and preference settings')}`);
      console.log(`    ${pc.cyan('lana orb [target]')}        ${pc.dim('Terminal-native Solana explorer (Orb mode)')}`);
      console.log(`    ${pc.cyan('lana login')}               ${pc.dim('Authenticate and validate your Helius API key')}`);
      console.log(`    ${pc.cyan('lana logout')}              ${pc.dim('Clear saved credentials from this system')}`);
      console.log(`    ${pc.cyan('lana whoami')}              ${pc.dim('Check authentication and system status')}\n`);
      console.log(`  Run ${pc.yellow('lana <command> --help')} for detailed usage & flags.\n`);
      return;
    }

    // Default action when no subcommand is given: start interactive REPL session
    await startInteractiveChat({
      verbose: args.verbose,
      apiKey: args.apiKey,
    });
  },
});

