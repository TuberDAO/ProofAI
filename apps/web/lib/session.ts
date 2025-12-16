/**
 * Session Client
 * 
 * Singleton for managing client-signed sessions with automatic expiry tracking
 */

const DEFAULT_MIN = Number(process.env.NEXT_PUBLIC_SESSION_DEFAULT_MINUTES ?? 15);
const MAX_MIN = Number(process.env.NEXT_PUBLIC_SESSION_MAX_MINUTES ?? 30);
const STORAGE_KEY = 'pva.session';

interface StoredSession {
  sessionId: string;
  expiry: number; // unix seconds
}

type SessionEventHandler = (event: 'expired' | 'renewed' | 'cleared') => void;

class SessionClientImpl {
  private session: StoredSession | null = null;
  private timer: NodeJS.Timeout | null = null;
  private listeners: SessionEventHandler[] = [];

  constructor() {
    // Restore from localStorage on init (client-side only)
    if (typeof window !== 'undefined') {
      this.restoreFromStorage();
    }
  }

  /**
   * Restore session from localStorage if not expired
   */
  private restoreFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored) as StoredSession;
      const now = Math.floor(Date.now() / 1000);

      if (parsed.expiry > now) {
        this.session = parsed;
        this.startTimer();
      } else {
        // Expired, clear it
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to restore session from storage:', error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  /**
   * Start tracking timer for expiry
   */
  private startTimer() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Check every second
    this.timer = setInterval(() => {
      if (!this.session) {
        this.stopTimer();
        return;
      }

      const remaining = this.remaining();
      if (remaining <= 0) {
        this.handleExpiry();
      }
    }, 1000);
  }

  /**
   * Stop tracking timer
   */
  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Handle session expiry
   */
  private handleExpiry() {
    console.log('[SessionClient] Session expired');
    this.end();
    this.emit('expired');
  }

  /**
   * Emit event to listeners
   */
  private emit(event: 'expired' | 'renewed' | 'cleared') {
    this.listeners.forEach((handler) => handler(event));
  }

  /**
   * Subscribe to session events
   */
  on(handler: SessionEventHandler) {
    this.listeners.push(handler);
    return () => {
      this.listeners = this.listeners.filter((h) => h !== handler);
    };
  }

  /**
   * Start a new session
   */
  async start(params: {
    signMessage: (message: string) => Promise<string>;
    address: string;
    minutes?: number;
  }): Promise<StoredSession> {
    const { signMessage, address, minutes = DEFAULT_MIN } = params;

    // Validate duration
    const duration = Math.min(Math.max(1, minutes), MAX_MIN);
    const expiry = Math.floor(Date.now() / 1000) + duration * 60;

    // Generate nonce (16 bytes random)
    const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 6342);
    const contract =
      process.env.NEXT_PUBLIC_JOB_REGISTRY_V2_ADDRESS ||
      '0x9E4fA3B7f61b4eb19cD501e5f05514dfc024fA1E';

    // Build strict PVA::SESSION message
    const message = this.buildSessionMessage({
      chainId,
      contract,
      submitter: address,
      expiry,
      nonce,
    });

    console.log('[SessionClient] Signing PVA::SESSION message...');

    // Sign with wallet
    const signature = await signMessage(message);

    // POST /sessions
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${apiBase}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submitter: address,
        signature,
        message,
        chainId,
        contract,
        expiry,
        nonce,
        policy: {
          maxPrompts: 100,
          allowedModels: ['llama-3-8b-instruct', 'llama3-instruct'],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Session creation failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    const { sessionId } = data;

    if (!sessionId) {
      throw new Error('No sessionId in response');
    }

    // Store session
    this.session = { sessionId, expiry };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.session));

    // Start timer
    this.startTimer();

    console.log('[SessionClient] Session created:', { sessionId, expiry });

    return this.session;
  }

  /**
   * Build strict 6-line PVA::SESSION message
   */
  private buildSessionMessage(params: {
    chainId: number;
    contract: string;
    submitter: string;
    expiry: number;
    nonce: string;
  }): string {
    return `PVA::SESSION
chainId:${params.chainId}
contract:${params.contract}
submitter:${params.submitter}
expiry:${params.expiry}
nonce:${params.nonce}`;
  }

  /**
   * End the current session
   */
  end() {
    console.log('[SessionClient] Ending session');
    this.session = null;
    this.stopTimer();

    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }

    this.emit('cleared');
  }

  /**
   * Get current session
   */
  get(): StoredSession | null {
    // Check if expired
    if (this.session && this.remaining() <= 0) {
      this.handleExpiry();
      return null;
    }

    return this.session;
  }

  /**
   * Get remaining time in seconds (0 if expired or no session)
   */
  remaining(): number {
    if (!this.session) return 0;

    const now = Math.floor(Date.now() / 1000);
    const remaining = this.session.expiry - now;

    return Math.max(0, remaining);
  }

  /**
   * Format remaining time as MM:SS
   */
  formatRemaining(): string {
    const seconds = this.remaining();
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Attach session header to request headers if session is active
   */
  attach(headers: Record<string, string> = {}): Record<string, string> {
    const session = this.get();
    if (session) {
      return {
        ...headers,
        'x-session-id': session.sessionId,
      };
    }
    return headers;
  }

  /**
   * Check if session should be renewed (< 60s remaining)
   */
  shouldRenew(): boolean {
    return this.remaining() > 0 && this.remaining() <= 60;
  }
}

// Singleton instance
export const SessionClient = new SessionClientImpl();

// Also export the helper for building PVA::SESSION messages
export function buildPvaSessionMessage(params: {
  chainId: number;
  contract: string;
  submitter: string;
  expiry: number;
  nonce: string;
}): string {
  return `PVA::SESSION
chainId:${params.chainId}
contract:${params.contract}
submitter:${params.submitter}
expiry:${params.expiry}
nonce:${params.nonce}`;
}















