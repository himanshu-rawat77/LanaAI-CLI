import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import pc from 'picocolors';
import { ofetch } from 'ofetch';
import type { LanaConfig, WatchlistItem, AskSessionMessage } from '../types.js';

export function getConfigDir(): string {
  const homeDir = os.homedir();
  const dir = path.join(homeDir, '.config', 'lana');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function getWatchlistPath(): string {
  return path.join(getConfigDir(), 'watchlist.json');
}

export function getSessionsPath(): string {
  return path.join(getConfigDir(), 'sessions.json');
}

export function loadConfig(): LanaConfig {
  const configFile = getConfigPath();
  try {
    if (fs.existsSync(configFile)) {
      const raw = fs.readFileSync(configFile, 'utf-8');
      return JSON.parse(raw) as LanaConfig;
    }
  } catch {
    // ignore parse errors and fallback
  }
  return {
    color: true,
    defaultFormat: 'table',
  };
}

export function saveConfig(updates: Partial<LanaConfig>): LanaConfig {
  const current = loadConfig();
  const next = { ...current, ...updates };
  const configFilePath = getConfigPath();
  fs.writeFileSync(configFilePath, JSON.stringify(next, null, 2), 'utf-8');

  // Restrict file permissions on Unix-based systems (chmod 600)
  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(configFilePath, 0o600);
    }
  } catch {
    // Ignore permission error if not supported
  }

  return next;
}

export function resetConfig(): boolean {
  const configFilePath = getConfigPath();
  try {
    if (fs.existsSync(configFilePath)) {
      fs.unlinkSync(configFilePath);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function isUsableKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 8) return false;
  if (/^[*]+$/.test(trimmed)) return false;
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return false;
  return true;
}

export function getApiKey(flagApiKey?: string): string | undefined {
  if (flagApiKey && isUsableKey(flagApiKey)) {
    return flagApiKey.trim();
  }
  if (isUsableKey(process.env.LANA_API_KEY)) {
    return process.env.LANA_API_KEY!.trim();
  }
  if (isUsableKey(process.env.HELIUS_API_KEY)) {
    return process.env.HELIUS_API_KEY!.trim();
  }
  if (isUsableKey(process.env.ORB_API_KEY)) {
    return process.env.ORB_API_KEY!.trim();
  }
  const config = loadConfig();
  return isUsableKey(config.apiKey) ? config.apiKey : undefined;
}

export function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function askMasked(promptText: string): Promise<string> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      return askQuestion(promptText).then(resolve);
    }

    process.stdout.write(promptText);
    let input = '';
    const onData = (buffer: Buffer) => {
      const str = buffer.toString();
      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(input.trim());
          return;
        } else if (char === '\u0003') {
          if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
            process.stdin.setRawMode(false);
          }
          process.stdin.pause();
          process.exit(130);
        } else if (char === '\b' || char === '\x7f') {
          if (input.length > 0) {
            input = input.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else if (char.charCodeAt(0) >= 32) {
          input += char;
          process.stdout.write('*');
        }
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

export function openBrowser(url: string): void {
  try {
    if (!/^https?:\/\//i.test(url)) return;
    const platform = process.platform;
    if (platform === 'win32') {
      exec(`start "" "${url}"`);
    } else if (platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch {
    // ignore
  }
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; reason?: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed || trimmed.length < 8) {
    return { valid: false, reason: 'Key is too short or empty.' };
  }

  try {
    const res = await ofetch<any>(`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(trimmed)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { jsonrpc: '2.0', id: 1, method: 'getHealth' },
      timeout: 8000,
    });

    if (res && (res.result === 'ok' || res.result === 'behind')) {
      return { valid: true };
    }
    if (res?.error) {
      return { valid: false, reason: res.error.message || 'Unauthorized API key' };
    }
    return { valid: true };
  } catch (err: any) {
    if (err.status === 401 || err.status === 403) {
      return { valid: false, reason: 'Authentication failed (401/403 Unauthorized). Please verify your key at https://helius.dev.' };
    }
    return { valid: true, reason: 'Network offline: saved without remote check.' };
  }
}

export async function ensureApiKeyInteractive(options: {
  apiKey?: string;
} = {}): Promise<{ apiKey: string }> {
  const existingKey = getApiKey(options.apiKey);
  if (existingKey) {
    return { apiKey: existingKey };
  }

  // Non-interactive environment fallback
  if (!process.stdin.isTTY) {
    throw new Error('API key is required. Set LANA_API_KEY or HELIUS_API_KEY in your environment, or run `lana login`.');
  }

  // Interactive First-Time Setup Prompt
  console.log(pc.bold(pc.cyan(`
╭────────────────────────────────────────────────────────────────────────────╮
│                      👋  WELCOME TO LANA AI CLI                           │
│                                                                            │
│  No API key detected. Connect your Lana / Helius key for real-time        │
│  Solana on-chain intelligence and forensic detective capabilities.         │
│                                                                            │
│  Get your free API key at:                                                 │
│  https://helius.dev or https://orbmarkets.io                               │
│                                                                            │
│  (Press Enter with empty input to continue in offline Demo Mode)           │
╰────────────────────────────────────────────────────────────────────────────╯
`)));

  while (true) {
    const enteredKey = await askMasked(`${pc.bold(pc.cyan('› Enter API Key:'))} `);

    if (!enteredKey) {
      console.log(pc.yellow('\nAPI key is required to use Lana CLI. Please enter your key or press Ctrl+C to exit.\n'));
      continue;
    }

    // Save directly — no remote validation (beta key support)
    saveConfig({ apiKey: enteredKey });
    console.log(pc.green(`\n✔ API key securely saved to ${pc.bold(getConfigPath())}! Continuing...\n`));
    return { apiKey: enteredKey };
  }
}

export function loadWatchlist(): WatchlistItem[] {
  const filepath = getWatchlistPath();
  try {
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(raw) as WatchlistItem[];
    }
  } catch {
    // fallback
  }
  return [];
}

export function saveWatchlist(items: WatchlistItem[]): void {
  fs.writeFileSync(getWatchlistPath(), JSON.stringify(items, null, 2), 'utf-8');
}

export function addToWatchlist(item: { address: string; label?: string; tags?: string[]; notes?: string }): {
  created: boolean;
  item: WatchlistItem;
} {
  const current = loadWatchlist();
  const existingIdx = current.findIndex(w => w.address.toLowerCase() === item.address.toLowerCase());
  const now = new Date().toISOString();
  
  if (existingIdx >= 0) {
    current[existingIdx] = {
      ...current[existingIdx],
      label: item.label ?? current[existingIdx].label,
      tags: item.tags ?? current[existingIdx].tags,
      notes: item.notes ?? current[existingIdx].notes,
    };
    saveWatchlist(current);
    return { created: false, item: current[existingIdx] };
  }

  const newItem: WatchlistItem = {
    address: item.address,
    label: item.label || 'Unlabeled Target',
    tags: item.tags || ['manual'],
    notes: item.notes,
    addedAt: now,
  };
  current.push(newItem);
  saveWatchlist(current);
  return { created: true, item: newItem };
}

export function removeFromWatchlist(address: string): boolean {
  const current = loadWatchlist();
  const filtered = current.filter(w => w.address.toLowerCase() !== address.toLowerCase());
  if (filtered.length === current.length) {
    return false;
  }
  saveWatchlist(filtered);
  return true;
}

export function loadSessions(): Record<string, AskSessionMessage[]> {
  const filepath = getSessionsPath();
  try {
    if (fs.existsSync(filepath)) {
      const raw = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(raw) as Record<string, AskSessionMessage[]>;
    }
  } catch {
    // fallback
  }
  return {};
}

export function getSessionMessages(sessionId: string): AskSessionMessage[] {
  const sessions = loadSessions();
  return sessions[sessionId] || [];
}

export function appendSessionMessages(sessionId: string, userText: string, assistantText: string): void {
  const sessions = loadSessions();
  if (!sessions[sessionId]) {
    sessions[sessionId] = [];
  }
  const now = new Date().toISOString();
  sessions[sessionId].push({ role: 'user', content: userText, timestamp: now });
  sessions[sessionId].push({ role: 'assistant', content: assistantText, timestamp: now });

  // Limit memory per session to last 20 messages
  if (sessions[sessionId].length > 20) {
    sessions[sessionId] = sessions[sessionId].slice(-20);
  }
  fs.writeFileSync(getSessionsPath(), JSON.stringify(sessions, null, 2), 'utf-8');
}
