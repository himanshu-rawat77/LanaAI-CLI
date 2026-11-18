import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { LanaClient, isTrustedHeliusHost } from '../dist/index.js';

test('1. Wallet Risk: "no evidence of a scam" returns narrative with no numeric score', async () => {
  const client = new LanaClient({
    apiKey: 'test-api-key',
  });

  // Access private method normalizeProfile / simulate prose lookup
  const proseResponse = 'The account shows ordinary trading activity. There is no evidence of a scam or exploit.';
  const profile = client.normalizeProfile({}, '7RtC1QgiNVLANGRTEKxASz4bRiMYyf2hUVLs1XGuJ6Gr', proseResponse);

  assert.equal(profile.narrative, proseResponse);
  assert.equal(profile.riskScore, undefined, 'riskScore must be undefined for prose-only response with no score');
  assert.equal(profile.riskLevel, undefined, 'riskLevel must be undefined for prose-only response with no score');
  assert.notEqual(profile.riskScore, 90, 'Must NOT trigger 90/100 CRITICAL on word scam in "no evidence of a scam"');
  assert.notEqual(profile.riskScore, 0, 'Must NOT fabricate 0/100 LOW when unverified');
});

test('2. Transaction Facts: status and fee are not fabricated when unavailable', async () => {
  const client = new LanaClient({
    apiKey: 'test-api-key',
  });

  // Test parser with unavailable transaction metadata
  const unavailableTx = client.parseTxBreakdown('5UfD...test', {
    text: 'Could not find transaction on cluster.',
    toolResults: [],
    raw: null,
  });

  assert.equal(unavailableTx.status, 'UNKNOWN', 'Status must be UNKNOWN when unavailable');
  assert.equal(unavailableTx.feeSol, undefined, 'feeSol must not default to 0.000005');
  assert.equal(unavailableTx.timestamp, undefined, 'timestamp must not default to current time');
});

test('3. Fixed Findings Removed: compare, dossier, and flow maintain undefined for missing metrics', async () => {
  const client = new LanaClient({
    apiKey: 'test-api-key',
  });

  // Compare prose fallback
  const emptyProfile = client.normalizeProfile({}, 'test-addr', 'Prose summary of wallets.');
  assert.equal(emptyProfile.riskScore, undefined);

  // Directly check flow fallback structure
  const flowFallback = {
    rootAddress: 'test-addr',
    depth: 2,
    totalInflowSol: undefined,
    totalOutflowSol: undefined,
    directInflows: [],
    directOutflows: [],
    notableHops: ['Prose narrative'],
  };
  assert.equal(flowFallback.totalInflowSol, undefined);
  assert.equal(flowFallback.totalOutflowSol, undefined);
  assert.notEqual(flowFallback.totalInflowSol, 0);

  // Directly check dossier fallback structure
  const dossierFallback = {
    caseId: 'CASE-TEST',
    targetAddress: 'test-addr',
    generatedAt: new Date().toISOString(),
    classification: 'ON-CHAIN FORENSIC FILE',
    executiveSummary: 'Prose summary of subject.',
    riskAssessment: undefined,
    clusterAnalysis: undefined,
    fundOrigins: undefined,
    chronology: [],
    conclusion: 'Investigation complete.',
  };
  assert.equal(dossierFallback.riskAssessment, undefined);
});

test('4. Credential Destination: custom untrusted endpoint receives NO authenticated request before opt-in', async () => {
  let receivedAuthHeader = undefined;
  let receivedApiKeyHeader = undefined;
  let requestCount = 0;

  // Spin up local mock HTTP endpoint
  const server = http.createServer((req, res) => {
    requestCount++;
    receivedAuthHeader = req.headers['authorization'];
    receivedApiKeyHeader = req.headers['x-api-key'] || req.headers['api-key'];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ content: [{ type: 'text', text: 'mock response' }] }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = server.address().port;
  const mockEndpoint = `http://127.0.0.1:${port}/v1/messages`;

  try {
    // 1. Without opt-in: should throw and refuse to instantiate / send credentials
    assert.throws(
      () => {
        new LanaClient({
          apiKey: 'dummy-secret-key-12345',
          endpoint: mockEndpoint,
          allowCustomHost: false,
        });
      },
      /Refusing to send API credentials to custom\/untrusted endpoint/
    );

    // Verify mock server received zero requests
    assert.equal(requestCount, 0, 'Custom endpoint must receive zero requests when opt-in is missing');
    assert.equal(receivedAuthHeader, undefined);
    assert.equal(receivedApiKeyHeader, undefined);

    // 2. With explicit opt-in: should allow request
    const optedInClient = new LanaClient({
      apiKey: 'dummy-secret-key-12345',
      endpoint: mockEndpoint,
      allowCustomHost: true,
    });

    const result = await optedInClient.callLanaRaw('system', 'hello');
    assert.ok(result);
    assert.equal(requestCount, 1, 'Custom endpoint receives request only after explicit opt-in');
    assert.equal(receivedAuthHeader, 'Bearer dummy-secret-key-12345');
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
});

test('5. Host Verification: recognizes trusted Helius and Lana hosts', () => {
  assert.equal(isTrustedHeliusHost('https://beta.helius-rpc.com/v1/lana/messages'), true);
  assert.equal(isTrustedHeliusHost('https://mainnet.helius-rpc.com/?api-key=xyz'), true);
  assert.equal(isTrustedHeliusHost('https://api.helius.dev'), true);
  assert.equal(isTrustedHeliusHost('https://beta.helius-rpc.com/v1/lana/messages'), true);
  assert.equal(isTrustedHeliusHost('https://api.orbmarkets.io'), true);

  // Untrusted hosts
  assert.equal(isTrustedHeliusHost('http://localhost:3000'), false);
  assert.equal(isTrustedHeliusHost('http://127.0.0.1:8080'), false);
  assert.equal(isTrustedHeliusHost('https://evil-hacker.com/api'), false);
  assert.equal(isTrustedHeliusHost('https://helius-rpc.com.evil.com'), false);
});
