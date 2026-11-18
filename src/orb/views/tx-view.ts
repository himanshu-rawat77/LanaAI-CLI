import pc from 'picocolors';
import Table from 'cli-table3';
import type { OrbTxDetails } from '../types.js';

export interface TxViewOptions {
  logs?: boolean;
  noAi?: boolean;
  json?: boolean;
}

const LINE = '─'.repeat(62);

export function renderOrbTx(tx: OrbTxDetails, options: TxViewOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify(tx, null, 2));
    return;
  }

  // 1. TRANSACTION HEADER
  console.log(pc.bold(pc.white('\nTRANSACTION')));
  console.log(pc.dim(LINE));

  const statusColor = tx.status === 'Success' ? pc.green('Success') : pc.red('Failed');
  const cuPercentStr = `${tx.cuPercentage.toFixed(1)}%`;
  const cuColor = tx.cuPercentage > 85 ? pc.red : tx.cuPercentage > 50 ? pc.yellow : pc.cyan;

  console.log(`${pc.bold('Signature  ')} ${pc.cyan(tx.signature)}`);
  console.log(`${pc.bold('Status     ')} ${statusColor}`);
  console.log(`${pc.bold('Slot       ')} ${tx.slot.toLocaleString()}`);
  console.log(`${pc.bold('Block Time ')} ${tx.blockTime}`);
  console.log(`${pc.bold('Fee        ')} ${tx.fee.toFixed(6)} SOL`);
  console.log(
    `${pc.bold('CU Used    ')} ${tx.cuUsed.toLocaleString()} / ${tx.cuLimit.toLocaleString()} (${cuColor(cuPercentStr)})`
  );
  console.log(`${pc.bold('Version    ')} ${tx.version}`);

  // 2. AI SUMMARY
  if (!options.noAi && tx.aiSummary) {
    console.log(pc.bold(pc.white('\nAI SUMMARY')));
    console.log(pc.dim(LINE));
    console.log(pc.italic(tx.aiSummary));
  }

  // 3. BALANCE CHANGES
  console.log(pc.bold(pc.white('\nBALANCE CHANGES')));
  console.log(pc.dim(LINE));

  if (tx.balanceChanges.length === 0) {
    console.log(pc.dim('No balance changes recorded for this transaction.'));
  } else {
    const table = new Table({
      head: [pc.bold('Account'), pc.bold('SOL Δ'), pc.bold('Token Δ')],
      colWidths: [36, 16, 26],
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

    for (const b of tx.balanceChanges) {
      const signerTag = b.isSigner ? pc.yellow(' (Signer)') : '';
      const accShort = `${b.account.slice(0, 4)}...${b.account.slice(-4)}${signerTag}`;
      const solDeltaStr =
        b.solDelta > 0
          ? pc.green(`+${b.solDelta.toFixed(6)}`)
          : b.solDelta < 0
          ? pc.red(b.solDelta.toFixed(6))
          : pc.dim('0.000000');
      const tokenDeltaStr = b.tokenDelta
        ? b.tokenDelta.startsWith('+')
          ? pc.green(b.tokenDelta)
          : pc.red(b.tokenDelta)
        : pc.dim('—');

      table.push([accShort, solDeltaStr, tokenDeltaStr]);
    }
    console.log(table.toString());
  }

  // 4. INSTRUCTIONS (top-level)
  console.log(pc.bold(pc.white('\nINSTRUCTIONS (top-level)')));
  console.log(pc.dim(LINE));

  if (tx.topInstructions.length === 0) {
    console.log(pc.dim('No top-level instructions.'));
  } else {
    for (const ix of tx.topInstructions) {
      const ixTitle = `${pc.cyan(ix.program)}::${pc.magenta(ix.instructionName || 'Instruction')}`;
      console.log(`${pc.bold(`#${ix.index}`)}  ${ixTitle}`);
      if (ix.details && ix.details.length > 0) {
        for (const d of ix.details) {
          console.log(`    ${pc.dim(d)}`);
        }
      }
    }
  }

  // 5. INNER INSTRUCTIONS
  console.log(pc.bold(pc.white('\nINNER INSTRUCTIONS')));
  console.log(pc.dim(LINE));

  if (tx.innerInstructions.length === 0) {
    console.log(pc.dim('No inner instructions (CPI calls).'));
  } else {
    for (const inner of tx.innerInstructions) {
      const innerTitle = `${pc.cyan(inner.program)}::${pc.magenta(inner.instructionName || 'Instruction')}`;
      console.log(`${pc.bold(inner.indexStr)}  ${innerTitle}`);
      console.log(`      ${pc.dim('Program:')} ${pc.dim(inner.programId)}`);
      if (inner.cu != null) {
        console.log(`      ${pc.dim('CU:')} ${inner.cu.toLocaleString()}`);
      }
      if (inner.details && inner.details.length > 0) {
        for (const d of inner.details) {
          console.log(`      ${pc.dim(d)}`);
        }
      }
    }
  }

  // 6. LOGS
  console.log(pc.bold(pc.white('\nLOGS')));
  console.log(pc.dim(LINE));

  if (tx.logs.length === 0) {
    console.log(pc.dim('No program logs available.'));
  } else {
    const showFull = Boolean(options.logs);
    const maxLogs = showFull ? tx.logs.length : 40;
    const logsToPrint = tx.logs.slice(0, maxLogs);

    for (const log of logsToPrint) {
      if (log.includes('failed') || log.includes('Error')) {
        console.log(pc.red(log));
      } else if (log.includes('success')) {
        console.log(pc.green(log));
      } else {
        console.log(pc.dim(log));
      }
    }

    if (!showFull && tx.logs.length > 40) {
      console.log(
        pc.yellow(`\n... (${tx.logs.length - 40} more lines truncated. Run with --logs to show full logs)`)
      );
    }
  }

  // 7. ACCOUNTS
  console.log(pc.bold(pc.white('\nACCOUNTS')));
  console.log(pc.dim(LINE));

  const accTable = new Table({
    head: [pc.bold('#'), pc.bold('Address'), pc.bold('Signer'), pc.bold('Writable'), pc.bold('Owner')],
    colWidths: [4, 46, 8, 10, 18],
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

  for (const acc of tx.accounts) {
    accTable.push([
      pc.dim(String(acc.index)),
      acc.isSigner ? pc.bold(acc.address) : acc.address,
      acc.isSigner ? pc.green('✓') : pc.dim('—'),
      acc.isWritable ? pc.yellow('✓') : pc.dim('—'),
      acc.owner ? pc.dim(`${acc.owner.slice(0, 4)}...${acc.owner.slice(-4)}`) : pc.dim('—'),
    ]);
  }
  console.log(accTable.toString());
  console.log();
}
