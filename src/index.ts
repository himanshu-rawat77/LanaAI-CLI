import 'dotenv/config';
import { runMain } from 'citty';
import { main } from './cli.js';

export { LanaClient, isTrustedHeliusHost } from './lana-client.js';
export { exportToCsv, formatDossierMarkdown } from './utils/output.js';
export { OrbRpcClient } from './orb/rpc.js';
export * from './types.js';

// Only run CLI automatically when executed directly as CLI entrypoint
const isCliEntry =
  process.argv[1] &&
  (process.argv[1].endsWith('bin/lana.js') ||
    process.argv[1].endsWith('bin\\lana.js') ||
    process.argv[1].endsWith('dist/index.js') ||
    process.argv[1].endsWith('dist\\index.js') ||
    process.argv[1].endsWith('src/index.ts') ||
    process.argv[1].endsWith('src\\index.ts'));

if (isCliEntry) {
  runMain(main);
}

