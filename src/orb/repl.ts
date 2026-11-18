import readline from 'node:readline';
import pc from 'picocolors';
import { OrbRpcClient } from './rpc.js';
import { OrbAi } from './ai.js';
import type { OrbCluster } from './types.js';
import { renderOrbTx } from './views/tx-view.js';
import { renderOrbProgram } from './views/program-view.js';
import { renderOrbWallet } from './views/wallet-view.js';
import { renderOrbToken } from './views/token-view.js';
import { isValidSolanaAddress, isValidTxSignature } from '../utils/format.js';
import { LanaClient } from '../lana-client.js';

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
    process.stdout.write('\r' + ' '.repeat(this.text.length + 8) + '\r');
  }
}

export interface StartOrbReplOptions {
  cluster?: OrbCluster;
  apiKey?: string;
  verbose?: boolean;
  noAi?: boolean;
}

export async function startOrbRepl(options: StartOrbReplOptions = {}): Promise<void> {
  const cluster = options.cluster || 'mainnet';
  const rpc = new OrbRpcClient(cluster, options.apiKey);

  let lanaClient: LanaClient | null = null;
  let ai: OrbAi | null = null;

  try {
    lanaClient = new LanaClient({
      apiKey: options.apiKey,
      verbose: options.verbose,
    });
    ai = new OrbAi(lanaClient);
  } catch {
    // If no key configured, AI is optional in Orb mode
  }

  // Session context for conversational follow-ups
  let lastContext: string = '';
  const sessionId = `orb_${Date.now().toString(36)}`;

  const clusterLabel =
    cluster === 'mainnet'
      ? pc.green('Solana Mainnet Explorer')
      : cluster === 'devnet'
      ? pc.yellow('Solana Devnet Explorer')
      : pc.magenta('Solana Testnet Explorer');

  console.log();
  console.log(pc.bold(pc.cyan(`Lana Orb Mode • ${clusterLabel}`)));
  console.log(pc.dim('Type an address, signature, program ID, token mint, or natural language.'));
  console.log(pc.dim('Type "help" for commands. Ctrl+C or "exit" to quit.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY !== false,
  });

  const promptText = `${pc.bold(pc.cyan('› '))} `;

  const askLine = (): Promise<string | null> => {
    return new Promise((resolve) => {
      if ((rl as any).closed) {
        resolve(null);
        return;
      }
      rl.question(promptText, (answer) => {
        resolve(answer);
      });
    });
  };

  rl.on('SIGINT', () => {
    console.log(pc.dim('\nExiting Lana Orb mode.\n'));
    rl.close();
    process.exit(0);
  });

  rl.on('close', () => {
    console.log(pc.dim('\nExiting Lana Orb mode.\n'));
    process.exit(0);
  });

  while (true) {
    const rawInput = await askLine();
    if (rawInput === null) break;

    const input = rawInput.trim();
    if (!input) continue;

    const lower = input.toLowerCase();

    if (lower === 'exit' || lower === 'quit' || lower === 'q' || lower === ':q') {
      console.log(pc.dim('\nExiting Lana Orb mode.\n'));
      rl.close();
      break;
    }

    if (lower === 'clear' || lower === 'cls') {
      console.clear();
      console.log(pc.bold(pc.cyan(`Lana Orb Mode • ${clusterLabel}`)));
      console.log(pc.dim('Type an address, signature, program ID, token mint, or natural language.\n'));
      continue;
    }

    if (lower === 'help' || lower === '?') {
      console.log(pc.bold(pc.underline('\nOrb Explorer Commands & Shortcuts:\n')));
      console.log(`  ${pc.cyan('<signature>')}         ${pc.dim('Inspect 88-char transaction signature')}`);
      console.log(`  ${pc.cyan('<address>')}           ${pc.dim('Inspect 32-44 char account, program, or mint')}`);
      console.log(`  ${pc.cyan('tx <signature>')}      ${pc.dim('Explicit transaction inspection')}`);
      console.log(`  ${pc.cyan('program <id>')}        ${pc.dim('Explicit program inspection & IDL')}`);
      console.log(`  ${pc.cyan('token <mint>')}         ${pc.dim('Explicit token mint breakdown')}`);
      console.log(`  ${pc.cyan('<natural language>')}   ${pc.dim('Ask Lana AI anything with current context')}`);
      console.log(`  ${pc.cyan('clear')}               ${pc.dim('Clear screen')}`);
      console.log(`  ${pc.cyan('exit')}                ${pc.dim('Leave Orb mode\n')}`);
      continue;
    }

    // 1. Explicit prefixes
    if (input.startsWith('tx ')) {
      const sig = input.slice(3).trim();
      await handleTx(sig);
      continue;
    }

    if (input.startsWith('program ')) {
      const prog = input.slice(8).trim();
      await handleProgram(prog);
      continue;
    }

    if (input.startsWith('token ')) {
      const mint = input.slice(6).trim();
      await handleToken(mint);
      continue;
    }

    // 2. Smart Detection
    // Signature: Base58 string length between 64 and 90 chars (most Solana signatures are 87-88)
    if (isValidTxSignature(input) && input.length >= 64 && !isValidSolanaAddress(input)) {
      await handleTx(input);
      continue;
    }

    // Account / Program / Token Mint: Base58 string length 32-44 chars
    if (isValidSolanaAddress(input)) {
      await handleAddressAuto(input);
      continue;
    }

    // 3. Fallback: Natural language question to Lana AI
    await handleAiQuestion(input);
  }

  // --- Handlers ---

  async function handleTx(signature: string) {
    const spinner = new SimpleSpinner(`Deconstructing transaction ${signature.slice(0, 8)}...`).start();
    try {
      const tx = await rpc.getTransaction(signature);
      if (!options.noAi && ai) {
        tx.aiSummary = await ai.getTxSummary(signature, tx);
      }
      spinner.stop();
      renderOrbTx(tx, { noAi: options.noAi });
      lastContext = `Inspected Transaction ${signature}:\nStatus: ${tx.status}, Fee: ${tx.fee} SOL, CU Used: ${tx.cuUsed}/${tx.cuLimit}, Top Instructions: ${tx.topInstructions.map(i => `${i.program}::${i.instructionName}`).join(', ')}`;
    } catch (err: any) {
      spinner.stop();
      console.log(pc.red(`\n✖ Transaction Lookup Error: ${err.message || err}\n`));
    }
  }

  async function handleProgram(programId: string) {
    const spinner = new SimpleSpinner(`Inspecting program ${programId.slice(0, 8)}...`).start();
    try {
      const prog = await rpc.getProgram(programId);
      if (!options.noAi && ai) {
        prog.aiSummary = await ai.getProgramSummary(programId, prog.name);
      }
      spinner.stop();
      renderOrbProgram(prog, { noAi: options.noAi });
      lastContext = `Inspected Program ${programId} (${prog.name}):\nAuthority: ${prog.authority}, Verified: ${prog.verified}, IDL: ${prog.idlStatus}, Instructions: ${prog.idlInstructions.join(', ')}`;
    } catch (err: any) {
      spinner.stop();
      console.log(pc.red(`\n✖ Program Lookup Error: ${err.message || err}\n`));
    }
  }

  async function handleToken(mint: string) {
    const spinner = new SimpleSpinner(`Loading token ${mint.slice(0, 8)}...`).start();
    try {
      const t = await rpc.getToken(mint);
      spinner.stop();
      renderOrbToken(t, { noAi: options.noAi });
      lastContext = `Inspected Token Mint ${mint}:\nDecimals: ${t.decimals}, Supply: ${t.supply}, Mint Authority: ${t.mintAuthority || 'None'}`;
    } catch (err: any) {
      spinner.stop();
      console.log(pc.red(`\n✖ Token Lookup Error: ${err.message || err}\n`));
    }
  }

  async function handleAddressAuto(address: string) {
    const spinner = new SimpleSpinner(`Resolving account ${address.slice(0, 8)}...`).start();
    try {
      const accInfo = await rpc.rpcCall<any>('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
      spinner.stop();

      if (!accInfo?.value) {
        console.log(pc.yellow(`\nAccount ${address} does not exist on-chain (${cluster}).\n`));
        return;
      }

      const val = accInfo.value;
      const owner = val.owner || '';
      const isExecutable = Boolean(val.executable);

      // Program check
      if (isExecutable || owner.startsWith('BPFLoader')) {
        await handleProgram(address);
        return;
      }

      // Token Mint check
      if (
        (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
          owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') &&
        val.data?.parsed?.type === 'mint'
      ) {
        await handleToken(address);
        return;
      }

      // Otherwise: Wallet / Account
      const walletSpinner = new SimpleSpinner(`Analyzing wallet ${address.slice(0, 8)}...`).start();
      const wallet = await rpc.getWallet(address);
      if (!options.noAi && ai) {
        wallet.aiSummary = await ai.askQuestion(
          `Briefly describe this wallet in 2 sentences. It has ${wallet.solBalance} SOL and ${wallet.tokenCount} token holdings.`,
          `Address: ${address}`
        );
      }
      walletSpinner.stop();
      renderOrbWallet(wallet, { noAi: options.noAi });
      lastContext = `Inspected Wallet ${address}:\nSOL Balance: ${wallet.solBalance}, Token Count: ${wallet.tokenCount}, Recent Txns: ${wallet.recentTxCount}`;
    } catch (err: any) {
      spinner.stop();
      console.log(pc.red(`\n✖ Account Lookup Error: ${err.message || err}\n`));
    }
  }

  async function handleAiQuestion(question: string) {
    if (!ai) {
      console.log(pc.yellow('\nLana AI is not connected. Configure an API key with `lana login` to ask natural language questions.\n'));
      return;
    }

    const spinner = new SimpleSpinner('Consulting Lana AI...').start();
    try {
      const answer = await ai.askQuestion(question, lastContext, sessionId);
      spinner.stop();
      console.log();
      console.log(answer);
      console.log();
    } catch (err: any) {
      spinner.stop();
      console.log(pc.red(`\n✖ Lana AI Error: ${err.message || err}\n`));
    }
  }
}
