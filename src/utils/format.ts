import pc from 'picocolors';

export function formatAddress(address: string, full = false): string {
  if (!address) return pc.dim('unknown');
  if (full || address.length <= 12) return pc.cyan(address);
  return pc.cyan(`${address.slice(0, 4)}...${address.slice(-4)}`);
}

export function formatTxHash(hash: string, full = false): string {
  if (!hash) return pc.dim('unknown');
  if (full || hash.length <= 16) return pc.yellow(hash);
  return pc.yellow(`${hash.slice(0, 6)}...${hash.slice(-6)}`);
}

export function formatSol(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.0000 SOL';
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  return `${pc.magenta(formatted)} ${pc.dim('SOL')}`;
}

export function formatUsd(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  return pc.green(`$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
}

export function formatRiskBadge(score: number, level?: string): string {
  const calculatedLevel = level || (score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW');
  const scoreStr = `[${score}/100 - ${calculatedLevel}]`;

  if (calculatedLevel === 'CRITICAL') {
    return pc.bgRed(pc.white(pc.bold(` ${scoreStr} `)));
  }
  if (calculatedLevel === 'HIGH') {
    return pc.red(pc.bold(scoreStr));
  }
  if (calculatedLevel === 'MEDIUM') {
    return pc.yellow(pc.bold(scoreStr));
  }
  return pc.green(pc.bold(scoreStr));
}

export function formatLabelBadge(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('drainer') || l.includes('scam') || l.includes('phish') || l.includes('exploit')) {
    return pc.bgRed(pc.black(` ${label} `));
  }
  if (l.includes('whale') || l.includes('insider') || l.includes('sniper')) {
    return pc.bgMagenta(pc.white(` ${label} `));
  }
  if (l.includes('cex') || l.includes('binance') || l.includes('coinbase') || l.includes('kraken')) {
    return pc.bgBlue(pc.white(` ${label} `));
  }
  if (l.includes('bot') || l.includes('arb') || l.includes('mev')) {
    return pc.bgYellow(pc.black(` ${label} `));
  }
  return pc.bgCyan(pc.black(` ${label} `));
}

export function formatDate(dateInput?: string | number | Date): string {
  if (!dateInput) return pc.dim('N/A');
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  
  const iso = d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return pc.dim(iso);
}

export function isValidSolanaAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  // Base58 regex length 32-44
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

export function isValidTxSignature(sig: string): boolean {
  if (!sig || typeof sig !== 'string') return false;
  // Solana transaction signature length 64-88 Base58
  return /^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig.trim());
}
