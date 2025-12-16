/**
 * Audit logging (append-only JSON)
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { keccak256, toBytes } from 'viem';

const AUDIT_LOG_PATH = './dist/audit.log';

// Ensure log directory exists
try {
  mkdirSync(dirname(AUDIT_LOG_PATH), { recursive: true });
} catch (error) {
  // Directory may already exist
}

export interface AuditEvent {
  ts: string; // ISO timestamp
  ip: string;
  ua?: string; // User agent
  mode: 'server' | 'client' | 'session';
  route: string;
  attestationHash?: string;
  sessionIdHash?: string; // keccak256(sessionId) for privacy
  submitter?: string; // 0x address
  chainId?: number;
  contract?: string;
  result: 'ok' | 'error';
  status: number;
  errCode?: string;
  errMsg?: string;
  metadata?: Record<string, any>;
}

/**
 * Log audit event to console and file
 */
export function audit(event: AuditEvent): void {
  const entry = JSON.stringify(event);

  // Console in dev
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUDIT] ${entry}`);
  }

  // Append to file (newline-delimited JSON)
  try {
    appendFileSync(AUDIT_LOG_PATH, entry + '\n', 'utf-8');
  } catch (error) {
    console.error('[AUDIT] Failed to write to log file:', error);
  }
}

/**
 * Hash sessionId for audit log (privacy)
 */
export function hashSessionId(sessionId: string): string {
  return keccak256(toBytes(sessionId));
}

/**
 * Create audit event from request/response
 */
export function createAuditEvent(params: {
  request: any;
  route: string;
  mode: 'server' | 'client' | 'session';
  status: number;
  result: 'ok' | 'error';
  attestationHash?: string;
  sessionId?: string;
  submitter?: string;
  chainId?: number;
  contract?: string;
  errCode?: string;
  errMsg?: string;
  metadata?: Record<string, any>;
}): AuditEvent {
  return {
    ts: new Date().toISOString(),
    ip: params.request.ip || 'unknown',
    ua: params.request.headers['user-agent'],
    mode: params.mode,
    route: params.route,
    attestationHash: params.attestationHash,
    sessionIdHash: params.sessionId ? hashSessionId(params.sessionId) : undefined,
    submitter: params.submitter,
    chainId: params.chainId,
    contract: params.contract,
    result: params.result,
    status: params.status,
    errCode: params.errCode,
    errMsg: params.errMsg,
    metadata: params.metadata,
  };
}















