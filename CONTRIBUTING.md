# Contributing to Lana AI CLI

Thank you for your interest in contributing to **Lana AI CLI**! Whether you are fixing bugs, improving documentation, or proposing new forensic capabilities for Solana, your contributions are welcome.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js** >= 20.0.0
- **npm** >= 10.0.0 (or pnpm / yarn)
- A Solana wallet address or transaction signature for testing

### 1. Fork & Clone
```bash
git clone https://github.com/himanshu-rawat77/LanaAI-CLI.git
cd LanaAI-CLI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Local Environment
Copy the example environment template:
```bash
cp .env.example .env
```
Add your Helius / Lana API key to `.env` (or run `npm run dev` and use `lana login`).

### 4. Build & Watch Mode
```bash
# Continuous watch build
npm run dev

# Production build
npm run build

# Type checking without emission
npm run typecheck

# Run test CLI invocation
npm test
```

### 5. Link Globally for Local Testing
To test the binary globally as `lana` in your terminal:
```bash
npm link
```
Now running `lana orb` or `lana lookup <address>` in any terminal will execute your local build.

---

## 🧪 Code Quality & Testing

Before submitting a Pull Request, ensure that all checks pass:

1. **Type Check**:
   ```bash
   npm run typecheck
   ```
2. **Build Verification**:
   ```bash
   npm run build
   ```
3. **Help & Command Smoke Test**:
   ```bash
   npm test
   ```

---

## 📐 Project Structure

- `src/cli.ts`: Main command definitions and subcommand routing (built with `citty`).
- `src/lana-client.ts`: Lana AI conversational client handling Anthropic message protocols and fallback parsers.
- `src/orb/`: Terminal-native Solana block explorer engine.
  - `rpc.ts`: Multi-cluster JSON-RPC client with Compute Unit decoding and balance delta calculations.
  - `ai.ts`: Lana AI synthesis for transaction explanations and contextual follow-ups.
  - `repl.ts`: Interactive REPL with smart Base58 auto-detection.
  - `views/`: Developer-grade terminal renderers (tables, ASCII dividers, badges).
- `src/commands/`: CLI command handlers (`lookup`, `tx`, `flow`, `compare`, `dossier`, `ask`, `watch`, `config`, `login`, `orb`).
- `src/utils/`: Output formatting, local JSON storage (`~/.config/lana/`), and permission enforcement (`chmod 600`).

---

## 🤝 Submitting a Pull Request

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(orb): add token holder distribution breakdown"
   ```
3. Push to your branch and open a Pull Request against `main`.
4. Describe your changes clearly in the PR description, including terminal screenshots or ASCII output if modifying CLI views.

---

## 📄 License

By contributing to Lana AI CLI, you agree that your contributions will be licensed under the [MIT License](LICENSE).
