import readline from 'node:readline';
import { defineCommand } from 'citty';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import {
  renderLookup,
  renderTx,
  renderFlow,
  renderCompare,
  renderDossier,
  renderAsk,
  renderWatchlist,
  printBox,
} from '../utils/output.js';
import {
  isValidSolanaAddress,
  isValidTxSignature,
} from '../utils/format.js';
import {
  loadWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  ensureApiKeyInteractive,
} from '../utils/config.js';

/**
 * Simple text spinner that doesn't touch stdin/stdout raw mode.
 * ora uses stderr and can corrupt readline state on Windows.
 */
class SimpleSpinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  start(): this {
    process.stdout.write(`\r${pc.cyan(this.frames[0])} ${this.text}`);
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stdout.write(`\r${pc.cyan(this.frames[this.frameIndex])} ${this.text}`);
    }, 80);
    return this;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Clear the spinner line
    process.stdout.write('\r' + ' '.repeat(this.text.length + 4) + '\r');
  }
}

function spin(text: string): SimpleSpinner {
  return new SimpleSpinner(text).start();
}

export async function startInteractiveChat(options: {
  verbose?: boolean;
  apiKey?: string;
  sessionId?: string;
  allowCustomHost?: boolean;
} = {}): Promise<void> {
  const auth = await ensureApiKeyInteractive({
    apiKey: options.apiKey,
  });

  const sessionId = options.sessionId || `session_${Date.now().toString(36)}`;
  const client = new LanaClient({
    apiKey: auth.apiKey,
    verbose: options.verbose,
    allowCustomHost: options.allowCustomHost,
  });

  const banner = [
    `${pc.bold('Session ID:')} ${pc.yellow(sessionId)}  ${pc.green('[LIVE API]')}`,
    `${pc.dim('Type natural language queries, Solana addresses, or forensic commands.')}`,
    `${pc.dim('Commands:')} ${pc.cyan('lookup')}, ${pc.cyan('tx')}, ${pc.cyan('flow')}, ${pc.cyan('compare')}, ${pc.cyan('dossier')}, ${pc.cyan('watch')}, ${pc.cyan('help')}, ${pc.cyan('clear')}, ${pc.cyan('exit')}`,
  ].join('\n');

  printBox('💬 LANA AI // INTERACTIVE REPL', banner, 'cyan');

  const prompt = `${pc.bold(pc.cyan('› '))} `;

  // Use a SINGLE readline interface for the entire session.
  // Creating/destroying rl instances closes process.stdin, which is the root bug.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY !== false,
  });

  // Prevent readline from closing stdin when it's paused between questions
  // @ts-ignore — Node internals, needed to prevent stdin auto-close
  if (process.stdin.unref) {
    // Keep stdin open even when nothing is reading
  }

  const askLine = (): Promise<string | null> => {
    return new Promise((resolve) => {
      // Check if the rl interface has been closed
      if ((rl as any).closed) {
        resolve(null);
        return;
      }

      rl.question(prompt, (answer) => {
        resolve(answer);
      });
    });
  };

  // Handle Ctrl+C
  rl.on('SIGINT', () => {
    console.log(pc.dim('\n\nClosing Lana forensic session. Stay sharp on-chain.\n'));
    rl.close();
    process.exit(0);
  });

  // Handle stdin close (e.g. pipe EOF)
  rl.on('close', () => {
    console.log(pc.dim('\nClosing Lana forensic session. Stay sharp on-chain.\n'));
    process.exit(0);
  });

  async function handleInput(input: string): Promise<boolean> {
    const lower = input.toLowerCase();

    if (lower === 'exit' || lower === 'quit' || lower === '/q' || lower === ':q') {
      console.log(pc.dim('\nClosing Lana forensic session. Stay sharp on-chain.\n'));
      return false;
    }

    if (lower === 'clear' || lower === 'cls') {
      console.clear();
      printBox('💬 LANA AI // INTERACTIVE REPL', banner, 'cyan');
      return true;
    }

    if (lower === 'help' || lower === '?') {
      console.log(pc.bold(pc.underline('\nAvailable REPL Commands & Shortcuts:\n')));
      console.log(`  ${pc.cyan('lookup <address>')}       ${pc.dim('Truecaller-style wallet profile & risk')}`);
      console.log(`  ${pc.cyan('tx <signature>')}         ${pc.dim('Plain-English transaction explanation')}`);
      console.log(`  ${pc.cyan('flow <address> [depth]')} ${pc.dim('Hierarchical multi-hop fund flow tree')}`);
      console.log(`  ${pc.cyan('compare <a1> <a2>...')}   ${pc.dim('Side-by-side multi-wallet forensic analysis')}`);
      console.log(`  ${pc.cyan('dossier <address>')}      ${pc.dim('Investigative case file report')}`);
      console.log(`  ${pc.cyan('watch [add|list|rm]')}    ${pc.dim('Manage tracked target addresses')}`);
      console.log(`  ${pc.cyan('clear')}                  ${pc.dim('Clear terminal screen')}`);
      console.log(`  ${pc.cyan('exit')}                   ${pc.dim('Exit interactive chat')}\n`);
      console.log(pc.dim('Tip: You can also directly paste any Solana address or TX hash, or type natural language questions!\n'));
      return true;
    }

    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const rest = parts.slice(1);

    try {
      if (cmd === 'lookup' && rest[0]) {
        const s = spin(`Looking up ${rest[0]}...`);
        const profile = await client.lookup(rest[0]);
        s.stop();
        renderLookup(profile, false);
      } else if (cmd === 'tx' && rest[0]) {
        const s = spin(`Deconstructing transaction ${rest[0]}...`);
        const txExplainer = await client.tx(rest[0]);
        s.stop();
        renderTx(txExplainer, false);
      } else if (cmd === 'flow' && rest[0]) {
        const depth = parseInt(rest[1] || '2', 10) || 2;
        const s = spin(`Tracing fund flow for ${rest[0]} (depth ${depth})...`);
        const flow = await client.flow(rest[0], depth);
        s.stop();
        renderFlow(flow, false);
      } else if (cmd === 'compare' && rest.length >= 2) {
        const s = spin(`Comparing ${rest.length} wallets...`);
        const comp = await client.compare(rest);
        s.stop();
        renderCompare(comp, false);
      } else if (cmd === 'dossier' && rest[0]) {
        const s = spin(`Compiling case dossier for ${rest[0]}...`);
        const dos = await client.dossier(rest[0]);
        s.stop();
        renderDossier(dos, false);
      } else if (cmd === 'watch') {
        if (rest[0] === 'add' && rest[1]) {
          const res = addToWatchlist({ address: rest[1], label: rest.slice(2).join(' ') || 'Target' });
          console.log(pc.green(`\nTarget added to watchlist: ${res.item.address}\n`));
        } else if ((rest[0] === 'remove' || rest[0] === 'rm') && rest[1]) {
          const ok = removeFromWatchlist(rest[1]);
          console.log(ok ? pc.green(`\nRemoved ${rest[1]}\n`) : pc.yellow(`\nTarget not found\n`));
        } else {
          renderWatchlist(loadWatchlist(), false);
        }
      } else if (isValidSolanaAddress(input) && !input.includes(' ')) {
        const s = spin(`Auto-detect: Looking up wallet ${input}...`);
        const profile = await client.lookup(input);
        s.stop();
        renderLookup(profile, false);
      } else if (isValidTxSignature(input) && !input.includes(' ')) {
        const s = spin(`Auto-detect: Explaining transaction ${input}...`);
        const txExplainer = await client.tx(input);
        s.stop();
        renderTx(txExplainer, false);
      } else {
        const s = spin('Lana AI is analyzing Solana telemetry...');
        const response = await client.ask(input, sessionId);
        s.stop();
        renderAsk(response, false);
      }
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message || err}\n`));
    }

    return true;
  }

  // Main REPL loop — keeps prompting until user exits or stdin closes
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const line = await askLine();

    if (line === null) {
      break;
    }

    const input = line.trim();
    if (!input) {
      continue;
    }

    const shouldContinue = await handleInput(input);
    if (!shouldContinue) {
      break;
    }
  }

  rl.close();
  process.exit(0);
}

export default defineCommand({
  meta: {
    name: 'chat',
    description: 'Start an interactive REPL chat session with Lana AI (Telegram bot-style experience)',
  },
  args: {
    session: {
      type: 'string',
      description: 'Resume or name a specific conversation session',
      alias: ['s'],
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logging',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'Override Lana / Helius API key',
    },
  },
  async run({ args }) {
    await startInteractiveChat({
      sessionId: args.session,
      verbose: args.verbose,
      apiKey: args.apiKey,
    });
  },
});
