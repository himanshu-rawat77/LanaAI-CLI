import { LanaClient } from '../lana-client.js';

export class OrbAi {
  private client: LanaClient;

  constructor(client: LanaClient) {
    this.client = client;
  }

  public async getTxSummary(signature: string, details?: any): Promise<string> {
    const cleanSig = signature.trim().replace(/[^1-9A-HJ-NP-Za-km-z]/g, '');
    try {
      const explainer = await this.client.tx(cleanSig);
      const pe = explainer?.plainEnglish || '';
      if (
        pe &&
        !pe.includes("isn't a valid Solana transaction signature") &&
        !pe.includes("could not find a transaction") &&
        !pe.includes("malformed") &&
        !pe.includes("placeholder")
      ) {
        return pe;
      }
    } catch {
      // Fallback: ask Lana directly with parsed context
    }

    try {
      const prompt = `Summarize what this Solana transaction did in 1 to 3 clear, developer-friendly sentences.
Signature: ${cleanSig}
Status: ${details?.status || 'Unknown'}
Fee: ${details?.fee || 0} SOL
CU Used: ${details?.cuUsed || 0}
Top Instructions: ${details?.topInstructions?.map((i: any) => `${i.program}::${i.instructionName}`).join(', ') || 'None'}
Balance Changes: ${details?.balanceChanges?.map((b: any) => `${b.account}: SOL ${b.solDelta}, Token: ${b.tokenDelta || 'none'}`).slice(0, 5).join('; ') || 'None'}`;

      const res = await this.client.ask(prompt);
      return res.answer || 'Transaction executed on Solana mainnet.';
    } catch {
      return 'Transaction executed on Solana mainnet.';
    }
  }

  public async getProgramSummary(programId: string, programName?: string): Promise<string> {
    try {
      const prompt = `Explain in 2-3 concise, developer-friendly sentences what this Solana program is and what it does.
Program ID: ${programId}
Identified Name: ${programName || 'Unknown'}`;

      const res = await this.client.ask(prompt);
      return res.answer || 'On-chain program executing instructions on Solana.';
    } catch {
      return 'On-chain program executing instructions on Solana.';
    }
  }

  public async askQuestion(question: string, context?: string, sessionId?: string): Promise<string> {
    try {
      const fullPrompt = context
        ? `[Current Context]:\n${context}\n\n[User Question]:\n${question}`
        : question;
      const res = await this.client.ask(fullPrompt, sessionId);
      return res.answer;
    } catch (err: any) {
      return `Lana AI Error: ${err.message || err}`;
    }
  }
}
