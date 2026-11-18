import { defineCommand } from 'citty';
import pc from 'picocolors';
import { OrbRpcClient } from '../orb/rpc.js';
import { OrbAi } from '../orb/ai.js';
import type { OrbCluster } from '../orb/types.js';
import { renderOrbTx } from '../orb/views/tx-view.js';
import { renderOrbProgram } from '../orb/views/program-view.js';
import { renderOrbWallet } from '../orb/views/wallet-view.js';
import { renderOrbToken } from '../orb/views/token-view.js';
import { startOrbRepl } from '../orb/repl.js';
import { isValidSolanaAddress, isValidTxSignature } from '../utils/format.js';
import { getApiKey } from '../utils/config.js';
import { LanaClient } from '../lana-client.js';

export default defineCommand({
  meta: {
    name: 'orb',
    description: 'Terminal-native Solana explorer inspired by Orb (orbmarkets.io) powered by Lana AI',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Address, signature, or subcommand (tx, program, token)',
      required: false,
    },
    value: {
      type: 'positional',
      description: 'Value for subcommand (e.g. signature, program ID, token mint)',
      required: false,
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON for scripting',
      default: false,
    },
    noAi: {
      type: 'boolean',
      description: 'Disable Lana AI summary enrichment',
      default: false,
    },
    devnet: {
      type: 'boolean',
      description: 'Query Solana devnet cluster',
      default: false,
    },
    testnet: {
      type: 'boolean',
      description: 'Query Solana testnet cluster',
      default: false,
    },
    logs: {
      type: 'boolean',
      description: 'Show full un-truncated transaction program logs',
      default: false,
    },
    idl: {
      type: 'boolean',
      description: 'Dump full program IDL JSON schema if available',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'Custom Lana / Helius API key',
    },
  },
  async run({ args, rawArgs }) {
    const cluster: OrbCluster = args.devnet ? 'devnet' : args.testnet ? 'testnet' : 'mainnet';
    const apiKey = getApiKey(args.apiKey);

    const rpc = new OrbRpcClient(cluster, apiKey);
    let ai: OrbAi | null = null;
    if (!args.noAi && apiKey) {
      try {
        const lanaClient = new LanaClient({ apiKey });
        ai = new OrbAi(lanaClient);
      } catch {
        // AI remains null
      }
    }

    // Parse command-line positional tokens from rawArgs (excluding flags)
    const tokens = (rawArgs || []).filter(arg => !arg.startsWith('-'));

    // Check for `tx <sig>`
    if (tokens[0] === 'tx' || args.target === 'tx') {
      const sig = tokens[1] || args.value;
      if (!sig) {
        console.log(pc.red('\nError: Please provide a transaction signature: lana orb tx <signature>\n'));
        process.exit(1);
      }
      await inspectTx(sig);
      return;
    }

    // Check for `program <id>`
    if (tokens[0] === 'program' || args.target === 'program') {
      const progId = tokens[1] || args.value;
      if (!progId) {
        console.log(pc.red('\nError: Please provide a program ID: lana orb program <program_id>\n'));
        process.exit(1);
      }
      await inspectProgram(progId);
      return;
    }

    // Check for `token <mint>`
    if (tokens[0] === 'token' || args.target === 'token') {
      const mint = tokens[1] || args.value;
      if (!mint) {
        console.log(pc.red('\nError: Please provide a token mint address: lana orb token <mint>\n'));
        process.exit(1);
      }
      await inspectToken(mint);
      return;
    }

    // If single target was passed (e.g. `lana orb <address>` or `lana orb <signature>`)
    const singleTarget = tokens[0] || args.target;
    if (singleTarget) {
      // 1. Transaction Signature
      if (isValidTxSignature(singleTarget) && singleTarget.length >= 64 && !isValidSolanaAddress(singleTarget)) {
        await inspectTx(singleTarget);
        return;
      }

      // 2. Base58 Address (check if program, mint, or wallet)
      if (isValidSolanaAddress(singleTarget)) {
        await inspectAddressAuto(singleTarget);
        return;
      }

      console.log(pc.red(`\nError: Unrecognized Solana identifier '${singleTarget}'. Expected address or signature.\n`));
      process.exit(1);
    }

    // Default: enter interactive Orb REPL mode
    await startOrbRepl({
      cluster,
      apiKey,
      noAi: args.noAi,
    });

    // Helper functions
    async function inspectTx(sig: string) {
      if (!args.json) {
        process.stdout.write(pc.dim(`\nFetching transaction ${sig.slice(0, 8)}... on ${cluster}\n`));
      }
      try {
        const tx = await rpc.getTransaction(sig);
        if (!args.noAi && ai) {
          tx.aiSummary = await ai.getTxSummary(sig, tx);
        }
        renderOrbTx(tx, { logs: args.logs, noAi: args.noAi, json: args.json });
      } catch (err: any) {
        console.log(pc.red(`\n✖ Transaction Error: ${err.message || err}\n`));
        process.exit(1);
      }
    }

    async function inspectProgram(progId: string) {
      if (!args.json) {
        process.stdout.write(pc.dim(`\nInspecting program ${progId.slice(0, 8)}... on ${cluster}\n`));
      }
      try {
        const prog = await rpc.getProgram(progId);
        if (!args.noAi && ai) {
          prog.aiSummary = await ai.getProgramSummary(progId, prog.name);
        }
        renderOrbProgram(prog, { idl: args.idl, noAi: args.noAi, json: args.json });
      } catch (err: any) {
        console.log(pc.red(`\n✖ Program Error: ${err.message || err}\n`));
        process.exit(1);
      }
    }

    async function inspectToken(mint: string) {
      if (!args.json) {
        process.stdout.write(pc.dim(`\nFetching token mint ${mint.slice(0, 8)}... on ${cluster}\n`));
      }
      try {
        const t = await rpc.getToken(mint);
        renderOrbToken(t, { noAi: args.noAi, json: args.json });
      } catch (err: any) {
        console.log(pc.red(`\n✖ Token Error: ${err.message || err}\n`));
        process.exit(1);
      }
    }

    async function inspectAddressAuto(address: string) {
      try {
        const accInfo = await rpc.rpcCall<any>('getAccountInfo', [address, { encoding: 'jsonParsed' }]);
        if (!accInfo?.value) {
          console.log(pc.yellow(`\nAccount ${address} does not exist on-chain (${cluster}).\n`));
          return;
        }

        const val = accInfo.value;
        const owner = val.owner || '';
        const isExecutable = Boolean(val.executable);

        // Check if program
        if (isExecutable || owner.startsWith('BPFLoader')) {
          await inspectProgram(address);
          return;
        }

        // Check if token mint
        if (
          (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
            owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') &&
          val.data?.parsed?.type === 'mint'
        ) {
          await inspectToken(address);
          return;
        }

        // Otherwise wallet
        const wallet = await rpc.getWallet(address);
        if (!args.noAi && ai) {
          wallet.aiSummary = await ai.askQuestion(
            `Briefly describe this wallet in 2 sentences. It has ${wallet.solBalance} SOL and ${wallet.tokenCount} token holdings.`,
            `Address: ${address}`
          );
        }
        renderOrbWallet(wallet, { noAi: args.noAi, json: args.json });
      } catch (err: any) {
        console.log(pc.red(`\n✖ Account Error: ${err.message || err}\n`));
        process.exit(1);
      }
    }
  },
});
