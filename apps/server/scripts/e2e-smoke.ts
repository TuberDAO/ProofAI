import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import * as path from 'node:path';

function run(cmd: string, args: string[], opts: any = {}) {
  return spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, ...opts });
}

async function waitFor(lineRegex: RegExp, proc: ReturnType<typeof run>, timeoutMs = 30000) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for: ${lineRegex}`)), timeoutMs);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (lineRegex.test(text)) {
        clearTimeout(timer);
        proc.stdout?.off('data', onData);
        resolve();
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', (b) => process.stderr.write(b.toString()));
  });
}

async function main() {
  // 1) Start server in dev
  console.log('⏳ Starting server (dev)...');
  const server = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--filter', 'server', 'dev'], {
    cwd: path.resolve('.'),
    env: { ...process.env, NODE_ENV: 'development', PORT: '4000' },
  });

  try {
    // 2) Wait for readiness log (tune regex to your server banner)
    await waitFor(/(listening|server|ready).*(4000)/i, server, 45000);
  } catch (err) {
    console.error('❌ Server did not become ready:', (err as Error).message);
    server.kill();
    process.exit(1);
  }

  // 3) Run client-mode smoke script
  console.log('\n▶ Running client smoke...\n');
  const smoke = run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['--filter', 'server', 'tsx', 'apps/server/scripts/smoke-client.ts'],
    { cwd: path.resolve('.') }
  );

  let output = '';
  let errorOutput = '';
  smoke.stdout?.on('data', (b) => { const t = b.toString(); process.stdout.write(t); output += t; });
  smoke.stderr?.on('data', (b) => { const t = b.toString(); process.stderr.write(t); errorOutput += t; });

  const code: number = await new Promise((resolve) => smoke.on('close', resolve as any));
  
  console.log('\n--- End of smoke script output ---\n');
  // 4) Try to extract tx hash / job / receipt from output (best-effort)
  const allOutput = output + errorOutput;
  const txMatch = allOutput.match(/TX Hash: (0x[a-fA-F0-9]{64})/i);
  const txHash = txMatch ? txMatch[1] : '(no tx hash detected)';
  
  const jobIdMatch = allOutput.match(/Job ID: ([^\s\n]+)/i);
  const jobId = jobIdMatch ? jobIdMatch[1] : '(no job ID detected)';
  
  const submitterMatch = allOutput.match(/Recovered Submitter: (0x[a-fA-F0-9]{40})/i);
  const submitter = submitterMatch ? submitterMatch[1] : '(no submitter detected)';

  console.log('\n=== E2E SUMMARY ===');
  console.log('Smoke exit code:', code);
  console.log('Job ID:', jobId);
  console.log('TX Hash:', txHash);
  console.log('Recovered submitter:', submitter);

  // 5) Shutdown server
  console.log('\n⏹ Stopping server...');
  server.kill();

  process.exit(code === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('E2E error:', e);
  process.exit(1);
});

