import pc from 'picocolors';
import Table from 'cli-table3';
import type { OrbWalletDetails } from '../types.js';

export interface WalletViewOptions {
  noAi?: boolean;
  json?: boolean;
}

const LINE = '─'.repeat(62);

export function renderOrbWallet(w: OrbWalletDetails, options: WalletViewOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify(w, null, 2));
    return;
  }

  // 1. WALLET HEADER
  console.log(pc.bold(pc.white('\nWALLET')));
  console.log(pc.dim(LINE));

  console.log(`${pc.bold('Address     ')} ${pc.cyan(w.address)}`);
  console.log(`${pc.bold('SOL Balance ')} ${pc.magenta(w.solBalance.toFixed(4))} SOL`);
  console.log(`${pc.bold('Lamports    ')} ${w.lamports.toLocaleString()}`);
  console.log(`${pc.bold('Owner       ')} ${pc.dim(w.owner)}`);
  console.log(`${pc.bold('Executable  ')} ${w.executable ? pc.green('true') : pc.dim('false')}`);
  console.log(`${pc.bold('Token Count ')} ${w.tokenCount}`);
  console.log(`${pc.bold('Recent Txns ')} ${w.recentTxCount}`);

  // 2. AI SUMMARY
  if (!options.noAi && w.aiSummary) {
    console.log(pc.bold(pc.white('\nAI SUMMARY')));
    console.log(pc.dim(LINE));
    console.log(pc.italic(w.aiSummary));
  }

  // 3. TOKENS TABLE
  if (w.tokens.length > 0) {
    console.log(pc.bold(pc.white('\nTOKEN HOLDINGS')));
    console.log(pc.dim(LINE));

    const table = new Table({
      head: [pc.bold('Mint'), pc.bold('Amount'), pc.bold('Symbol')],
      colWidths: [46, 18, 14],
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' ',
      },
      style: { 'padding-left': 0, 'padding-right': 2 },
    });

    for (const t of w.tokens.slice(0, 15)) {
      table.push([
        pc.cyan(t.mint),
        t.amount.toLocaleString('en-US', { maximumFractionDigits: 4 }),
        t.symbol ? pc.yellow(t.symbol) : pc.dim('SPL'),
      ]);
    }
    console.log(table.toString());
  }
  console.log();
}
