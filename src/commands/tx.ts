import { defineCommand } from 'citty';
import { consola } from 'consola';
import pc from 'picocolors';
import { LanaClient } from '../lana-client.js';
import { OrbRpcClient } from '../orb/rpc.js';
import type { OrbTxDetails } from '../orb/types.js';
import type { TransactionExplainer } from '../types.js';
import { renderTx } from '../utils/output.js';
import { isValidTxSignature } from '../utils/format.js';
import { ensureApiKeyInteractive } from '../utils/config.js';

export default defineCommand({
  meta: {
    name: 'tx',
    description: 'Plain-English breakdown of a Solana transaction + money movements',
  },
  args: {
    target: {
      type: 'positional',
      description: 'Solana transaction signature',
      required: false,
    },
    signature: {
      type: 'string',
      description: 'Solana transaction signature (flag alternative)',
      alias: ['s', 'sig'],
    },
    json: {
      type: 'boolean',
      description: 'Output pure JSON for scripting',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet mode without decorative output',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Enable verbose logs',
      default: false,
    },
    apiKey: {
      type: 'string',
      description: 'API key for Lana / Helius',
    },
    allowCustomHost: {
      type: 'boolean',
      description: 'Allow sending API credentials to a custom/untrusted endpoint',
      default: false,
    },
  },
  async run({ args }) {
    const sig = (args.target || args.signature || (args as any)._?.[0] || '').trim();

    if (!sig) {
      consola.error('Error: Please provide a transaction signature.');
      consola.info('Usage: lana tx <signature> or lana tx --signature <signature>');
      process.exit(1);
    }

    if (!isValidTxSignature(sig)) {
      consola.warn(`Warning: '${sig}' does not look like a standard Solana signature format.`);
    }

    try {
      const auth = await ensureApiKeyInteractive({
        apiKey: args.apiKey,
      });

      if (!args.quiet && !args.json) {
        consola.start(`Deconstructing Solana transaction ${pc.yellow(sig)}...`);
      }

      // 1. Fetch on-chain ground truth facts via Orb RPC lookup
      const rpc = new OrbRpcClient('mainnet', auth.apiKey);
      let onChainTx: OrbTxDetails | null = null;
      let onChainLookupError: string | null = null;

      try {
        onChainTx = await rpc.getTransaction(sig);
      } catch (err: any) {
        onChainLookupError = err.message || String(err);
      }

      // 2. Fetch Lana AI plain-English explanation
      const client = new LanaClient({
        apiKey: auth.apiKey,
        verbose: args.verbose,
        allowCustomHost: args.allowCustomHost,
      });

      let txExplainer: TransactionExplainer;
      try {
        txExplainer = await client.tx(sig);
      } catch (err: any) {
        txExplainer = {
          signature: sig,
          status: onChainTx ? (onChainTx.status === 'Success' ? 'SUCCESS' : 'FAILED') : 'UNKNOWN',
          plainEnglish: onChainTx
            ? 'On-chain transaction verified. AI plain-English summary unavailable.'
            : `Transaction unavailable or not found on Solana mainnet.`,
          moneyMovements: [],
          programInteractions: [],
          signers: [],
        };
      }

      // 3. Verify and reconcile transaction facts with on-chain ground truth
      if (onChainTx) {
        txExplainer.status = onChainTx.status === 'Success' ? 'SUCCESS' : 'FAILED';
        txExplainer.feeSol = onChainTx.fee;
        txExplainer.timestamp = onChainTx.blockTime !== 'Unknown' ? onChainTx.blockTime : undefined;
        if (onChainTx.accounts && onChainTx.accounts.length > 0) {
          const signers = onChainTx.accounts.filter(a => a.isSigner).map(a => a.address);
          if (signers.length > 0) {
            txExplainer.signers = signers;
          }
        }
        if (onChainTx.status === 'Failed') {
          txExplainer.onChainError = 'Transaction execution failed on-chain (instruction error).';
        }
      } else {
        // Transaction could not be verified on-chain
        txExplainer.status = 'UNKNOWN';
        txExplainer.feeSol = undefined;
        txExplainer.timestamp = undefined;
        txExplainer.onChainError = onChainLookupError || 'Transaction not found on-chain.';
      }

      if (!args.quiet && !args.json) {
        consola.success('Transaction parsed.\n');
      }

      renderTx(txExplainer, args.json);
    } catch (err: any) {
      consola.error(`Failed to explain transaction: ${err.message || err}`);
      process.exit(1);
    }
  },
});
