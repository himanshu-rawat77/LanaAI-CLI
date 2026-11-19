import { ofetch } from 'ofetch';
import type {
  WalletProfile,
  TransactionExplainer,
  FundFlowSummary,
  WalletComparison,
  DossierReport,
  AskResponse,
  AskSessionMessage,
  MoneyMovement,
  ProgramInteraction,
} from './types.js';
import { getApiKey, loadConfig, getSessionMessages, appendSessionMessages } from './utils/config.js';

export interface LanaClientOptions {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  verbose?: boolean;
  allowCustomHost?: boolean;
}

export function isTrustedHeliusHost(urlOrHost: string): boolean {
  try {
    const parsed = urlOrHost.startsWith('http://') || urlOrHost.startsWith('https://')
      ? new URL(urlOrHost)
      : new URL(`https://${urlOrHost}`);
    const host = parsed.hostname.toLowerCase();
    const trustedSuffixes = [
      'helius-rpc.com',
      'helius.dev',
      'helius-experiments.com',
      'orbmarkets.io',
    ];
    return trustedSuffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export interface LanaRawResult {
  text: string;
  toolResults: any[];
  raw: any;
}

export class LanaClient {
  private apiKey: string;
  private endpoint: string;
  private model: string;
  private verbose: boolean;
  private allowCustomHost: boolean;

  constructor(options: LanaClientOptions = {}) {
    const key = getApiKey(options.apiKey);
    if (!key) {
      throw new Error('No API key configured. Run `lana login` or set LANA_API_KEY to continue.');
    }
    this.apiKey = key;
    const config = loadConfig();

    let rawEndpoint =
      options.endpoint ||
      process.env.LANA_API_URL ||
      config.endpoint ||
      'https://beta.helius-rpc.com/v1/lana/messages';

    // Strip quotes and trailing slash
    rawEndpoint = rawEndpoint.replace(/^["']|["']$/g, '').replace(/\/+$/, '');

    // If host provided without path, append /v1/messages for Lana API
    if (
      !rawEndpoint.includes('/v1/messages') &&
      !rawEndpoint.includes('/chat/completions') &&
      !rawEndpoint.includes('/v1/lana')
    ) {
      this.endpoint = `${rawEndpoint}/v1/messages`;
    } else {
      this.endpoint = rawEndpoint;
    }

    this.allowCustomHost = Boolean(
      options.allowCustomHost ||
      config.allowCustomHost === true
    );

    // Explicit opt-in verification before sending credentials to custom hosts
    // Local project .env must NOT grant custom host access; requires explicit CLI flag or global ~/.config/lana/config.json
    if (!isTrustedHeliusHost(this.endpoint) && !this.allowCustomHost) {
      let hostname = this.endpoint;
      try {
        hostname = new URL(this.endpoint).hostname;
      } catch {}
      throw new Error(
        `Refusing to send API credentials to custom/untrusted endpoint "${hostname}" without explicit opt-in. Pass --allow-custom-host or configure "allowCustomHost: true" in global lana config.`
      );
    }

    this.model =
      options.model ||
      process.env.LANA_MODEL ||
      config.model ||
      'lana-fast';
    this.verbose = Boolean(options.verbose);
  }

  private extractTextFromResponse(response: any): string {
    if (!response) return '';
    if (typeof response === 'string') return response;

    // Anthropic / Lana content blocks: [{ type: 'text', text: '...' }]
    if (Array.isArray(response.content)) {
      return response.content
        .filter((c: any) => c.type === 'text' && c.text)
        .map((c: any) => c.text)
        .join('\n\n');
    }

    if (typeof response.content === 'string') {
      return response.content;
    }

    // OpenAI choices format
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    if (response.result && typeof response.result === 'string') {
      return response.result;
    }

    return '';
  }

  private extractJson<T>(text: string): T | null {
    if (!text) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[1] || match[0]) as T;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private getAuthHeaders(): Record<string, string> {
    const isAuthorized = isTrustedHeliusHost(this.endpoint) || this.allowCustomHost;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (isAuthorized && this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
      headers['x-api-key'] = this.apiKey;
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  private async callLanaRaw(systemPrompt: string, userPrompt: string): Promise<LanaRawResult> {
    try {
      const response = await ofetch<any>(this.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt },
          ],
        },
        timeout: 60000,
      });

      const text = this.extractTextFromResponse(response);
      const toolResults: any[] = [];

      if (Array.isArray(response?.content)) {
        for (const block of response.content) {
          if (block.type === 'tool_result' && block.content) {
            let parsed = block.content;
            if (typeof block.content === 'string') {
              try {
                parsed = JSON.parse(block.content);
              } catch {
                parsed = block.content;
              }
            }
            toolResults.push(parsed);
          }
        }
      }

      return { text, toolResults, raw: response };
    } catch (err: any) {
      if (this.verbose) {
        console.error('[lana API error]', err.data || err.message || err);
      }

      if (err?.status === 429) {
        throw new Error('Lana AI rate limit reached (HTTP 429). Please wait a few moments.');
      }
      if (err?.status === 401 || err?.status === 403) {
        throw new Error(`Authentication failed (${err.status}): Check your API key with \`lana config get\`.`);
      }
      if (err?.status === 404) {
        throw new Error(`API endpoint not found (HTTP 404) at ${this.endpoint}. Please verify endpoint in config.`);
      }

      throw new Error(`Lana API request failed: ${err.data?.error?.message || err.data?.message || err.message || 'Unknown error'}`);
    }
  }

  private normalizeProfile(raw: any, address: string, narrativeFallback?: string): WalletProfile {
    const rawScore = raw?.riskScore != null ? raw.riskScore : raw?.risk;
    const riskScore =
      rawScore != null && !isNaN(Number(rawScore)) ? Number(rawScore) : undefined;
    const riskLevel =
      raw?.riskLevel ||
      (riskScore != null
        ? (riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW')
        : undefined);

    const labels = Array.isArray(raw?.labels)
      ? raw.labels
      : typeof raw?.labels === 'string'
      ? [raw.labels]
      : [];

    return {
      address: raw?.address || address,
      riskScore,
      riskLevel,
      labels,
      narrative: raw?.narrative || raw?.summary || narrativeFallback || 'No narrative provided by forensic analysis.',
      firstActivity: raw?.firstActivity || raw?.firstActive || undefined,
      lastActivity: raw?.lastActivity || raw?.lastActive || undefined,
      solBalance: Number(raw?.solBalance ?? raw?.balance ?? 0),
      tokenCount: Number(raw?.tokenCount ?? raw?.tokens ?? 0),
      totalTxCount: Number(
        raw?.totalTxCount ?? raw?.txCount ?? raw?.totalTransactions ?? raw?.transactions ?? 0
      ),
      fundingSource: raw?.fundingSource || undefined,
      topCounterparties: Array.isArray(raw?.topCounterparties)
        ? raw.topCounterparties.map((cp: any) => ({
            address: cp.address || 'Unknown',
            label: cp.label || 'Counterparty',
            txCount: Number(cp.txCount ?? 0),
            volumeSol: Number(cp.volumeSol ?? cp.volume ?? 0),
            direction: cp.direction || 'BOTH',
          }))
        : [],
      behavioralSignals: Array.isArray(raw?.behavioralSignals) ? raw.behavioralSignals : labels,
    };
  }

  public async tx(signature: string): Promise<TransactionExplainer> {
    const systemPrompt = `You are Helius Lana AI, an expert Solana transaction explainer.
Analyze the Solana transaction signature and break down the status, fee, type, signers, money movements, and plain-English explanation.`;

    const userPrompt = `Explain Solana transaction signature: ${signature}`;
    const { text, toolResults, raw } = await this.callLanaRaw(systemPrompt, userPrompt);

    // 1. Check if toolResult has an explicit not-found error
    const errorTool = toolResults.find(
      tr => tr && typeof tr === 'object' && (tr.found === false || (tr.error && !tr.found))
    );
    if (errorTool && errorTool.found === false) {
      throw new Error(errorTool.error || `Transaction ${signature} not found on Solana mainnet.`);
    }

    // 2. Check if Lana text indicates an invalid signature
    if (
      text &&
      (text.includes('is not a valid Solana transaction signature') ||
        text.includes("isn't a valid Solana transaction signature") ||
        (text.includes('Transaction not found on mainnet') && toolResults.length === 0))
    ) {
      throw new Error(text.trim());
    }

    return this.parseTxBreakdown(signature, { text, toolResults, raw });
  }

  public parseTxBreakdown(signature: string, result: { text?: string; toolResults?: any[]; raw?: any }): TransactionExplainer {
    const text = result.text || '';
    const toolResults = result.toolResults || [];
    const raw = result.raw || null;

    // 3. Find parsed transaction toolResult (e.g. from Helius parse_transaction tool)
    const txTool = toolResults.find(
      tr => tr && typeof tr === 'object' && (tr.signature || tr.nativeTransfers || tr.type)
    );

    // 4. Try extracting direct JSON from response or text
    let jsonMatch: any = null;
    if (raw && (raw.signature || raw.plainEnglish)) {
      jsonMatch = raw;
    } else {
      jsonMatch = this.extractJson<any>(text);
    }

    const base = jsonMatch || txTool || {};

    const cleanSig = base.signature || signature;
    const type =
      base.type ||
      text.match(/\*\*Type:\*\*\s*([^\n]+)/i)?.[1]?.trim() ||
      'Solana Transaction';

    const status: 'SUCCESS' | 'FAILED' | 'UNKNOWN' =
      base.status?.toUpperCase() === 'FAILED' ||
      text.match(/\*\*Status:\*\*\s*([^\n]+)/i)?.[1]?.toLowerCase().includes('fail')
        ? 'FAILED'
        : base.status?.toUpperCase() === 'SUCCESS' ||
          text.match(/\*\*Status:\*\*\s*([^\n]+)/i)?.[1]?.toLowerCase().includes('success')
        ? 'SUCCESS'
        : 'UNKNOWN';

    let feeSol: number | undefined = undefined;
    if (base.fee != null) {
      feeSol = Number(base.fee);
    } else if (base.feeSol != null) {
      feeSol = Number(base.feeSol);
    } else {
      const feeMatch = text.match(/\*\*Fee:\*\*\s*([\d.]+)/i);
      if (feeMatch) feeSol = parseFloat(feeMatch[1]);
    }

    let timestamp: string | undefined =
      base.date ||
      (base.timestamp
        ? typeof base.timestamp === 'number'
          ? new Date(base.timestamp * 1000).toISOString()
          : String(base.timestamp)
        : undefined);
    const tsMatch = text.match(/\*\*Timestamp:\*\*\s*([^\n(]+)/i);
    if (tsMatch && !timestamp) {
      timestamp = tsMatch[1].trim();
    }

    const signers: string[] = [];
    if (Array.isArray(base.signers)) {
      signers.push(...base.signers);
    } else if (base.feePayer) {
      signers.push(base.feePayer);
    } else {
      const signerMatch = text.match(/\*\*(?:Fee payer|Signers?)[^:]*:\*\*\s*([^\n]+)/i);
      if (signerMatch) {
        signers.push(
          ...signerMatch[1]
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        );
      }
    }

    const moneyMovements: MoneyMovement[] = [];
    if (Array.isArray(base.moneyMovements)) {
      for (const m of base.moneyMovements) {
        moneyMovements.push({
          token: m.token || 'SOL',
          symbol: m.symbol || 'SOL',
          amount: Number(m.amount ?? 0),
          from: m.from || 'Unknown',
          fromLabel: m.fromLabel,
          to: m.to || 'Unknown',
          toLabel: m.toLabel,
          usdValue: m.usdValue,
        });
      }
    }
    if (Array.isArray(base.nativeTransfers)) {
      for (const nt of base.nativeTransfers) {
        moneyMovements.push({
          token: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          amount: (nt.amount ?? 0) / 1e9,
          from: nt.fromUserAccount || 'Unknown',
          to: nt.toUserAccount || 'Unknown',
        });
      }
    }
    if (Array.isArray(base.tokenTransfers)) {
      for (const tt of base.tokenTransfers) {
        moneyMovements.push({
          token: tt.mint || 'Token',
          symbol: tt.tokenSymbol || 'SPL',
          amount: Number(tt.tokenAmount ?? 0),
          from: tt.fromUserAccount || 'Unknown',
          to: tt.toUserAccount || 'Unknown',
        });
      }
    }

    const programInteractions: ProgramInteraction[] = [];
    if (Array.isArray(base.programInteractions)) {
      programInteractions.push(...base.programInteractions);
    } else if (Array.isArray(base.instructions)) {
      for (const ix of base.instructions) {
        programInteractions.push({
          programId: ix.programId || 'Unknown',
          programName: ix.programName,
          action: ix.type || 'Instruction',
        });
      }
    }

    // Extract plain-English explanation
    let plainEnglish = base.plainEnglish || base.description;
    if (!plainEnglish && text) {
      const peMatch = text.match(/\*\*Plain English:\*\*\s*([\s\S]+)/i);
      plainEnglish = peMatch ? peMatch[1].trim() : text.trim();
    }
    if (!plainEnglish) {
      plainEnglish = 'Transaction executed on Solana mainnet.';
    }

    return {
      signature: cleanSig,
      timestamp,
      type,
      feeSol,
      status,
      plainEnglish,
      moneyMovements,
      programInteractions,
      signers,
    };
  }

  public async lookup(address: string): Promise<WalletProfile> {
    const systemPrompt = `You are Helius Lana AI, an expert Solana on-chain forensic investigator.
Analyze the target Solana wallet address and output a structured profile covering holdings, activity, risk level, labels, narrative, and counterparties.`;

    const userPrompt = `Investigate Solana wallet address: ${address}`;
    const { text, toolResults, raw } = await this.callLanaRaw(systemPrompt, userPrompt);

    // 1. Check for errors
    const errorTool = toolResults.find(tr => tr && typeof tr === 'object' && tr.found === false);
    if (errorTool && errorTool.error) {
      throw new Error(errorTool.error);
    }
    if (text && (text.includes('is not a valid Solana address') || text.includes('Account not found'))) {
      throw new Error(text.trim());
    }

    // 2. Direct JSON check
    let jsonMatch: any = null;
    if (raw && (raw.address || raw.solBalance !== undefined || raw.riskScore !== undefined)) {
      jsonMatch = raw;
    } else {
      jsonMatch = this.extractJson<any>(text);
    }

    if (jsonMatch && typeof jsonMatch === 'object') {
      return this.normalizeProfile(jsonMatch, address, text);
    }

    // 3. Assemble from toolResults (lookup_addresses, get_wallet_summary, get_wallet_interactions)
    const summaryTool = toolResults.find(
      tr => tr && typeof tr === 'object' && (tr.sol || tr.totalUsd !== undefined)
    );
    const addressTool = toolResults.find(
      tr => tr && typeof tr === 'object' && tr.lamports !== undefined
    );
    const interactionsTool = toolResults.find(
      tr => tr && typeof tr === 'object' && (tr.counterparties || tr.interactions)
    );

    const solBalance =
      summaryTool?.sol?.amount ??
      (addressTool?.lamports ? addressTool.lamports / 1e9 : 0);
    const tokenCount = Array.isArray(summaryTool?.topTokens) ? summaryTool.topTokens.length : 0;
    const totalTxCount = summaryTool?.recentTransactions?.length || 0;

    // Extract labels and classification from text
    const labels: string[] = [];
    const classMatch = text.match(/\*\*Classification:\s*([^*]+)\*\*/i);
    if (classMatch) {
      labels.push(classMatch[1].trim());
    } else if (addressTool?.addressKind) {
      labels.push(addressTool.addressKind);
    }

    // Estimate risk ONLY if explicit evidence/score exists; otherwise keep unknown
    let riskScore: number | undefined = undefined;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN' | undefined = undefined;

    const scoreMatch =
      text.match(/\*\*Risk\s*(?:Score)?:\*\*\s*(\d{1,3})(?:\/100)?/i) ||
      text.match(/\bRisk\s*Score:\s*(\d{1,3})(?:\/100)?/i);
    if (scoreMatch) {
      riskScore = parseInt(scoreMatch[1], 10);
      riskLevel =
        riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW';
    } else {
      const levelMatch = text.match(/\*\*Risk\s*Level:\*\*\s*(CRITICAL|HIGH|MEDIUM|LOW|UNKNOWN)/i);
      if (levelMatch) {
        riskLevel = levelMatch[1].toUpperCase() as any;
      }
    }

    const narrative = text || `Analysis completed for ${address}.`;

    const topCounterparties: any[] = [];
    if (interactionsTool) {
      const cps = interactionsTool.counterparties || interactionsTool.interactions || [];
      if (Array.isArray(cps)) {
        for (const cp of cps.slice(0, 5)) {
          topCounterparties.push({
            address: cp.address || 'Unknown',
            label: cp.label || cp.tag || 'Counterparty',
            txCount: cp.txCount || cp.count || 1,
            volumeSol: cp.volumeSol || cp.solAmount || 0,
            direction: cp.direction || 'BOTH',
          });
        }
      }
    }

    return {
      address,
      riskScore,
      riskLevel,
      labels: labels.length > 0 ? labels : ['Solana Account'],
      narrative,
      firstActivity: summaryTool?.firstActivity || undefined,
      lastActivity: summaryTool?.generatedAt || undefined,
      solBalance,
      tokenCount,
      totalTxCount,
      fundingSource: undefined,
      topCounterparties,
      behavioralSignals: labels.length > 0 ? labels : ['Standard On-Chain Activity'],
    };
  }

  public async flow(address: string, depth = 2): Promise<FundFlowSummary> {
    const systemPrompt = `You are Helius Lana AI, an expert in Solana graph fund flow tracing.
Trace multi-hop inflows and outflows for the given target address up to depth ${depth}.`;

    const userPrompt = `Trace fund flows for Solana address ${address} with depth ${depth}`;
    const { text, raw } = await this.callLanaRaw(systemPrompt, userPrompt);

    const jsonMatch = (raw && raw.rootAddress) ? raw : this.extractJson<any>(text);
    if (jsonMatch && typeof jsonMatch === 'object') {
      const inflow =
        jsonMatch.totalInflowSol != null
          ? Number(jsonMatch.totalInflowSol)
          : jsonMatch.inflowSol != null
          ? Number(jsonMatch.inflowSol)
          : undefined;
      const outflow =
        jsonMatch.totalOutflowSol != null
          ? Number(jsonMatch.totalOutflowSol)
          : jsonMatch.outflowSol != null
          ? Number(jsonMatch.outflowSol)
          : undefined;

      return {
        rootAddress: jsonMatch.rootAddress || address,
        depth: Number(jsonMatch.depth ?? depth),
        totalInflowSol: inflow,
        totalOutflowSol: outflow,
        directInflows: Array.isArray(jsonMatch.directInflows) ? jsonMatch.directInflows : [],
        directOutflows: Array.isArray(jsonMatch.directOutflows) ? jsonMatch.directOutflows : [],
        notableHops: Array.isArray(jsonMatch.notableHops) ? jsonMatch.notableHops : [],
      };
    }

    // Fallback using text narrative (keep unavailable measurements undefined)
    return {
      rootAddress: address,
      depth,
      totalInflowSol: undefined,
      totalOutflowSol: undefined,
      directInflows: [],
      directOutflows: [],
      notableHops: text ? [text.slice(0, 300)] : [],
    };
  }

  public async compare(addresses: string[]): Promise<WalletComparison> {
    const systemPrompt = `You are Helius Lana AI. Perform a side-by-side forensic comparison of the provided Solana wallet addresses.`;
    const userPrompt = `Compare these Solana addresses: ${addresses.join(', ')}`;
    const { text, raw } = await this.callLanaRaw(systemPrompt, userPrompt);

    const jsonMatch = (raw && raw.profiles) ? raw : this.extractJson<any>(text);
    if (jsonMatch && typeof jsonMatch === 'object') {
      const normAddresses = Array.isArray(jsonMatch.addresses) && jsonMatch.addresses.length > 0 ? jsonMatch.addresses : addresses;
      let profiles: WalletProfile[] = [];
      if (Array.isArray(jsonMatch.profiles) && jsonMatch.profiles.length > 0) {
        profiles = jsonMatch.profiles.map((p: any, idx: number) => {
          const addr = normAddresses[idx] || (p && p.address) || `Wallet-${idx + 1}`;
          return this.normalizeProfile(p, addr, text);
        });
      } else {
        profiles = normAddresses.map((addr: string) => this.normalizeProfile({}, addr, text));
      }

      const simScore =
        jsonMatch.similarityScore != null
          ? Number(jsonMatch.similarityScore)
          : jsonMatch.similarity != null
          ? Number(jsonMatch.similarity)
          : undefined;

      return {
        addresses: normAddresses,
        profiles,
        similarityScore: simScore,
        commonCounterparties: Array.isArray(jsonMatch.commonCounterparties) ? jsonMatch.commonCounterparties : [],
        behavioralDifferences: Array.isArray(jsonMatch.behavioralDifferences) ? jsonMatch.behavioralDifferences : [],
        overlapSummary: jsonMatch.overlapSummary || jsonMatch.summary || text || 'Analysis complete.',
        sharedFundingSource: jsonMatch.sharedFundingSource || undefined,
      };
    }

    // Fallback using text narrative (keep similarityScore undefined, no fixed 50)
    const profiles = addresses.map(addr => this.normalizeProfile({}, addr, text));
    return {
      addresses,
      profiles,
      similarityScore: undefined,
      commonCounterparties: [],
      behavioralDifferences: [],
      overlapSummary: text || 'Comparative analysis complete.',
    };
  }

  public async dossier(address: string): Promise<DossierReport> {
    const systemPrompt = `You are Helius Lana AI, a hard-boiled but rigorous On-Chain Noir forensic detective analyzing Solana blockchain records.
Produce an in-depth case file report on the target address.`;

    const userPrompt = `Compile a full forensic dossier for target Solana address: ${address}`;
    const { text, raw } = await this.callLanaRaw(systemPrompt, userPrompt);

    const jsonMatch = (raw && raw.caseId) ? raw : this.extractJson<any>(text);
    if (jsonMatch && typeof jsonMatch === 'object') {
      return {
        caseId: jsonMatch.caseId || `CASE-${Date.now().toString(36).toUpperCase()}`,
        targetAddress: jsonMatch.targetAddress || address,
        generatedAt: jsonMatch.generatedAt || new Date().toISOString(),
        classification: jsonMatch.classification || 'UNCLASSIFIED',
        executiveSummary: jsonMatch.executiveSummary || jsonMatch.summary || text || 'Case file compiled.',
        riskAssessment: jsonMatch.riskAssessment,
        clusterAnalysis: jsonMatch.clusterAnalysis,
        fundOrigins: jsonMatch.fundOrigins,
        chronology: Array.isArray(jsonMatch.chronology) ? jsonMatch.chronology : [],
        conclusion: jsonMatch.conclusion || 'Investigation complete.',
      };
    }

    // Fallback using text narrative (keep riskAssessment and fixed findings undefined, no fake 20/100)
    return {
      caseId: `CASE-${Date.now().toString(36).toUpperCase()}`,
      targetAddress: address,
      generatedAt: new Date().toISOString(),
      classification: 'ON-CHAIN FORENSIC FILE',
      executiveSummary: text || `Comprehensive forensic case file compiled for ${address}.`,
      riskAssessment: undefined,
      clusterAnalysis: undefined,
      fundOrigins: undefined,
      chronology: [],
      conclusion: 'Investigation complete. Review executive summary for full behavioral findings.',
    };
  }

  public async ask(question: string, sessionId?: string): Promise<AskResponse> {
    const history: AskSessionMessage[] = sessionId ? getSessionMessages(sessionId) : [];
    const formattedHistory = history.map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content,
    }));

    try {
      const response = await ofetch<any>(this.endpoint, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: {
          model: this.model,
          max_tokens: 4096,
          system:
            'You are Helius Lana AI, a premier Solana conversational on-chain intelligence assistant. You provide precise, highly knowledgeable answers citing Solana blockchain mechanisms, program accounts, DEX liquidity, RPC telemetry, exploit forensics, and transaction dynamics.',
          messages: [
            ...formattedHistory,
            { role: 'user', content: question },
          ],
        },
        timeout: 60000,
      });

      const answer = this.extractTextFromResponse(response);

      const citations: string[] = [];
      if (Array.isArray(response?.sources)) {
        for (const s of response.sources) {
          if (s.title && s.url) {
            citations.push(`${s.title} (${s.url})`);
          } else if (s.url) {
            citations.push(s.url);
          }
        }
      }

      if (sessionId) {
        appendSessionMessages(sessionId, question, answer);
      }

      return {
        sessionId,
        question,
        answer: answer.replace(/\{\{cite:\d+\}\}/g, ''),
        citations: citations.length > 0 ? citations.slice(0, 5) : ['Helius Lana Live Graph', 'Solana Mainnet Telemetry'],
      };
    } catch (err: any) {
      if (this.verbose) {
        console.error('[lana ask error]', err.data || err.message || err);
      }
      if (err?.status === 401 || err?.status === 403) {
        throw new Error(`Authentication failed (${err.status}): Check your API key with \`lana config get\`.`);
      }
      if (err?.status === 429) {
        throw new Error('Lana AI rate limit reached (HTTP 429). Please wait a few moments.');
      }
      throw new Error(`Lana AI query failed: ${err.data?.error?.message || err.data?.message || err.message || 'Unknown network error'}`);
    }
  }
}
