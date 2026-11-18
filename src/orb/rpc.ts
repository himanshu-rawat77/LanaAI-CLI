import { ofetch } from 'ofetch';
import type {
  OrbCluster,
  OrbTxDetails,
  OrbProgramDetails,
  OrbWalletDetails,
  OrbTokenDetails,
  OrbBalanceChange,
  OrbInstructionDetail,
  OrbInnerInstructionDetail,
  OrbAccountEntry,
} from './types.js';
import { getKnownProgram } from './known-programs.js';

export class OrbRpcClient {
  private cluster: OrbCluster;
  private apiKey?: string;

  constructor(cluster: OrbCluster = 'mainnet', apiKey?: string) {
    this.cluster = cluster;
    this.apiKey = apiKey;
  }

  public getRpcUrl(): string {
    if (this.cluster === 'devnet') {
      return this.apiKey
        ? `https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(this.apiKey)}`
        : 'https://api.devnet.solana.com';
    }
    if (this.cluster === 'testnet') {
      return 'https://api.testnet.solana.com';
    }
    // mainnet
    return this.apiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(this.apiKey)}`
      : 'https://api.mainnet-beta.solana.com';
  }

  public async rpcCall<T>(method: string, params: any[] = []): Promise<T> {
    const url = this.getRpcUrl();
    try {
      const res = await ofetch<any>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          jsonrpc: '2.0',
          id: Math.floor(Math.random() * 100000),
          method,
          params,
        },
        timeout: 25000,
      });

      if (res?.error) {
        throw new Error(res.error.message || `RPC Error: ${JSON.stringify(res.error)}`);
      }
      return res?.result as T;
    } catch (err: any) {
      // If primary failed and was using custom key on mainnet, attempt fallback to public RPC
      if (this.apiKey && this.cluster === 'mainnet') {
        try {
          const fallbackRes = await ofetch<any>('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
              jsonrpc: '2.0',
              id: Math.floor(Math.random() * 100000),
              method,
              params,
            },
            timeout: 20000,
          });
          if (fallbackRes?.result) {
            return fallbackRes.result as T;
          }
        } catch {
          // ignore fallback error and throw original
        }
      }
      throw new Error(`Solana RPC Error (${method}): ${err.message || err}`);
    }
  }

  /**
   * Fetch complete developer-grade transaction details
   */
  public async getTransaction(signature: string): Promise<OrbTxDetails> {
    const rawTx = await this.rpcCall<any>('getTransaction', [
      signature,
      {
        encoding: 'jsonParsed',
        maxSupportedTransactionVersion: 0,
      },
    ]);

    if (!rawTx) {
      throw new Error(`Transaction '${signature}' not found on ${this.cluster}.`);
    }

    const slot = rawTx.slot ?? 0;
    const blockTime = rawTx.blockTime
      ? new Date(rawTx.blockTime * 1000).toISOString()
      : 'Unknown';
    const status: 'Success' | 'Failed' = rawTx.meta?.err ? 'Failed' : 'Success';
    const feeSol = (rawTx.meta?.fee ?? 5000) / 1e9;
    const version: '0' | '1' | 'legacy' =
      rawTx.version === 0 ? '0' : rawTx.version === 1 ? '1' : 'legacy';

    // Compute Units Calculation
    const cuUsed = rawTx.meta?.computeUnitsConsumed ?? 0;
    let cuLimit = 200000; // default standard limit

    const message = rawTx.transaction?.message;
    const accountKeysRaw = message?.accountKeys ?? [];

    // Parse accounts
    const accounts: OrbAccountEntry[] = accountKeysRaw.map((acc: any, idx: number) => {
      if (typeof acc === 'string') {
        return {
          index: idx,
          address: acc,
          isSigner: idx === 0,
          isWritable: true,
        };
      }
      return {
        index: idx,
        address: acc.pubkey || acc.address || `Account-${idx}`,
        isSigner: Boolean(acc.signer),
        isWritable: Boolean(acc.writable),
        owner: acc.owner,
      };
    });

    const getAccountAddress = (indexOrObj: any): string => {
      if (typeof indexOrObj === 'number') {
        return accounts[indexOrObj]?.address || `Account #${indexOrObj}`;
      }
      if (typeof indexOrObj === 'string') return indexOrObj;
      return indexOrObj?.pubkey || indexOrObj?.address || 'Unknown';
    };

    // Scan top-level instructions for ComputeBudget SetComputeUnitLimit
    const topInstructionsRaw = message?.instructions ?? [];
    for (const ix of topInstructionsRaw) {
      const progId = ix.programId || (typeof ix.programIdIndex === 'number' ? getAccountAddress(ix.programIdIndex) : '');
      if (progId === 'ComputeBudget111111111111111111111111111111') {
        if (ix.parsed?.type === 'setComputeUnitLimit') {
          const limit = Number(ix.parsed?.info?.units);
          if (!isNaN(limit) && limit > 0) cuLimit = limit;
        } else if (typeof ix.data === 'string') {
          // Fallback binary decode for setComputeUnitLimit: discriminator 0x02
          try {
            const buf = Buffer.from(ix.data, 'base64');
            if (buf.length >= 5 && buf[0] === 2) {
              const limit = buf.readUInt32LE(1);
              if (limit > 0) cuLimit = limit;
            }
          } catch {
            // ignore
          }
        }
      }
    }

    const cuPercentage = cuLimit > 0 ? Math.min(100, (cuUsed / cuLimit) * 100) : 0;

    // Parse Balance Changes (SOL & Tokens)
    const preBalances: number[] = rawTx.meta?.preBalances ?? [];
    const postBalances: number[] = rawTx.meta?.postBalances ?? [];
    const preToken: any[] = rawTx.meta?.preTokenBalances ?? [];
    const postToken: any[] = rawTx.meta?.postTokenBalances ?? [];

    const tokenDeltasByAccount = new Map<number, string[]>();

    // Calculate token deltas by account index
    for (const post of postToken) {
      const pre = preToken.find(
        p => p.accountIndex === post.accountIndex && p.mint === post.mint
      );
      const postAmt = Number(post.uiTokenAmount?.uiAmountString || post.uiTokenAmount?.uiAmount || 0);
      const preAmt = pre ? Number(pre.uiTokenAmount?.uiAmountString || pre.uiTokenAmount?.uiAmount || 0) : 0;
      const diff = postAmt - preAmt;
      if (Math.abs(diff) > 0.0000000001) {
        const symbol = post.uiTokenAmount?.symbol || `${post.mint.slice(0, 4)}...${post.mint.slice(-4)}`;
        const sign = diff > 0 ? '+' : '';
        const entry = `${sign}${diff.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${symbol}`;
        const arr = tokenDeltasByAccount.get(post.accountIndex) || [];
        arr.push(entry);
        tokenDeltasByAccount.set(post.accountIndex, arr);
      }
    }

    const balanceChanges: OrbBalanceChange[] = [];
    const maxAccLen = Math.max(preBalances.length, postBalances.length);

    for (let i = 0; i < maxAccLen; i++) {
      const pre = preBalances[i] ?? 0;
      const post = postBalances[i] ?? 0;
      const solDelta = (post - pre) / 1e9;
      const tokenDiffs = tokenDeltasByAccount.get(i);
      const tokenDelta = tokenDiffs ? tokenDiffs.join(', ') : undefined;

      // Only include accounts that had balance changes or was the primary fee payer
      if (Math.abs(solDelta) > 0.000000001 || tokenDelta || i === 0) {
        balanceChanges.push({
          account: getAccountAddress(i),
          isSigner: Boolean(accounts[i]?.isSigner),
          solDelta,
          tokenDelta,
        });
      }
    }

    // Top-level instructions
    const topInstructions: OrbInstructionDetail[] = topInstructionsRaw.map((ix: any, idx: number) => {
      const progId = ix.programId || (typeof ix.programIdIndex === 'number' ? getAccountAddress(ix.programIdIndex) : 'Unknown');
      const knownProg = getKnownProgram(progId);
      const progName = ix.program || knownProg.name;
      const instructionName = ix.parsed?.type || (ix.parsed ? 'parsed' : 'execute');

      const details: string[] = [];
      if (ix.parsed?.info && typeof ix.parsed.info === 'object') {
        for (const [k, v] of Object.entries(ix.parsed.info)) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            details.push(`${k}: ${v}`);
          }
        }
      } else if (ix.data) {
        details.push(`data: ${ix.data.slice(0, 32)}${ix.data.length > 32 ? '...' : ''}`);
      }

      return {
        index: idx,
        program: progName,
        programId: progId,
        instructionName,
        details,
      };
    });

    // Inner instructions
    const innerInstructions: OrbInnerInstructionDetail[] = [];
    const innerRawList: any[] = rawTx.meta?.innerInstructions ?? [];

    for (const innerGroup of innerRawList) {
      const parentIdx = innerGroup.index ?? 0;
      const subIxs = innerGroup.instructions ?? [];

      subIxs.forEach((subIx: any, subIdx: number) => {
        const progId = subIx.programId || (typeof subIx.programIdIndex === 'number' ? getAccountAddress(subIx.programIdIndex) : 'Unknown');
        const knownProg = getKnownProgram(progId);
        const progName = subIx.program || knownProg.name;
        const instructionName = subIx.parsed?.type || (subIx.parsed ? 'parsed' : 'execute');

        const details: string[] = [];
        if (subIx.parsed?.info && typeof subIx.parsed.info === 'object') {
          for (const [k, v] of Object.entries(subIx.parsed.info)) {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
              details.push(`${k}: ${v}`);
            }
          }
        } else if (subIx.data) {
          details.push(`data: ${subIx.data.slice(0, 24)}...`);
        }

        innerInstructions.push({
          indexStr: `#${parentIdx}.${subIdx}`,
          program: progName,
          programId: progId,
          instructionName,
          details,
        });
      });
    }

    const logs: string[] = rawTx.meta?.logMessages ?? [];

    return {
      signature,
      status,
      slot,
      blockTime,
      fee: feeSol,
      cuUsed,
      cuLimit,
      cuPercentage,
      version,
      balanceChanges,
      topInstructions,
      innerInstructions,
      logs,
      accounts,
      raw: rawTx,
    };
  }

  /**
   * Fetch complete developer-grade Program details
   */
  public async getProgram(programId: string): Promise<OrbProgramDetails> {
    const accInfo = await this.rpcCall<any>('getAccountInfo', [
      programId,
      { encoding: 'jsonParsed' },
    ]);

    if (!accInfo?.value) {
      throw new Error(`Program account '${programId}' not found on ${this.cluster}.`);
    }

    const val = accInfo.value;
    const executable = Boolean(val.executable);
    const owner = val.owner || 'Unknown';
    const known = getKnownProgram(programId);

    let authority = 'Unknown';
    let slot: number | null = null;
    let dataLen = val.space ?? (typeof val.data === 'string' ? val.data.length : 0);
    let securityTxt: 'Present' | 'Missing' = 'Missing';
    const upgradeHistory: string[] = [];

    // Check if Upgradeable BPF Loader
    if (owner === 'BPFLoaderUpgradeab1e11111111111111111111111') {
      const pDataAddr = val.data?.parsed?.info?.programData;
      if (pDataAddr) {
        try {
          const pDataAcc = await this.rpcCall<any>('getAccountInfo', [
            pDataAddr,
            { encoding: 'jsonParsed' },
          ]);
          if (pDataAcc?.value) {
            const pInfo = pDataAcc.value.data?.parsed?.info;
            authority = pInfo?.authority || 'Immutable';
            slot = pDataAcc.value.data?.parsed?.info?.slot ?? pDataAcc.value.slot ?? null;
            if (pDataAcc.value.space) dataLen = pDataAcc.value.space;

            // Check security.txt in base64 data if available
            const rawDataArray = pDataAcc.value.data;
            if (Array.isArray(rawDataArray) && typeof rawDataArray[0] === 'string') {
              const sampleBuf = Buffer.from(rawDataArray[0].slice(0, 100000), 'base64').toString('utf8');
              if (sampleBuf.includes('security.txt') || sampleBuf.includes('BEGIN SECURITY.TXT')) {
                securityTxt = 'Present';
              }
            }
          }
        } catch {
          // ignore
        }
      }
    } else if (owner.startsWith('BPFLoader')) {
      authority = 'Immutable';
    }

    // Check IDL
    let idlStatus: 'Available' | 'Not found' = 'Not found';
    const idlInstructions: string[] = [];
    let idlJson: any = null;

    // Try Anchor IDL registry endpoint
    try {
      const idlRes = await ofetch<any>(`https://api.apr.dev/api/v0/program/${encodeURIComponent(programId)}/idl`, {
        timeout: 5000,
      });
      if (idlRes?.instructions && Array.isArray(idlRes.instructions)) {
        idlStatus = 'Available';
        idlJson = idlRes;
        for (const ix of idlRes.instructions.slice(0, 15)) {
          if (ix.name) idlInstructions.push(ix.name);
        }
      }
    } catch {
      // ignore
    }

    // Recent activity check
    let txns24h = 0;
    let lastActivity: string | undefined = undefined;

    try {
      const sigs = await this.rpcCall<any[]>('getSignaturesForAddress', [
        programId,
        { limit: 20 },
      ]);
      if (Array.isArray(sigs) && sigs.length > 0) {
        txns24h = sigs.length;
        if (sigs[0].blockTime) {
          lastActivity = new Date(sigs[0].blockTime * 1000).toISOString();
        }
        for (const s of sigs.slice(0, 4)) {
          if (s.blockTime) {
            upgradeHistory.push(`Tx ${s.signature.slice(0, 8)}... at ${new Date(s.blockTime * 1000).toISOString()}`);
          }
        }
      }
    } catch {
      // ignore
    }

    if (upgradeHistory.length === 0) {
      upgradeHistory.push(slot ? `Deployed/Updated at slot #${slot}` : 'Deployed on-chain');
    }

    return {
      address: programId,
      name: known.name,
      label: known.label || 'On-Chain Program',
      executable,
      owner,
      slot,
      dataLen,
      authority,
      verified: known.verified ?? false,
      idlStatus,
      securityTxt,
      source: known.source || '—',
      idlInstructions,
      idlJson,
      recentActivity: {
        txns24h,
        lastActivity,
      },
      upgradeHistory,
      raw: val,
    };
  }

  /**
   * Fetch wallet account details
   */
  public async getWallet(address: string): Promise<OrbWalletDetails> {
    const accInfo = await this.rpcCall<any>('getAccountInfo', [
      address,
      { encoding: 'jsonParsed' },
    ]);

    const val = accInfo?.value;
    const lamports = val?.lamports ?? 0;
    const solBalance = lamports / 1e9;
    const owner = val?.owner || '11111111111111111111111111111111';
    const executable = Boolean(val?.executable);
    const dataLen = val?.space ?? 0;

    // Tokens
    const tokens: Array<{ mint: string; amount: number; symbol?: string; decimals: number }> = [];
    try {
      const tokenAccs = await this.rpcCall<any>('getTokenAccountsByOwner', [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' },
      ]);
      if (Array.isArray(tokenAccs?.value)) {
        for (const t of tokenAccs.value) {
          const info = t.account?.data?.parsed?.info;
          if (info?.tokenAmount) {
            const amount = Number(info.tokenAmount.uiAmount || 0);
            if (amount > 0) {
              tokens.push({
                mint: info.mint,
                amount,
                symbol: info.tokenAmount.symbol,
                decimals: info.tokenAmount.decimals,
              });
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // Recent tx count
    let recentTxCount = 0;
    try {
      const sigs = await this.rpcCall<any[]>('getSignaturesForAddress', [address, { limit: 10 }]);
      recentTxCount = Array.isArray(sigs) ? sigs.length : 0;
    } catch {
      // ignore
    }

    return {
      address,
      solBalance,
      owner,
      executable,
      lamports,
      dataLen,
      tokenCount: tokens.length,
      tokens,
      recentTxCount,
      raw: val,
    };
  }

  /**
   * Fetch token mint details
   */
  public async getToken(mint: string): Promise<OrbTokenDetails> {
    const accInfo = await this.rpcCall<any>('getAccountInfo', [
      mint,
      { encoding: 'jsonParsed' },
    ]);

    const val = accInfo?.value;
    if (!val) {
      throw new Error(`Token mint '${mint}' not found on ${this.cluster}.`);
    }

    const parsed = val.data?.parsed?.info;
    const decimals = parsed?.decimals ?? 0;
    const supplyRaw = parsed?.supply ? BigInt(parsed.supply) : 0n;
    const supply = Number(supplyRaw) / Math.pow(10, decimals);
    const mintAuthority = parsed?.mintAuthority || null;
    const freezeAuthority = parsed?.freezeAuthority || null;
    const isInitialized = Boolean(parsed?.isInitialized);
    const tokenProgram = val.owner || 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    const isToken2022 = tokenProgram === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

    // Parse Token-2022 extensions
    const extensionsList: string[] = [];
    let transferFeePercent: number | undefined = undefined;
    let hasPermanentDelegate = false;
    let hasTransferHook = false;

    if (Array.isArray(parsed?.extensions)) {
      for (const ext of parsed.extensions) {
        const extType = ext.extension || ext.type || 'extension';
        extensionsList.push(extType);
        if (extType === 'transferFeeConfig') {
          const bp = ext.state?.newerTransferFee?.transferFeeBasisPoints ?? ext.state?.transferFeeBasisPoints;
          if (bp != null) {
            transferFeePercent = Number(bp) / 100;
          }
        }
        if (extType === 'permanentDelegate') {
          hasPermanentDelegate = true;
        }
        if (extType === 'transferHook') {
          hasTransferHook = true;
        }
      }
    }

    // Security audit
    const security = {
      mintAuthorityStatus: mintAuthority ? ('Active' as const) : ('Revoked (Fixed Supply)' as const),
      freezeAuthorityStatus: freezeAuthority ? ('Active' as const) : ('Revoked (Safe)' as const),
      isToken2022,
      extensions: extensionsList,
      transferFeePercent,
      hasPermanentDelegate,
      hasTransferHook,
    };

    // Fetch market data and metadata from DexScreener
    let market: any = undefined;
    let tokenName: string | undefined = undefined;
    let tokenSymbol: string | undefined = undefined;

    try {
      const dsRes = await ofetch<any>(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`, {
        timeout: 5000,
      });
      if (Array.isArray(dsRes?.pairs) && dsRes.pairs.length > 0) {
        // Sort pairs by liquidity to get primary pool
        const sorted = [...dsRes.pairs].sort(
          (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        );
        const topPair = sorted[0];

        tokenName = topPair.baseToken?.name;
        tokenSymbol = topPair.baseToken?.symbol;

        const websites = topPair.info?.websites?.map((w: any) => w.url).filter(Boolean) || [];
        const socials = topPair.info?.socials?.map((s: any) => ({ type: s.type || 'link', url: s.url })).filter(Boolean) || [];

        market = {
          priceUsd: Number(topPair.priceUsd || 0),
          priceNative: Number(topPair.priceNative || 0),
          priceChange24h: topPair.priceChange?.h24,
          priceChange1h: topPair.priceChange?.h1,
          volume24h: topPair.volume?.h24,
          fdv: topPair.fdv,
          liquidityUsd: topPair.liquidity?.usd,
          dexId: topPair.dexId,
          pairAddress: topPair.pairAddress,
          txns24h: topPair.txns?.h24,
          websites,
          socials,
        };
      }
    } catch {
      // ignore market fetch errors
    }

    return {
      mint,
      name: tokenName,
      symbol: tokenSymbol,
      decimals,
      supply,
      mintAuthority,
      freezeAuthority,
      tokenProgram,
      isInitialized,
      security,
      market,
      raw: val,
    };
  }
}
