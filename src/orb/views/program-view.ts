import pc from 'picocolors';
import type { OrbProgramDetails } from '../types.js';

export interface ProgramViewOptions {
  idl?: boolean;
  noAi?: boolean;
  json?: boolean;
}

const LINE = '─'.repeat(62);

export function renderOrbProgram(prog: OrbProgramDetails, options: ProgramViewOptions = {}): void {
  if (options.json) {
    console.log(JSON.stringify(prog, null, 2));
    return;
  }

  if (options.idl) {
    if (prog.idlJson) {
      console.log(JSON.stringify(prog.idlJson, null, 2));
    } else {
      console.log(pc.yellow(`\nNo IDL found on registry for program ${prog.address}.\n`));
    }
    return;
  }

  // 1. PROGRAM HEADER
  console.log(pc.bold(pc.white('\nPROGRAM')));
  console.log(pc.dim(LINE));

  console.log(`${pc.bold('Address    ')} ${pc.cyan(prog.address)}`);
  console.log(`${pc.bold('Name       ')} ${pc.white(prog.name)}`);
  console.log(`${pc.bold('Label      ')} ${pc.dim(prog.label)}`);
  console.log(`${pc.bold('Executable ')} ${prog.executable ? pc.green('true') : pc.red('false')}`);
  console.log(`${pc.bold('Owner      ')} ${pc.dim(prog.owner)}`);
  console.log(`${pc.bold('Slot       ')} ${prog.slot != null ? prog.slot.toLocaleString() : 'N/A'}`);
  console.log(`${pc.bold('Data Len   ')} ${prog.dataLen.toLocaleString()} bytes`);

  const authColor = prog.authority === 'Immutable' ? pc.green : pc.yellow;
  console.log(`${pc.bold('Authority  ')} ${authColor(prog.authority)}`);

  // 2. VERIFICATION & SECURITY
  console.log(pc.bold(pc.white('\nVERIFICATION & SECURITY')));
  console.log(pc.dim(LINE));

  console.log(`${pc.bold('Verified    ')} ${prog.verified ? pc.green('Yes') : pc.yellow('No')}`);
  console.log(
    `${pc.bold('IDL         ')} ${prog.idlStatus === 'Available' ? pc.green('Available') : pc.dim('Not found')}`
  );
  console.log(
    `${pc.bold('security.txt')} ${prog.securityTxt === 'Present' ? pc.green('Present') : pc.dim('Missing')}`
  );
  console.log(`${pc.bold('Source      ')} ${pc.dim(prog.source)}`);

  // 3. AI SUMMARY
  if (!options.noAi && prog.aiSummary) {
    console.log(pc.bold(pc.white('\nAI SUMMARY')));
    console.log(pc.dim(LINE));
    console.log(pc.italic(prog.aiSummary));
  }

  // 4. IDL (summary)
  console.log(pc.bold(pc.white('\nIDL (summary)')));
  console.log(pc.dim(LINE));

  if (prog.idlInstructions.length === 0) {
    console.log(pc.dim('No published IDL instructions discovered for this program.'));
  } else {
    console.log(pc.bold('Instructions:'));
    for (const ixName of prog.idlInstructions) {
      console.log(`  ${pc.cyan('•')} ${ixName}`);
    }
    if (prog.idlStatus === 'Available') {
      console.log(pc.dim('\nTip: Run with --idl to export the full IDL JSON schema.'));
    }
  }

  // 5. RECENT ACTIVITY (last 24h)
  console.log(pc.bold(pc.white('\nRECENT ACTIVITY (last 24h)')));
  console.log(pc.dim(LINE));

  console.log(
    `${pc.bold('Txns        ')} ${prog.recentActivity.txns24h ? prog.recentActivity.txns24h.toLocaleString() : '0'}`
  );
  if (prog.recentActivity.lastActivity) {
    console.log(`${pc.bold('Last Active ')} ${prog.recentActivity.lastActivity}`);
  }

  // 6. UPGRADE HISTORY
  console.log(pc.bold(pc.white('\nUPGRADE HISTORY')));
  console.log(pc.dim(LINE));

  for (const item of prog.upgradeHistory) {
    console.log(`• ${item}`);
  }
  console.log();
}
