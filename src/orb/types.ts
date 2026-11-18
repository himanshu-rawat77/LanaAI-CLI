export type OrbCluster = 'mainnet' | 'devnet' | 'testnet';

export interface OrbBalanceChange {
  account: string;
  isSigner: boolean;
  solDelta: number;
  tokenDelta?: string;
}

export interface OrbInstructionDetail {
  index: number;
  program: string;
  programId: string;
  instructionName?: string;
  details: string[];
}

export interface OrbInnerInstructionDetail {
  indexStr: string;
  program: string;
  programId: string;
  instructionName?: string;
  cu?: number;
  details: string[];
}

export interface OrbAccountEntry {
  index: number;
  address: string;
  isSigner: boolean;
  isWritable: boolean;
  owner?: string;
}

export interface OrbTxDetails {
  signature: string;
  status: 'Success' | 'Failed';
  slot: number;
  blockTime: string;
  fee: number;
  cuUsed: number;
  cuLimit: number;
  cuPercentage: number;
  version: '0' | '1' | 'legacy';
  aiSummary?: string;
  balanceChanges: OrbBalanceChange[];
  topInstructions: OrbInstructionDetail[];
  innerInstructions: OrbInnerInstructionDetail[];
  logs: string[];
  accounts: OrbAccountEntry[];
  raw?: any;
}

export interface OrbProgramDetails {
  address: string;
  name: string;
  label: string;
  executable: boolean;
  owner: string;
  slot: number | null;
  dataLen: number;
  authority: string;
  verified: boolean;
  idlStatus: 'Available' | 'Not found';
  securityTxt: 'Present' | 'Missing';
  source: string;
  aiSummary?: string;
  idlInstructions: string[];
  idlJson?: any;
  recentActivity: {
    txns24h?: number;
    lastActivity?: string;
  };
  upgradeHistory: string[];
  raw?: any;
}

export interface OrbWalletDetails {
  address: string;
  solBalance: number;
  owner: string;
  executable: boolean;
  lamports: number;
  dataLen: number;
  tokenCount: number;
  tokens: Array<{
    mint: string;
    amount: number;
    symbol?: string;
    decimals: number;
  }>;
  recentTxCount: number;
  aiSummary?: string;
  raw?: any;
}

export interface OrbTokenMarketData {
  priceUsd?: number;
  priceNative?: number;
  priceChange24h?: number;
  priceChange1h?: number;
  volume24h?: number;
  fdv?: number;
  liquidityUsd?: number;
  dexId?: string;
  pairAddress?: string;
  txns24h?: { buys: number; sells: number };
  websites?: string[];
  socials?: Array<{ type: string; url: string }>;
}

export interface OrbTokenSecurityAudit {
  mintAuthorityStatus: 'Revoked (Fixed Supply)' | 'Active';
  freezeAuthorityStatus: 'Revoked (Safe)' | 'Active';
  isToken2022: boolean;
  extensions?: string[];
  transferFeePercent?: number;
  hasPermanentDelegate?: boolean;
  hasTransferHook?: boolean;
}

export interface OrbTokenDetails {
  mint: string;
  name?: string;
  symbol?: string;
  decimals: number;
  supply: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  tokenProgram: string;
  isInitialized: boolean;
  security: OrbTokenSecurityAudit;
  market?: OrbTokenMarketData;
  aiSummary?: string;
  raw?: any;
}
