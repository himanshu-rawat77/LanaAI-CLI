export interface LanaConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  defaultFormat?: 'table' | 'json' | 'md' | 'csv';
  color?: boolean;
  allowCustomHost?: boolean;
}

export interface WatchlistItem {
  address: string;
  label?: string;
  tags?: string[];
  addedAt: string;
  notes?: string;
}

export interface Counterparty {
  address: string;
  label?: string;
  txCount: number;
  volumeSol: number;
  direction: 'IN' | 'OUT' | 'BOTH';
}

export interface FundingSource {
  address: string;
  label?: string;
  txSignature?: string;
  amountSol?: number;
  timestamp?: string;
}

export interface WalletProfile {
  address: string;
  riskScore?: number; // 0 to 100, optional when evidence exists
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  labels: string[];
  narrative: string;
  firstActivity?: string;
  lastActivity?: string;
  solBalance: number;
  tokenCount: number;
  totalTxCount: number;
  fundingSource?: FundingSource;
  topCounterparties: Counterparty[];
  behavioralSignals: string[];
}

export interface MoneyMovement {
  token: string;
  symbol: string;
  amount: number;
  from: string;
  fromLabel?: string;
  to: string;
  toLabel?: string;
  usdValue?: number;
}

export interface ProgramInteraction {
  programId: string;
  programName?: string;
  action?: string;
}

export interface TransactionExplainer {
  signature: string;
  timestamp?: string;
  type?: string;
  feeSol?: number;
  status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  plainEnglish: string;
  moneyMovements: MoneyMovement[];
  programInteractions: ProgramInteraction[];
  signers: string[];
  onChainError?: string | null;
}

export interface FundFlowNode {
  address: string;
  label?: string;
  depth: number;
  amountSol: number;
  type: 'INFLOW' | 'OUTFLOW' | 'ROOT';
  token?: string;
  txCount?: number;
  children?: FundFlowNode[];
}

export interface FundFlowSummary {
  rootAddress: string;
  depth: number;
  totalInflowSol?: number;
  totalOutflowSol?: number;
  directInflows: FundFlowNode[];
  directOutflows: FundFlowNode[];
  notableHops: string[];
}

export interface WalletComparison {
  addresses: string[];
  profiles: WalletProfile[];
  similarityScore?: number; // 0 to 100, undefined if not computed
  commonCounterparties: Array<{
    address: string;
    label?: string;
    interactionMap: Record<string, number>;
  }>;
  behavioralDifferences: string[];
  overlapSummary: string;
  sharedFundingSource?: string;
}

export interface DossierReport {
  caseId: string;
  targetAddress: string;
  generatedAt: string;
  classification: string;
  executiveSummary: string;
  riskAssessment?: {
    score?: number;
    level?: string;
    factors: string[];
  };
  clusterAnalysis?: {
    primaryCluster: string;
    associatedEntities: Array<{
      address: string;
      label: string;
      confidence: number;
      relationship: string;
    }>;
  };
  fundOrigins?: {
    originAddress: string;
    originLabel?: string;
    firstBridgeOrCex?: string;
    initialCapitalSol?: number;
    initialDate?: string;
  };
  chronology?: Array<{
    timestamp: string;
    event: string;
    significance?: string;
  }>;
  conclusion: string;
}

export interface AskSessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface AskResponse {
  sessionId?: string;
  question: string;
  answer: string;
  citations?: string[];
  relatedAddresses?: string[];
}

export type OutputFormat = 'table' | 'json' | 'csv' | 'md';
