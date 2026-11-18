# 🔍 lana — Terminal-Native Solana Intelligence & Forensic Explorer

<div align="center">

```
  ██╗      █████╗ ███╗   ██╗ █████╗     █████╗ ██╗
  ██║     ██╔══██╗████╗  ██║██╔══██╗   ██╔══██╗██║
  ██║     ███████║██╔██╗ ██║███████║   ███████║██║
  ██║     ██╔══██║██║╚██╗██║██╔══██║   ██╔══██║██║
  ███████╗██║  ██║██║ ╚████║██║  ██║██╗██║  ██║██║
  ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚═╝
```

**Developer-Grade Solana Blockchain Explorer & Forensic Intelligence Toolkit**  
*Powered by Helius Lana AI • Terminal-Native • Real-Time Mainnet Telemetry*

[![npm version](https://img.shields.io/npm/v/@himanshurawatj/lana-ai-cli.svg?style=flat-square&color=00f2fe)](https://www.npmjs.com/package/@himanshurawatj/lana-ai-cli)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg?style=flat-square)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-Mainnet%20%7C%20Devnet-14F195?style=flat-square&logo=solana&logoColor=white)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

[Quick Start](#-quick-start) • [Orb Explorer Mode](#-lana-orb-mode-terminal-solana-explorer) • [Forensic Commands](#-forensic-commands--intelligence-suite) • [Configuration](#-authentication--configuration) • [Publishing](#-npm-publishing-guide)

</div>

---

## ⚡ Overview

**Lana AI CLI** (`lana`) is a high-speed, terminal-native detective toolkit designed for Solana developers, security auditors, forensic investigators, and DeFi researchers. It fuses raw, low-latency Solana JSON-RPC data with **Helius Lana AI** conversational intelligence to provide plain-English explanations, deep account profiling, graph-based fund tracing, and an interactive **Orb-style terminal block explorer**.

Whether you are debugging a failed versioned transaction (`v0`), auditing an unknown Token-2022 mint for honeypot extensions, or tracing multi-hop fund flows across drainer clusters, `lana` brings developer-grade answers straight to your terminal.

---

## 🌟 Key Features

| Capability | Description |
| :--- | :--- |
| 🪐 **Lana Orb Mode** | Terminal-native block explorer inspired by [Orb](https://orbmarkets.io) with developer-grade Transaction, Program, Token, and Wallet views. |
| 🕵️ **Truecaller for Wallets** | Risk scores (`0-100`), classification badges (`Whale`, `DEX Trader`, `Drainer`), funding provenance, and top counterparties. |
| 📜 **Plain-English Tx Deconstruction** | Human-readable explanation of actions, compute units used vs. limit (`CU %`), balance changes, and nested CPI invocations. |
| 🪙 **Token & Security Audit** | Mint & Freeze authority inspection, Token-2022 extension auditing (permanent delegate, transfer fees, hooks), plus live DEX liquidity, FDV, and volume. |
| 🌲 **Multi-Hop Fund Flow Visualizer** | Interactive ASCII/Unicode tree graphs tracking inflows and outflows across configurable depth hops. |
| ⚖️ **Multi-Wallet Comparison** | Side-by-side forensic matrix comparing 2+ wallets for shared funding, correlated trades, and common counterparties. |
| 📁 **On-Chain Noir Case Dossier** | Comprehensive investigative dossier with executive summaries, cluster analysis, risk assessment, and chronological case notes. |
| 💬 **Conversational AI REPL** | Free-form natural language querying with multi-turn session persistence and context retention. |
| 🎯 **Local Target Watchlist** | Keep track of high-interest targets directly in `~/.config/lana/watchlist.json`. |
| 📊 **Research-Ready Exports** | Native export to clean terminal tables, JSON for `jq` pipelines, CSV, or GitHub-flavored Markdown. |

---

## 📦 Installation

### Global Install (Recommended)

Install the CLI globally from npm:

```bash
npm install -g @himanshurawatj/lana-ai-cli
```

Verify your installation:

```bash
lana --help
```

### Instant Execution via `npx`

Run any command instantly without permanent installation:

```bash
npx @himanshurawatj/lana-ai-cli orb
npx @himanshurawatj/lana-ai-cli lookup 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr
```

### Build & Link from Source

```bash
# 1. Clone repository
git clone https://github.com/himanshu-rawat77/LanaAI-CLI.git
cd LanaAI-CLI

# 2. Install dependencies
npm install

# 3. Build with tsup
npm run build

# 4. Link globally for local testing
npm link
```

---

## 🔑 Authentication & Configuration

When you launch `lana` for the first time without credentials, an interactive setup prompt guides you through connecting your API key:

```text
╭────────────────────────────────────────────────────────────────────────────╮
│                      👋  WELCOME TO LANA AI CLI                           │
│                                                                            │
│  No API key detected. Connect your Lana / Helius key for real-time        │
│  Solana on-chain intelligence and forensic detective capabilities.         │
│                                                                            │
│  Get your free API key at:                                                 │
│  https://helius.dev or https://orbmarkets.io                               │
╰────────────────────────────────────────────────────────────────────────────╯
› Enter API Key: ************************************
```

Keys are saved securely to your OS config directory (`~/.config/lana/config.json`) with strict permissions (`chmod 600` on macOS/Linux).

### Configuration Commands

```bash
# Interactive login / save API key:
lana login

# Verify current authentication status and endpoint:
lana whoami

# View active configuration values:
lana config get

# Update API key or endpoint:
lana config set --key <NEW_API_KEY>

# Print paths to config and watchlist files:
lana config path

# Clear saved credentials:
lana logout

# Reset configuration back to initial setup:
lana config reset
```

### Environment Variables

Alternatively, pass your key via environment variables:

```bash
# In ~/.bashrc, ~/.zshrc, or .env:
export LANA_API_KEY="your_helius_or_lana_key"

# Optional endpoint overrides:
export LANA_API_URL="https://beta.helius-rpc.com/v1/lana/messages"
export LANA_MODEL="lana-fast"
```

---

## 🪐 Lana Orb Mode (Terminal Solana Explorer)

Orb mode brings an interactive, terminal-native block explorer inspired by [Orb](https://orbmarkets.io) directly to your CLI.

```bash
# Launch interactive Orb REPL:
lana orb
```

### Smart Detection in Interactive Mode
Inside the `lana orb` REPL (`› `):
- **88-character base58** $\rightarrow$ Automatically deconstructs as a **Transaction**.
- **32–44 character base58** $\rightarrow$ Automatically inspects as an **Account / Program / Token Mint**.
- `tx <signature>` $\rightarrow$ Forces transaction inspection.
- `program <id>` $\rightarrow$ Forces program verification & IDL view.
- `token <mint>` $\rightarrow$ Forces token security & market audit.
- **Natural Language** $\rightarrow$ Routes query to Lana AI maintaining context from previous inspections!

---

### 1. Developer-Grade Transaction View

```bash
lana orb tx <signature>
```

#### Output Preview:
```text
TRANSACTION
──────────────────────────────────────────────────────────────
Signature   2mJbp2NEa7aqzVbEMN9cJ3tvKHKswNNN49XBe4fg1huHnssSrSrELXb9jKAXQ8wJCWdCXaYJYok429hesY4YN3qC
Status      Success
Slot        460,742,033
Block Time  2026-10-24T06:05:24.000Z
Fee         0.000005 SOL
CU Used     91,234 / 200,000 (45.6%)
Version     0

AI SUMMARY
──────────────────────────────────────────────────────────────
A user swapped SOL for 181.87 units of SPL token 9Zf6...5SZg via a liquidity pool.
The transaction created an associated token account idempotently, wrapped native SOL,
executed the DEX swap, and closed the temporary WSOL account.

BALANCE CHANGES
──────────────────────────────────────────────────────────────
Account                              SOL Δ            Token Δ                   
2dXp...PdmD (Signer)                 -0.000159        —                         
5F4k...PTsN                          0.000000         +181.872512 9Zf6...5SZg   
HMPx...kro6                          0.000000         +0.045605 9Zf6...5SZg     
EKcR...jkrP                          +0.000154        +0.000154 So11...1112     
JBGN...C3LN                          0.000000         -181.963722 9Zf6...5SZg   

INSTRUCTIONS (top-level)
──────────────────────────────────────────────────────────────
#0  Compute Budget Program::setComputeUnitLimit
    units: 200000
#1  Compute Budget Program::setComputeUnitPrice
    microLamports: 1000
#2  spl-associated-token-account::createIdempotent
    account: B8HZszPRodWMJ1MfoREr1pkeQKPR47sr4MusDUMKcocw
    mint: So11111111111111111111111111111111111111112
    wallet: 2dXp34zjUumwDGh19c3KQZAADVyknCuz6BN2YmzdPdmD
#3  spl-token::syncNative
    account: B8HZszPRodWMJ1MfoREr1pkeQKPR47sr4MusDUMKcocw
#4  Raydium AMM::swapBaseIn
    amountIn: 153888
    minimumAmountOut: 181800000

INNER INSTRUCTIONS
──────────────────────────────────────────────────────────────
#2.0  spl-token::getAccountDataSize
      Program: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
#2.1  system::createAccount
      Program: 11111111111111111111111111111111
      lamports: 1488440

LOGS
──────────────────────────────────────────────────────────────
Program ComputeBudget111111111111111111111111111111 invoke [1]
Program ComputeBudget111111111111111111111111111111 success
Program ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL invoke [1]
... (Run with --logs to show full logs)

ACCOUNTS
──────────────────────────────────────────────────────────────
#    Address                                        Signer   Writable   Owner             
0    2dXp34zjUumwDGh19c3KQZAADVyknCuz6BN2YmzdPdmD   ✓        ✓          —                 
1    B8HZszPRodWMJ1MfoREr1pkeQKPR47sr4MusDUMKcocw   —        ✓          —                 
2    5F4kKqv1v8tkF5Yxg292EWx4rGYys69xxP1WVzM1PTsN   —        ✓          —                 
```

---

### 2. Program View & Security Verification

```bash
lana orb program JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
```

#### Output Preview:
```text
PROGRAM
──────────────────────────────────────────────────────────────
Address     JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4
Name        Jupiter v6 Aggregator
Label       DEX Routing
Executable  true
Owner       BPFLoaderUpgradeab1e11111111111111111111111
Slot        459,479,624
Data Len    2,892,269 bytes
Authority   CvQZZ23qYDWF2RUpxYJ8y9K4skmuvYEEjH7fK58jtipQ

VERIFICATION & SECURITY
──────────────────────────────────────────────────────────────
Verified     Yes
IDL          Available
security.txt Present
Source       https://github.com/jup-ag

AI SUMMARY
──────────────────────────────────────────────────────────────
Jupiter v6 is Solana's premier liquidity aggregator, finding optimal routing across
multiple AMMs in a single atomic transaction.

IDL (summary)
──────────────────────────────────────────────────────────────
Instructions:
  • route
  • sharedAccountsRoute
  • exactOutRoute

RECENT ACTIVITY (last 24h)
──────────────────────────────────────────────────────────────
Txns         20 (sampled)
Last Active  2026-10-24T06:13:48.000Z

UPGRADE HISTORY
──────────────────────────────────────────────────────────────
• Deployed/Updated at slot #459,479,624
```

---

### 3. Token & Honeypot Security Audit

```bash
lana orb token 2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
```

#### Output Preview:
```text
TOKEN MINT
──────────────────────────────────────────────────────────────
Mint Address    2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo
Name            PayPal USD
Symbol          PYUSD
Standard        Token-2022 (Extensions)
Decimals        6
Supply          705,999,904.083
Token Program   TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb
Initialized     Yes

SECURITY & RISK AUDIT
──────────────────────────────────────────────────────────────
Mint Authority  Active (AxJkHRY3puoofyj7Pn512M1SGBgWroXMkEdNPQypkzbu)
Freeze Auth     Active (2apBGMsS6ti9RyF5TwQTDswXBWskiJP2LD4cUEDqYJjk)
Transfer Fee    0%
Perm Delegate   ACTIVE (High Risk: Can transfer/burn holder tokens)
Transfer Hook   Custom Transfer Hook Attached
Extensions      mintCloseAuthority, permanentDelegate, transferFeeConfig, transferHook

MARKET & LIQUIDITY
──────────────────────────────────────────────────────────────
Price (USD)     $1.00028
Price (SOL)     0.005128 SOL
24h Change      +0.01%
24h Volume      $543,920
FDV / MCap      $154,386,943
Liquidity       $16,450,414
Primary DEX     ORCA (9tXi...dM9B)
24h Trades      160 Buys / 125 Sells

OFFICIAL LINKS & SOCIALS
──────────────────────────────────────────────────────────────
  • Website: https://www.paypal.com/pyusd
  • twitter: https://x.com/PayPal
```

---

### 4. Wallet & Account View

```bash
lana orb 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr
```

Inspects native SOL balance, lamports, owner program, token holdings table, and recent transaction volume.

---

## 🔬 Forensic Commands & Intelligence Suite

In addition to Orb explorer mode, `lana` provides dedicated forensic tools:

### 1. Truecaller Wallet Profile (`lana lookup`)
Forensic profile of any Solana wallet: risk score, risk level, labels, narrative, funding provenance, and top counterparties.

```bash
# Standard interactive view:
lana lookup 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr

# Scriptable JSON output piped to jq:
lana lookup 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr --json | jq '.riskScore, .labels'
```

### 2. Multi-Hop Fund Flow Visualizer (`lana flow`)
Traces multi-hop inflows and outflows and prints an ASCII/Unicode hierarchy tree:

```bash
lana flow 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr --depth 2
```

### 3. Multi-Wallet Comparison Matrix (`lana compare`)
Compare two or more wallets side-by-side to detect shared funding origins, overlapping counterparties, and coordinated behavior:

```bash
lana compare <address1> <address2> <address3>
```

### 4. Forensic Case Dossier (`lana dossier`)
Compile a full On-Chain Noir investigative report:

```bash
# View in terminal:
lana dossier 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr

# Export directly to markdown report:
lana dossier 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr --markdown > case_report.md
```

### 5. Natural Language AI Inquiries (`lana ask`)
Query Lana AI directly with multi-turn session persistence:

```bash
# Standalone question:
lana ask "Explain the recent exploit pattern on Solana lending protocols"

# Multi-turn session:
lana ask "What are the biggest counterparties for this wallet?" --session case-402
lana ask "Which of those counterparties are flagged as mixers or CEXs?" --session case-402
```

### 6. Multi-Format Reports (`lana report`)
Generate structured research reports for external documentation:

```bash
# Export CSV:
lana report <address> --format csv --out audit.csv

# Export Markdown:
lana report <address> --format md --out audit.md
```

### 7. Target Watchlist (`lana watch`)
Track suspicious wallets or alpha targets in a local JSON database:

```bash
# Add a target with tags and notes:
lana watch 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr --add --label "Jito MEV Searcher" --tag "mev,bot" --notes "High frequency voting"

# List watchlist:
lana watch --list

# Remove a target:
lana watch 7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr --remove
```

---

## ⚙️ Universal CLI Flags

| Flag | Shorthand | Description |
| :--- | :---: | :--- |
| `--json` | `-j` | Output pure JSON for Unix piping and automated scripts |
| `--quiet` | `-q` | Minimal output suppressing spinners and decorative headers |
| `--verbose` | `-v` | Enable detailed debug logs and HTTP payload diagnostics |
| `--no-ai` | — | Disable Lana AI summary enrichment for pure RPC speed |
| `--devnet` | — | Target Solana devnet cluster |
| `--testnet` | — | Target Solana testnet cluster |
| `--logs` | — | Display full un-truncated program logs for transactions |
| `--idl` | — | Dump the complete program IDL JSON schema to stdout |
| `--apiKey <key>`| `-k` | Override API key for a single command invocation |

---

## 🏗️ Project Architecture

```
lana-cli/
├── bin/
│   └── lana.js                     # Executable CLI entrypoint
├── src/
│   ├── index.ts                    # Root execution runner
│   ├── cli.ts                      # Citty root command & subcommand router
│   ├── lana-client.ts              # Robust Lana AI API client (Anthropic v1 format)
│   ├── types.ts                    # Core TypeScript domain models
│   ├── orb/                        # Lana Orb Mode (Terminal Solana Explorer)
│   │   ├── types.ts                # Explorer type models (CU%, IDL, audit, market)
│   │   ├── rpc.ts                  # Multi-cluster RPC client with Helius acceleration
│   │   ├── ai.ts                   # Lana AI synthesis & contextual follow-ups
│   │   ├── known-programs.ts       # Known on-chain program registry & sources
│   │   ├── repl.ts                 # Interactive REPL with smart base58 detection
│   │   └── views/                  # Developer-grade terminal renderers
│   │       ├── tx-view.ts          # Exact transaction view layout
│   │       ├── program-view.ts     # Exact program view layout
│   │       ├── token-view.ts       # Security audit & DEX market view
│   │       └── wallet-view.ts      # Account & holdings view
│   ├── commands/                   # Command implementations
│   │   ├── orb.ts                  # `lana orb` explorer command
│   │   ├── lookup.ts               # `lana lookup` wallet profiling
│   │   ├── tx.ts                   # `lana tx` explainer
│   │   ├── flow.ts                 # `lana flow` fund tracing
│   │   ├── compare.ts              # `lana compare` multi-wallet comparison
│   │   ├── dossier.ts              # `lana dossier` case file generator
│   │   ├── ask.ts                  # `lana ask` AI conversational query
│   │   ├── report.ts               # `lana report` multi-format export
│   │   ├── watch.ts                # `lana watch` watchlist tracker
│   │   ├── config.ts               # `lana config` settings
│   │   ├── login.ts                # `lana login` interactive setup
│   │   ├── logout.ts               # `lana logout` credential removal
│   │   ├── whoami.ts               # `lana whoami` status display
│   │   └── chat.ts                 # `lana chat` legacy conversational REPL
│   └── utils/
│       ├── config.ts               # Config loading, saving & chmod 600
│       ├── format.ts               # Address, SOL, USD, and date formatters
│       └── output.ts               # Boxen and cli-table3 visual renderers
├── benchmark.py                    # Latency & throughput benchmarking suite
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── LICENSE
└── README.md
```

---

## 🚀 NPM Publishing Guide

Follow these exact steps to publish this package to npm:

### Step 1: Verify Code & Build
Ensure all TypeScript compiles cleanly:

```bash
npm run build
npm test
```

### Step 2: Login to NPM
Authenticate your npm account in your terminal:

```bash
npm login
```
*(Enter your username, password, email, and 2FA/OTP code when prompted).*

Verify that you are signed in:
```bash
npm whoami
```

### Step 3: Bump Version (if updating)
If you are releasing a new update or patch:

```bash
# For a patch release (e.g., 1.0.6 -> 1.0.7):
npm version patch

# For a minor release (e.g., 1.0.6 -> 1.1.0):
npm version minor
```

### Step 4: Publish with Public Access
Because this package is scoped (`@himanshurawatj/lana-ai-cli`), you must pass the `--access public` flag:

```bash
npm publish --access public
```

*If your npm account has Two-Factor Authentication (2FA) enabled, pass your 6-digit OTP:*
```bash
npm publish --access public --otp=123456
```

### Step 5: Test the Live Package
Once published, test running it directly from the registry:

```bash
npx @himanshurawatj/lana-ai-cli --help
npx @himanshurawatj/lana-ai-cli orb
```

---

## 📈 Latency & Performance Benchmarking

A Python test harness (`benchmark.py`) is included to evaluate latency, throughput, and TTFT (Time-To-First-Token):

```bash
# Stream latency benchmark:
python benchmark.py --stream -n 10 -c 3

# Benchmark CLI binary execution speed:
python benchmark.py --mode cli -n 5

# Export full metrics to JSON and CSV:
python benchmark.py -n 10 --json report.json --csv results.csv
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for full details.

Developed with ❤️ for the Solana ecosystem. Powered by **Helius** & **Lana AI**.
