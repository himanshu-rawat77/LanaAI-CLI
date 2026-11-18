import Table from 'cli-table3';
import boxen from 'boxen';
import pc from 'picocolors';
import type {
  WalletProfile,
  TransactionExplainer,
  FundFlowSummary,
  FundFlowNode,
  WalletComparison,
  DossierReport,
  AskResponse,
  WatchlistItem,
} from '../types.js';
import {
  formatAddress,
  formatTxHash,
  formatSol,
  formatUsd,
  formatRiskBadge,
  formatLabelBadge,
  formatDate,
} from './format.js';

export function printJson(data: any): void {
  console.log(JSON.stringify(data, null, 2));
}

export function printBox(title: string, content: string, borderColor = 'cyan'): void {
  console.log(
    boxen(content || '', {
      title: pc.bold(` ${title} `),
      titleAlignment: 'left',
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderColor: borderColor as any,
      borderStyle: 'round',
    })
  );
}

export function renderLookup(profile: WalletProfile, isJson = false): void {
  if (isJson) {
    printJson(profile);
    return;
  }

  const riskScore = profile?.riskScore ?? 0;
  const riskBadge = formatRiskBadge(riskScore, profile?.riskLevel);
  const labelsList = Array.isArray(profile?.labels) ? profile.labels : [];
  const labelsText = labelsList.map(l => formatLabelBadge(l)).join(' ');
  const headerContent = [
    `${pc.bold('Target Address:')} ${pc.cyan(profile?.address || 'Unknown')}`,
    `${pc.bold('Risk Score:    ')} ${riskBadge}`,
    `${pc.bold('Labels:        ')} ${labelsText || pc.dim('None')}`,
  ].join('\n');

  printBox('LANA // WALLET PROFILE', headerContent, riskScore >= 50 ? 'red' : 'cyan');

  // Key Metrics Table
  const metricsTable = new Table({
    head: [pc.bold('Metric'), pc.bold('Value')],
    colWidths: [22, 58],
  });

  const txCountStr =
    profile?.totalTxCount != null
      ? Number(profile.totalTxCount).toLocaleString()
      : 'N/A';
  const tokenCountStr =
    profile?.tokenCount != null ? String(profile.tokenCount) : 'N/A';

  metricsTable.push(
    ['SOL Balance', formatSol(profile?.solBalance ?? 0)],
    ['Token Accounts', pc.yellow(tokenCountStr)],
    ['Total Transactions', pc.yellow(txCountStr)],
    ['First Active', formatDate(profile?.firstActivity)],
    ['Last Active', formatDate(profile?.lastActivity)],
    [
      'Funding Source',
      profile?.fundingSource
        ? `${pc.cyan(formatAddress(profile.fundingSource.address))} ${
            profile.fundingSource.label ? pc.dim(`(${profile.fundingSource.label})`) : ''
          } ${profile.fundingSource.amountSol != null ? `[${formatSol(profile.fundingSource.amountSol)}]` : ''}`
        : pc.dim('Unknown'),
    ]
  );
  console.log(metricsTable.toString());
  console.log();

  // Narrative
  if (profile?.narrative) {
    printBox('FORENSIC NARRATIVE', pc.italic(profile.narrative), 'blue');
  }

  // Counterparties Table
  const counterparties = Array.isArray(profile?.topCounterparties) ? profile.topCounterparties : [];
  if (counterparties.length > 0) {
    const cpTable = new Table({
      head: [
        pc.bold('Top Counterparty'),
        pc.bold('Label / Entity'),
        pc.bold('Dir'),
        pc.bold('Tx Count'),
        pc.bold('Volume'),
      ],
      colWidths: [20, 28, 8, 12, 16],
    });

    for (const cp of counterparties) {
      if (!cp) continue;
      const dirBadge =
        cp.direction === 'IN'
          ? pc.green('IN')
          : cp.direction === 'OUT'
          ? pc.red('OUT')
          : pc.cyan('BOTH');
      cpTable.push([
        formatAddress(cp.address),
        cp.label ? pc.white(cp.label) : pc.dim('Unlabeled'),
        dirBadge,
        cp.txCount != null ? Number(cp.txCount).toLocaleString() : 'N/A',
        formatSol(cp.volumeSol ?? 0),
      ]);
    }
    console.log(pc.bold(pc.underline('Top Counterparties:')));
    console.log(cpTable.toString());
    console.log();
  }

  // Behavioral Signals
  const signals = Array.isArray(profile?.behavioralSignals) ? profile.behavioralSignals : [];
  if (signals.length > 0) {
    console.log(pc.bold(pc.underline('Behavioral Signals & Observations:')));
    signals.forEach(signal => {
      if (signal) console.log(`  ${pc.cyan('▪')} ${signal}`);
    });
    console.log();
  }
}

export function renderTx(tx: TransactionExplainer, isJson = false): void {
  if (isJson) {
    printJson(tx);
    return;
  }

  const isSuccess = tx?.status === 'SUCCESS';
  const statusText = isSuccess
    ? pc.bgGreen(pc.black(pc.bold(' SUCCESS ')))
    : pc.bgRed(pc.white(pc.bold(' FAILED ')));

  const signersList = Array.isArray(tx?.signers) ? tx.signers : [];
  const header = [
    `${pc.bold('Signature:')} ${formatTxHash(tx?.signature || '', true)}`,
    `${pc.bold('Status:   ')} ${statusText}    ${pc.bold('Type:')} ${pc.magenta(tx?.type || 'Transaction')}`,
    `${pc.bold('Fee:      ')} ${formatSol(tx?.feeSol ?? 0)}    ${pc.bold('Time:')} ${formatDate(tx?.timestamp)}`,
    `${pc.bold('Signers:  ')} ${signersList.map(s => formatAddress(s)).join(', ') || pc.dim('N/A')}`,
  ].join('\n');

  printBox('LANA // TRANSACTION EXPLAINER', header, isSuccess ? 'green' : 'red');

  // Plain-English Explanation
  if (tx?.plainEnglish) {
    printBox('PLAIN-ENGLISH SUMMARY', pc.white(tx.plainEnglish), 'yellow');
  }

  // Money Movements Table
  const movements = Array.isArray(tx?.moneyMovements) ? tx.moneyMovements : [];
  if (movements.length > 0) {
    console.log(pc.bold(pc.underline('Token & Fund Movements:')));
    const moveTable = new Table({
      head: [
        pc.bold('Asset'),
        pc.bold('Amount'),
        pc.bold('From'),
        pc.bold('To'),
        pc.bold('USD Est.'),
      ],
      colWidths: [10, 16, 24, 24, 14],
    });

    for (const m of movements) {
      if (!m) continue;
      const amt = Number(m.amount ?? 0);
      const amtStr = amt >= 0 ? pc.green(`+${amt}`) : pc.red(`${amt}`);
      const fromStr = `${formatAddress(m.from)} ${m.fromLabel ? pc.dim(`(${m.fromLabel})`) : ''}`;
      const toStr = `${formatAddress(m.to)} ${m.toLabel ? pc.dim(`(${m.toLabel})`) : ''}`;
      moveTable.push([
        pc.bold(m.symbol || 'TOKEN'),
        amtStr,
        fromStr,
        toStr,
        formatUsd(m.usdValue),
      ]);
    }
    console.log(moveTable.toString());
    console.log();
  }

  // Program Interactions
  const programs = Array.isArray(tx?.programInteractions) ? tx.programInteractions : [];
  if (programs.length > 0) {
    console.log(pc.bold(pc.underline('Program Invocations:')));
    const progTable = new Table({
      head: [pc.bold('Program ID'), pc.bold('Name'), pc.bold('Action / Instruction')],
      colWidths: [22, 28, 36],
    });

    for (const p of programs) {
      if (!p) continue;
      progTable.push([
        formatAddress(p.programId),
        pc.cyan(p.programName || 'Custom Program'),
        p.action ? pc.white(p.action) : pc.dim('Execute'),
      ]);
    }
    console.log(progTable.toString());
    console.log();
  }
}

function renderTreeNode(node: FundFlowNode, prefix = '', isLast = true): void {
  if (!node) return;
  const branch = isLast ? '└── ' : '├── ';
  const labelStr = node.label ? pc.white(` (${node.label})`) : '';
  const dirStr = node.type === 'INFLOW' ? pc.green('▼ IN') : node.type === 'OUTFLOW' ? pc.red('▲ OUT') : '';
  const amtStr = formatSol(node.amountSol ?? 0);
  const txCountStr = node.txCount != null ? pc.dim(` [${node.txCount} txs]`) : '';

  console.log(
    `${prefix}${branch}${dirStr} ${pc.cyan(formatAddress(node.address))}${labelStr} : ${amtStr}${txCountStr}`
  );

  const children = Array.isArray(node.children) ? node.children : [];
  if (children.length > 0) {
    const nextPrefix = prefix + (isLast ? '    ' : '│   ');
    children.forEach((child, index) => {
      renderTreeNode(child, nextPrefix, index === children.length - 1);
    });
  }
}

export function renderFlow(flow: FundFlowSummary, isJson = false): void {
  if (isJson) {
    printJson(flow);
    return;
  }

  const header = [
    `${pc.bold('Target Address: ')} ${pc.cyan(flow?.rootAddress || 'Unknown')}`,
    `${pc.bold('Search Depth:   ')} ${pc.yellow(String(flow?.depth ?? 2))} hops`,
    `${pc.bold('Total Inflow:   ')} ${pc.green(formatSol(flow?.totalInflowSol ?? 0))}    ${pc.bold('Total Outflow: ')} ${pc.red(formatSol(flow?.totalOutflowSol ?? 0))}`,
  ].join('\n');

  printBox('LANA // FUND FLOW TREE', header, 'magenta');

  console.log(pc.bold(pc.underline('Hierarchical Flow Graph:')));
  console.log(`${pc.bold('Target (Root):')} ${pc.cyan(formatAddress(flow?.rootAddress || '', true))}`);

  const directInflows = Array.isArray(flow?.directInflows) ? flow.directInflows : [];
  if (directInflows.length > 0) {
    console.log(pc.bold(pc.green('\n Inflow Sources:')));
    directInflows.forEach((node, idx) => {
      renderTreeNode(node, '  ', idx === directInflows.length - 1);
    });
  }

  const directOutflows = Array.isArray(flow?.directOutflows) ? flow.directOutflows : [];
  if (directOutflows.length > 0) {
    console.log(pc.bold(pc.red('\n Outflow Destinations:')));
    directOutflows.forEach((node, idx) => {
      renderTreeNode(node, '  ', idx === directOutflows.length - 1);
    });
  }

  console.log();
  const notableHops = Array.isArray(flow?.notableHops) ? flow.notableHops : [];
  if (notableHops.length > 0) {
    console.log(pc.bold(pc.underline('Notable Graph Patterns:')));
    notableHops.forEach(hop => {
      if (hop) console.log(`  ${pc.magenta('✦')} ${hop}`);
    });
    console.log();
  }
}

export function renderCompare(comparison: WalletComparison, isJson = false): void {
  if (isJson) {
    printJson(comparison);
    return;
  }

  const addresses = Array.isArray(comparison?.addresses) ? comparison.addresses : [];
  const profiles = Array.isArray(comparison?.profiles) ? comparison.profiles : [];
  const similarityScore = Number(comparison?.similarityScore ?? 50);

  const simColor =
    similarityScore >= 75
      ? pc.red
      : similarityScore >= 40
      ? pc.yellow
      : pc.green;

  const header = [
    `${pc.bold('Wallets Analyzed:')} ${addresses.length}`,
    `${pc.bold('Similarity Score:')} ${simColor(pc.bold(`${similarityScore}% Congruence`))}`,
    `${pc.bold('Shared Funding:  ')} ${comparison?.sharedFundingSource ? pc.yellow(comparison.sharedFundingSource) : pc.dim('No direct shared source')}`,
  ].join('\n');

  printBox('LANA // MULTI-WALLET COMPARISON', header, 'yellow');

  // Side-by-side profiles
  const profileTable = new Table({
    head: [pc.bold('Attribute'), ...addresses.map(a => formatAddress(a))],
  });

  profileTable.push(
    ['Risk Score', ...profiles.map(p => formatRiskBadge(p?.riskScore ?? 0, p?.riskLevel))],
    ['SOL Balance', ...profiles.map(p => formatSol(p?.solBalance ?? 0))],
    [
      'Tx Count',
      ...profiles.map(p =>
        p?.totalTxCount != null
          ? Number(p.totalTxCount).toLocaleString()
          : (p as any)?.txCount != null
          ? Number((p as any).txCount).toLocaleString()
          : 'N/A'
      ),
    ],
    [
      'Primary Label',
      ...profiles.map(p => {
        if (Array.isArray(p?.labels) && p.labels.length > 0) {
          return p.labels[0];
        }
        if (typeof (p as any)?.labels === 'string' && (p as any).labels) {
          return (p as any).labels;
        }
        return 'Unlabeled';
      }),
    ],
    ['First Active', ...profiles.map(p => formatDate(p?.firstActivity))]
  );
  console.log(profileTable.toString());
  console.log();

  // Overlap Summary
  if (comparison?.overlapSummary) {
    printBox('BEHAVIORAL OVERLAP ASSESSMENT', comparison.overlapSummary, 'blue');
  }

  // Common Counterparties
  const commonCPs = Array.isArray(comparison?.commonCounterparties) ? comparison.commonCounterparties : [];
  if (commonCPs.length > 0) {
    console.log(pc.bold(pc.underline('Shared Common Counterparties:')));
    const cpTable = new Table({
      head: [pc.bold('Shared Entity / Counterparty'), ...addresses.map(a => formatAddress(a))],
    });

    for (const cp of commonCPs) {
      if (!cp) continue;
      const interactionMap = cp.interactionMap || {};
      const row = [
        `${formatAddress(cp.address)} ${cp.label ? pc.dim(`(${cp.label})`) : ''}`,
        ...addresses.map(a => {
          const count = interactionMap[a];
          return count != null ? `${Number(count).toLocaleString()} txs` : '0 txs';
        }),
      ];
      cpTable.push(row);
    }
    console.log(cpTable.toString());
    console.log();
  }

  // Differences
  const differences = Array.isArray(comparison?.behavioralDifferences) ? comparison.behavioralDifferences : [];
  if (differences.length > 0) {
    console.log(pc.bold(pc.underline('Behavioral Divergence:')));
    differences.forEach(diff => {
      if (diff) console.log(`  ${pc.yellow('▪')} ${diff}`);
    });
    console.log();
  }
}

export function renderDossier(dossier: DossierReport, isJson = false, isMd = false): void {
  if (isJson) {
    printJson(dossier);
    return;
  }

  if (isMd) {
    console.log(formatDossierMarkdown(dossier));
    return;
  }

  const score = dossier?.riskAssessment?.score ?? 0;
  const level = dossier?.riskAssessment?.level;
  const header = [
    `${pc.bold('CASE ID:       ')} ${pc.yellow(dossier?.caseId || 'CASE-0000')}`,
    `${pc.bold('CLASSIFICATION:')} ${pc.bgBlack(pc.bold(pc.red(` ${dossier?.classification || 'CONFIDENTIAL'} `)))}`,
    `${pc.bold('TARGET SUBJECT:')} ${pc.cyan(dossier?.targetAddress || 'Unknown')}`,
    `${pc.bold('DATE GENERATED:')} ${formatDate(dossier?.generatedAt)}`,
    `${pc.bold('RISK PROFILE:  ')} ${formatRiskBadge(score, level)}`,
  ].join('\n');

  printBox('ON-CHAIN NOIR // FORENSIC DOSSIER', header, 'red');

  // Executive Summary
  if (dossier?.executiveSummary) {
    printBox('I. EXECUTIVE INTELLIGENCE SUMMARY', pc.white(dossier.executiveSummary), 'cyan');
  }

  // Risk Factors
  const factors = Array.isArray(dossier?.riskAssessment?.factors) ? dossier.riskAssessment.factors : [];
  if (factors.length > 0) {
    console.log(pc.bold(pc.underline('II. RISK ASSESSMENT & ATTRIBUTION')));
    factors.forEach(factor => {
      if (factor) console.log(`  ${pc.red('✖')} ${factor}`);
    });
    console.log();
  }

  // Cluster Analysis
  if (dossier?.clusterAnalysis) {
    console.log(pc.bold(pc.underline('III. CLUSTER & NETWORK AFFILIATION')));
    console.log(`  Primary Entity: ${pc.yellow(pc.bold(dossier.clusterAnalysis.primaryCluster || 'Independent Node'))}`);
    const associated = Array.isArray(dossier.clusterAnalysis.associatedEntities)
      ? dossier.clusterAnalysis.associatedEntities
      : [];
    if (associated.length > 0) {
      const entityTable = new Table({
        head: [pc.bold('Associated Address'), pc.bold('Identity / Role'), pc.bold('Confidence'), pc.bold('Relationship')],
        colWidths: [20, 26, 12, 34],
      });
      for (const ent of associated) {
        if (!ent) continue;
        entityTable.push([
          formatAddress(ent.address),
          ent.label || 'Entity',
          ent.confidence != null ? `${Math.round(Number(ent.confidence) * 100)}%` : 'N/A',
          ent.relationship || 'Associated',
        ]);
      }
      console.log(entityTable.toString());
    }
    console.log();
  }

  // Fund Origins
  if (dossier?.fundOrigins) {
    console.log(pc.bold(pc.underline('IV. CAPITAL PROVENANCE & ORIGIN')));
    console.log(
      `  Origin Node:   ${pc.cyan(formatAddress(dossier.fundOrigins.originAddress))} ${
        dossier.fundOrigins.originLabel ? `(${dossier.fundOrigins.originLabel})` : ''
      }`
    );
    console.log(`  Gateway/CEX:   ${pc.white(dossier.fundOrigins.firstBridgeOrCex || 'Direct On-Chain')}`);
    console.log(
      `  Initial Seed:  ${formatSol(dossier.fundOrigins.initialCapitalSol ?? 0)} on ${formatDate(
        dossier.fundOrigins.initialDate
      )}`
    );
    console.log();
  }

  // Chronology
  const timeline = Array.isArray(dossier?.chronology) ? dossier.chronology : [];
  if (timeline.length > 0) {
    console.log(pc.bold(pc.underline('V. CASE CHRONOLOGY & TIMELINE')));
    const timeTable = new Table({
      head: [pc.bold('Timestamp'), pc.bold('Event Type'), pc.bold('Forensic Significance')],
      colWidths: [22, 24, 46],
    });
    for (const item of timeline) {
      if (!item) continue;
      timeTable.push([item.timestamp || 'N/A', pc.yellow(item.event || 'Activity'), item.significance || '']);
    }
    console.log(timeTable.toString());
    console.log();
  }

  // Conclusion
  if (dossier?.conclusion) {
    printBox('VI. INVESTIGATOR CONCLUSION & RECOMMENDATION', pc.italic(dossier.conclusion), 'green');
  }
}

export function formatDossierMarkdown(dossier: DossierReport): string {
  const score = dossier?.riskAssessment?.score ?? 0;
  const level = dossier?.riskAssessment?.level ?? 'UNKNOWN';
  const factors = Array.isArray(dossier?.riskAssessment?.factors) ? dossier.riskAssessment.factors : [];
  const associated = Array.isArray(dossier?.clusterAnalysis?.associatedEntities)
    ? dossier.clusterAnalysis.associatedEntities
    : [];
  const timeline = Array.isArray(dossier?.chronology) ? dossier.chronology : [];

  return `# ${dossier?.classification || 'CONFIDENTIAL'}
**Case ID:** \`${dossier?.caseId || 'CASE-0000'}\`  
**Target Subject:** \`${dossier?.targetAddress || 'Unknown'}\`  
**Generated At:** ${dossier?.generatedAt || new Date().toISOString()}  
**Risk Level:** ${level} (${score}/100)

---

## 1. Executive Summary
${dossier?.executiveSummary || 'No summary available.'}

## 2. Risk Assessment
${factors.map(f => `- ${f}`).join('\n') || '- No specific risk factors identified.'}

## 3. Cluster Analysis
- **Primary Cluster:** ${dossier?.clusterAnalysis?.primaryCluster || 'Independent Node'}
- **Associated Entities:**
${associated
  .map(
    e =>
      `  - \`${e.address}\` (${e.label || 'Entity'}) - ${e.relationship || 'Associated'} [Confidence: ${
        e.confidence != null ? Math.round(Number(e.confidence) * 100) : 100
      }%]`
  )
  .join('\n') || '  - None'}

## 4. Fund Provenance
- **Origin Address:** \`${dossier?.fundOrigins?.originAddress || 'Unknown'}\` (${dossier?.fundOrigins?.originLabel || 'Unlabeled'})
- **Exchange / Gateway:** ${dossier?.fundOrigins?.firstBridgeOrCex || 'N/A'}
- **Initial Capital:** ${dossier?.fundOrigins?.initialCapitalSol ?? 0} SOL (${dossier?.fundOrigins?.initialDate || 'N/A'})

## 5. Timeline of Notable Events
| Timestamp | Event | Significance |
| :--- | :--- | :--- |
${timeline.map(c => `| ${c.timestamp || ''} | ${c.event || ''} | ${c.significance || ''} |`).join('\n') || '| N/A | N/A | N/A |'}

## 6. Conclusion
${dossier?.conclusion || 'No conclusion recorded.'}
`;
}

export function renderAsk(res: AskResponse, isJson = false): void {
  if (isJson) {
    printJson(res);
    return;
  }

  const header = `${pc.bold('Question:')} ${pc.white(res?.question || '')}${
    res?.sessionId ? `\n${pc.dim('Session ID: ' + res.sessionId)}` : ''
  }`;
  printBox('LANA AI // RESPONSE', header, 'cyan');

  console.log(res?.answer || '');
  console.log();

  const citations = Array.isArray(res?.citations) ? res.citations : [];
  if (citations.length > 0) {
    console.log(pc.dim('Sources & Telemetry:'));
    citations.forEach(c => console.log(pc.dim(`  - ${c}`)));
    console.log();
  }
}

export function renderWatchlist(items: WatchlistItem[], isJson = false): void {
  if (isJson) {
    printJson(items);
    return;
  }

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    console.log(pc.yellow('Your Lana watchlist is currently empty.'));
    console.log(`Add a target wallet with: ${pc.cyan('lana watch --add <address> --label "Whale"')}\n`);
    return;
  }

  printBox(
    'LANA // LOCAL WATCHLIST',
    `${pc.bold('Tracked Targets:')} ${list.length} wallets\nStored in ~/.config/lana/watchlist.json`,
    'magenta'
  );

  const table = new Table({
    head: [pc.bold('Address'), pc.bold('Label'), pc.bold('Tags'), pc.bold('Added At'), pc.bold('Notes')],
    colWidths: [22, 22, 20, 16, 20],
  });

  for (const item of list) {
    if (!item) continue;
    table.push([
      formatAddress(item.address),
      item.label || pc.dim('Unlabeled'),
      Array.isArray(item.tags) && item.tags.length > 0 ? item.tags.join(', ') : pc.dim('none'),
      formatDate(item.addedAt),
      item.notes || pc.dim('—'),
    ]);
  }
  console.log(table.toString());
  console.log();
}

export function exportToCsv(profile: WalletProfile): string {
  const rows = [
    ['Field', 'Value'],
    ['Address', profile?.address || ''],
    ['Risk Score', profile?.riskScore ?? 0],
    ['Risk Level', profile?.riskLevel || 'LOW'],
    ['SOL Balance', profile?.solBalance ?? 0],
    ['Token Count', profile?.tokenCount ?? 0],
    ['Total Tx Count', profile?.totalTxCount ?? 0],
    ['First Active', profile?.firstActivity || ''],
    ['Last Active', profile?.lastActivity || ''],
    ['Funding Address', profile?.fundingSource?.address || ''],
    ['Funding Label', profile?.fundingSource?.label || ''],
    ['Labels', (Array.isArray(profile?.labels) ? profile.labels : []).join('; ')],
  ];
  return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
