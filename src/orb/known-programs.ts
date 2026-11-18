export interface KnownProgramInfo {
  name: string;
  label?: string;
  verified?: boolean;
  source?: string;
}

export const KNOWN_PROGRAMS: Record<string, KnownProgramInfo> = {
  '11111111111111111111111111111111': {
    name: 'System Program',
    label: 'Native System',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    name: 'SPL Token Program',
    label: 'Core Token',
    verified: true,
    source: 'https://github.com/solana-labs/solana-program-library',
  },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': {
    name: 'Token-2022 Program',
    label: 'Token Extensions',
    verified: true,
    source: 'https://github.com/solana-labs/solana-program-library',
  },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': {
    name: 'Associated Token Account Program',
    label: 'ATA Program',
    verified: true,
    source: 'https://github.com/solana-labs/solana-program-library',
  },
  'ComputeBudget111111111111111111111111111111': {
    name: 'Compute Budget Program',
    label: 'Core Runtime',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'BPFLoaderUpgradeab1e11111111111111111111111': {
    name: 'BPF Upgradeable Loader',
    label: 'Native Loader',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'BPFLoader2111111111111111111111111111111111': {
    name: 'BPF Loader v2',
    label: 'Native Loader',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'BPFLoader1111111111111111111111111111111111': {
    name: 'BPF Loader v1',
    label: 'Native Loader',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'Vote111111111111111111111111111111111111111': {
    name: 'Vote Program',
    label: 'Consensus Validator',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'Stake11111111111111111111111111111111111111': {
    name: 'Stake Program',
    label: 'Native Staking',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'AddressLookupTab1e1111111111111111111111111': {
    name: 'Address Lookup Table Program',
    label: 'v0 Runtime',
    verified: true,
    source: 'https://github.com/solana-labs/solana',
  },
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr': {
    name: 'Memo Program',
    label: 'Utility Memo',
    verified: true,
    source: 'https://github.com/solana-labs/solana-program-library',
  },
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': {
    name: 'Metaplex Token Metadata',
    label: 'NFT Standard',
    verified: true,
    source: 'https://github.com/metaplex-foundation/metaplex-program-library',
  },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    name: 'Jupiter v6 Aggregator',
    label: 'DEX Routing',
    verified: true,
    source: 'https://github.com/jup-ag',
  },
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB': {
    name: 'Jupiter v4 Aggregator',
    label: 'DEX Routing',
    verified: true,
    source: 'https://github.com/jup-ag',
  },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': {
    name: 'Orca Whirlpool',
    label: 'Concentrated AMM',
    verified: true,
    source: 'https://github.com/orca-so/whirlpools',
  },
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    name: 'Raydium AMM v4',
    label: 'Constant Product DEX',
    verified: true,
    source: 'https://github.com/raydium-io/raydium-amm',
  },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': {
    name: 'Raydium CLMM',
    label: 'Concentrated Liquidity',
    verified: true,
    source: 'https://github.com/raydium-io/raydium-clmm',
  },
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C': {
    name: 'Raydium CPMM',
    label: 'Constant Product',
    verified: true,
    source: 'https://github.com/raydium-io/raydium-cpmm',
  },
  'Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB': {
    name: 'Meteora Dynamic Pools',
    label: 'Dynamic AMM',
    verified: true,
    source: 'https://github.com/mercurial-finance',
  },
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo': {
    name: 'Meteora DLMM',
    label: 'Discretized Liquidity',
    verified: true,
    source: 'https://github.com/mercurial-finance',
  },
  'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY': {
    name: 'Phoenix DEX',
    label: 'Limit Order Book',
    verified: true,
    source: 'https://github.com/Ellipsis-Labs/phoenix-v1',
  },
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX': {
    name: 'OpenBook v1',
    label: 'Orderbook DEX',
    verified: true,
    source: 'https://github.com/openbook-dex/program',
  },
  'opnb2NxiMQrqWYRxQUtEN8yFiqMTYhsjyMmJazEsSc4': {
    name: 'OpenBook v2',
    label: 'Orderbook DEX',
    verified: true,
    source: 'https://github.com/openbook-dex/openbook-v2',
  },
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD': {
    name: 'Marinade Staking Program',
    label: 'Liquid Staking',
    verified: true,
    source: 'https://github.com/marinade-finance',
  },
  'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb': {
    name: 'Jito Stake Pool',
    label: 'MEV Liquid Staking',
    verified: true,
    source: 'https://github.com/jito-foundation',
  },
  'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH': {
    name: 'Pyth Oracle v2',
    label: 'Price Oracle',
    verified: true,
    source: 'https://github.com/pyth-network/pyth-client-js',
  },
  'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f': {
    name: 'Switchboard v2',
    label: 'Decentralized Oracle',
    verified: true,
    source: 'https://github.com/switchboard-xyz/sbv2-solana',
  },
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH': {
    name: 'Drift v2',
    label: 'Perpetuals DEX',
    verified: true,
    source: 'https://github.com/drift-labs/protocol-v2',
  },
  'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD': {
    name: 'Kamino Lending',
    label: 'Lending Market',
    verified: true,
    source: 'https://github.com/Kamino-Finance',
  },
  'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN': {
    name: 'Tensor Swap',
    label: 'NFT AMM',
    verified: true,
    source: 'https://github.com/tensor-foundation',
  },
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K': {
    name: 'Magic Eden v2',
    label: 'NFT Marketplace',
    verified: true,
    source: 'https://magiceden.io',
  },
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': {
    name: 'Pump.fun Bonding Curve',
    label: 'Meme Launchpad',
    verified: true,
    source: 'https://pump.fun',
  },
};

export function getKnownProgram(programId: string): KnownProgramInfo {
  return (
    KNOWN_PROGRAMS[programId] || {
      name: `Program (${programId.slice(0, 4)}...${programId.slice(-4)})`,
      label: 'Custom Program',
      verified: false,
    }
  );
}
