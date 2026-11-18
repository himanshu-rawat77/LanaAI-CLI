import pc from 'picocolors';
import type { OrbTokenDetails } from '../types.js';

export interface TokenViewOptions {
  noAi?: boolean;
  json?: boolean;
}

const LINE = '─'.repeat(62);

export function renderOrbToken(t: OrbTokenDetails, options: TokenViewOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify(t, null, 2));
    return;
  }

  // 1. TOKEN HEADER
  console.log(pc.bold(pc.white('\nTOKEN MINT')));
  console.log(pc.dim(LINE));

  console.log(`${pc.bold('Mint Address   ')} ${pc.cyan(t.mint)}`);
  if (t.name) console.log(`${pc.bold('Name           ')} ${pc.white(t.name)}`);
  if (t.symbol) console.log(`${pc.bold('Symbol         ')} ${pc.yellow(t.symbol)}`);

  const standard = t.security?.isToken2022
    ? pc.magenta('Token-2022 (Extensions)')
    : pc.cyan('SPL Token Standard');
  console.log(`${pc.bold('Standard       ')} ${standard}`);
  console.log(`${pc.bold('Decimals       ')} ${t.decimals}`);
  console.log(`${pc.bold('Supply         ')} ${t.supply.toLocaleString('en-US')}`);
  console.log(`${pc.bold('Token Program  ')} ${pc.dim(t.tokenProgram)}`);
  console.log(`${pc.bold('Initialized    ')} ${t.isInitialized ? pc.green('Yes') : pc.red('No')}`);

  // 2. SECURITY & RISK AUDIT
  console.log(pc.bold(pc.white('\nSECURITY & RISK AUDIT')));
  console.log(pc.dim(LINE));

  const mintAuthStr =
    t.security?.mintAuthorityStatus === 'Revoked (Fixed Supply)'
      ? pc.green('Revoked (Fixed Supply)')
      : pc.yellow(`Active (${t.mintAuthority})`);
  console.log(`${pc.bold('Mint Authority ')} ${mintAuthStr}`);

  const freezeAuthStr =
    t.security?.freezeAuthorityStatus === 'Revoked (Safe)'
      ? pc.green('Revoked (Safe - Cannot freeze accounts)')
      : pc.red(`Active (${t.freezeAuthority})`);
  console.log(`${pc.bold('Freeze Auth    ')} ${freezeAuthStr}`);

  if (t.security?.isToken2022) {
    const feeStr =
      t.security.transferFeePercent != null
        ? t.security.transferFeePercent > 0
          ? pc.yellow(`${t.security.transferFeePercent.toFixed(2)}%`)
          : pc.green('0%')
        : pc.dim('None');
    console.log(`${pc.bold('Transfer Fee   ')} ${feeStr}`);

    const delegateStr = t.security.hasPermanentDelegate
      ? pc.red('ACTIVE (High Risk: Can transfer/burn holder tokens)')
      : pc.green('None');
    console.log(`${pc.bold('Perm Delegate  ')} ${delegateStr}`);

    const hookStr = t.security.hasTransferHook
      ? pc.yellow('Custom Transfer Hook Attached')
      : pc.green('None');
    console.log(`${pc.bold('Transfer Hook  ')} ${hookStr}`);

    if (t.security.extensions && t.security.extensions.length > 0) {
      console.log(`${pc.bold('Extensions     ')} ${pc.dim(t.security.extensions.join(', '))}`);
    }
  }

  // 3. MARKET & LIQUIDITY (from DEX metrics)
  if (t.market) {
    console.log(pc.bold(pc.white('\nMARKET & LIQUIDITY')));
    console.log(pc.dim(LINE));

    if (t.market.priceUsd != null) {
      const priceStr =
        t.market.priceUsd < 0.0001
          ? `$${t.market.priceUsd.toExponential(4)}`
          : `$${t.market.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
      console.log(`${pc.bold('Price (USD)    ')} ${pc.green(priceStr)}`);
    }

    if (t.market.priceNative != null) {
      console.log(
        `${pc.bold('Price (SOL)    ')} ${pc.magenta(`${t.market.priceNative.toFixed(8)} SOL`)}`
      );
    }

    if (t.market.priceChange24h != null) {
      const chg = t.market.priceChange24h;
      const chgStr = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`;
      const chgColored = chg >= 0 ? pc.green(chgStr) : pc.red(chgStr);
      console.log(`${pc.bold('24h Change     ')} ${chgColored}`);
    }

    if (t.market.volume24h != null) {
      console.log(
        `${pc.bold('24h Volume     ')} $${t.market.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      );
    }

    if (t.market.fdv != null) {
      console.log(
        `${pc.bold('FDV / MCap     ')} $${t.market.fdv.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      );
    }

    if (t.market.liquidityUsd != null) {
      console.log(
        `${pc.bold('Liquidity      ')} $${t.market.liquidityUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      );
    }

    if (t.market.dexId) {
      const dexLabel = `${t.market.dexId.toUpperCase()} (${t.market.pairAddress ? t.market.pairAddress.slice(0, 4) + '...' + t.market.pairAddress.slice(-4) : 'Pool'})`;
      console.log(`${pc.bold('Primary DEX    ')} ${pc.cyan(dexLabel)}`);
    }

    if (t.market.txns24h) {
      console.log(
        `${pc.bold('24h Trades     ')} ${pc.green(`${t.market.txns24h.buys.toLocaleString()} Buys`)} / ${pc.red(`${t.market.txns24h.sells.toLocaleString()} Sells`)}`
      );
    }
  }

  // 4. OFFICIAL LINKS & SOCIALS
  if (t.market?.websites?.length || t.market?.socials?.length) {
    console.log(pc.bold(pc.white('\nOFFICIAL LINKS & SOCIALS')));
    console.log(pc.dim(LINE));
    if (t.market.websites) {
      for (const w of t.market.websites) {
        console.log(`  ${pc.cyan('•')} Website: ${w}`);
      }
    }
    if (t.market.socials) {
      for (const s of t.market.socials) {
        console.log(`  ${pc.cyan('•')} ${s.type}: ${s.url}`);
      }
    }
  }

  // 5. AI SUMMARY
  if (!options.noAi && t.aiSummary) {
    console.log(pc.bold(pc.white('\nAI SUMMARY')));
    console.log(pc.dim(LINE));
    console.log(pc.italic(t.aiSummary));
  }
  console.log();
}
