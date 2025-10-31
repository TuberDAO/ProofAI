'use client';

import { useState, useEffect } from 'react';
import { useSignMessage, useAccount, useConnect, useDisconnect } from 'wagmi';
import { useClientJob } from '../hooks/useClientJob';
import { SessionClient } from '../lib/session';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ||
  'https://www.oklink.com/megaeth-testnet';

interface ArtifactPreview {
  model: string;
  modelVersion: string;
  inputHash: string;
  timestampIso: string;
  codeVersion: string;
  nonce: string;
}

interface JobResult {
  jobId: string;
  attestationHash: string;
  txHash: string;
  receiptHash?: string | null;
  signingMode: 'server' | 'client' | 'session';
  signer?: string;
  submitter?: string;
  sessionId?: string;
  promptsUsed?: number;
  artifactPreview?: ArtifactPreview;
  payloadHash?: string;
}

interface HealthStatus {
  ok: boolean;
  chainId: number;
}

interface ServerMode {
  signingMode: 'server' | 'client';
  contractV1: string;
  contractV2: string | null;
  chainId: number;
}

function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      }}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
    >
      Connect Wallet
    </button>
  );
}

export default function Home() {
  const [input, setInput] = useState('');
  const [amountEth, setAmountEth] = useState('0.00001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [serverMode, setServerMode] = useState<ServerMode | null>(null);

  // Session state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionRemaining, setSessionRemaining] = useState('00:00');
  const [autoRenew, setAutoRenew] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  const { submitClientJob, address, isConnected } = useClientJob();
  const { signMessageAsync } = useSignMessage();

  // Fetch health status and server mode on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then((res) => res.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null));

    fetch(`${API_BASE_URL}/jobs/mode`)
      .then((res) => res.json())
      .then((data) => setServerMode(data))
      .catch(() => setServerMode(null));
  }, []);

  // Handle session renewal (for auto-renew)
  const handleRenewSession = async () => {
    if (!isConnected || !address || sessionLoading) return;

    setSessionLoading(true);

    try {
      await SessionClient.start({
        signMessage: async (message) => {
          return await signMessageAsync({ message });
        },
        address,
        minutes: 15,
      });

      console.log('[Page] Session renewed');
    } catch (err) {
      console.error('[Page] Failed to renew session:', err);
      setAutoRenew(false);
    } finally {
      setSessionLoading(false);
    }
  };

  // Session countdown timer
  useEffect(() => {
    const checkSession = () => {
      const session = SessionClient.get();
      const active = !!session && SessionClient.remaining() > 0;
      setSessionActive(active);
      
      if (active) {
        setSessionRemaining(SessionClient.formatRemaining());
        
        if (autoRenew && SessionClient.shouldRenew() && !sessionLoading) {
          handleRenewSession();
        }
      } else {
        setSessionRemaining('00:00');
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 1000);

    const unsubscribe = SessionClient.on((event) => {
      if (event === 'expired') {
        setError('Session expired. Please start a new session or submit with wallet signature.');
      } else if (event === 'cleared') {
        setSessionActive(false);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRenew, sessionLoading]);

  // Handle session start
  const handleStartSession = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    setSessionLoading(true);
    setError(null);

    try {
      await SessionClient.start({
        signMessage: async (message) => {
          return await signMessageAsync({ message });
        },
        address,
        minutes: 15,
      });

      setSessionActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setSessionLoading(false);
    }
  };

  // Handle session end
  const handleEndSession = () => {
    SessionClient.end();
    setSessionActive(false);
    setAutoRenew(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);
    setResult(null);

    try {
      let data;
      const signingMode = serverMode?.signingMode || 'server';

      // Check for active session first (highest priority)
      if (sessionActive && SessionClient.get()) {
        console.log('[Page] Submitting with session');
        
        const headers = SessionClient.attach({
          'Content-Type': 'application/json',
        });

        const response = await fetch(`${API_BASE_URL}/jobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: 'llama-3-8b-instruct',
            input: input,
            amountEth: amountEth,
          }),
        });

        data = await response.json();

        if (!response.ok) {
          if (response.status === 401 || response.status === 403 || response.status === 429) {
            SessionClient.end();
            setSessionActive(false);
          }
          if (response.status === 400) {
            setErrorDetails(data);
          }
          throw new Error(
            data.details
              ? Array.isArray(data.details)
                ? data.details.join('; ')
                : data.details
              : data.error || 'Failed to submit job'
          );
        }
      } else if (signingMode === 'client') {
        // CLIENT MODE: Use wallet signature
        if (!isConnected) {
          throw new Error('Please connect your wallet first');
        }

        console.log('[Page] Submitting with wallet signature');
        data = await submitClientJob({
          model: 'llama-3-8b-instruct',
          input: input,
        });
      } else {
        // SERVER MODE: Simple payload
        const response = await fetch(`${API_BASE_URL}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            prompt: input, 
            amountEth: amountEth 
          }),
        });

        data = await response.json();

        if (!response.ok) {
          if (response.status === 400) {
            setErrorDetails(data);
          }
          throw new Error(
            data.details
              ? Array.isArray(data.details)
                ? data.details.join('; ')
                : data.details
              : data.error || 'Failed to submit job'
          );
        }
      }

      setResult(data);
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled =
    loading ||
    !input.trim() ||
    (serverMode?.signingMode === 'client' && !isConnected && !sessionActive);

  const signingMode = serverMode?.signingMode || 'server';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
            PrivateGPT on MegaETH
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg mb-4">
            Submit AI prompts with on-chain attestation
          </p>

          {/* Dev Mode Banner */}
          {signingMode === 'server' && (
            <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg text-sm">
              <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                ⚠️ Dev mode: Server is signing on your behalf. Not for production.
              </span>
            </div>
          )}

          {/* Network Badge & Wallet */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {health && health.ok && health.chainId === 6342 ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 dark:text-green-200 font-medium">
                  MegaETH (6342) — Ready
                  {signingMode === 'client' && ' (client-signed)'}
                  {signingMode === 'server' && ' (server-signed)'}
                </span>
              </div>
            ) : health ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-full text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                  Wrong network ({health.chainId})
                </span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full text-sm">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  Not connected
                </span>
              </div>
            )}

            {/* Show Connect Wallet button in client mode */}
            {signingMode === 'client' && (
              <WalletButton />
            )}
          </div>

          {/* Privacy Notice for Client Mode */}
          {signingMode === 'client' && isConnected && (
            <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg text-sm">
              <span className="text-blue-800 dark:text-blue-200">
                🔒 Data never leaves your device unencrypted. Job is signed by your wallet.
              </span>
            </div>
          )}
        </header>

        <main className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          {/* Session Controls */}
          {signingMode === 'client' && isConnected && (
            <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Session badge */}
                  {sessionActive ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-full text-sm">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-800 dark:text-green-200 font-medium">
                        Session active ({sessionRemaining})
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-full text-sm">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        No session
                      </span>
                    </div>
                  )}

                  {/* Auto-renew checkbox */}
                  {sessionActive && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRenew}
                        onChange={(e) => setAutoRenew(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                      Auto-renew
                    </label>
                  )}
                </div>

                {/* Start/End buttons */}
                <div className="flex gap-2">
                  {!sessionActive ? (
                    <button
                      type="button"
                      onClick={handleStartSession}
                      disabled={sessionLoading || !isConnected}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      {sessionLoading ? 'Starting...' : 'Start 15-min secure session'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEndSession}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      End session
                    </button>
                  )}
                </div>
              </div>

              {/* Info text */}
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                {sessionActive ? (
                  <>🔑 Session active: Submit multiple prompts without wallet popups. Session expires in {sessionRemaining}.</>
                ) : (
                  <>🔐 Start a session to sign once and submit multiple prompts (15 min window).</>
                )}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Your AI Prompt
              </label>
              <textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Enter your private AI prompt here..."
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                required
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Max 10,000 characters. Your prompt is hashed before submission.
              </p>
            </div>

            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Payment Amount (ETH)
              </label>
              <input
                type="number"
                id="amount"
                value={amountEth}
                onChange={(e) => setAmountEth(e.target.value)}
                step="0.00001"
                min="0.00001"
                max="0.01"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Minimum: 0.00001 ETH (testnet)
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className={`w-full py-4 px-6 rounded-lg font-semibold text-white transition-all duration-200 ${
                isSubmitDisabled
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin h-5 w-5 mr-3"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  {signingMode === 'client' 
                    ? (sessionActive ? 'Submitting...' : 'Signing & Submitting...') 
                    : 'Submitting...'}
                </span>
              ) : signingMode === 'client' && !isConnected && !sessionActive ? (
                '🔒 Connect Wallet to Submit'
              ) : sessionActive ? (
                '🚀 Submit (session)'
              ) : (
                `🚀 ${signingMode === 'client' ? 'Submit (client-signed)' : 'Run Private AI'}`
              )}
            </button>
          </form>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
              <p className="text-red-800 dark:text-red-200 font-medium">
                ❌ Error: {error}
              </p>
              {errorDetails && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-red-700 dark:text-red-300 text-sm">
                    Show error details
                  </summary>
                  <pre className="mt-2 text-xs bg-red-50 dark:bg-red-950 p-2 rounded overflow-x-auto">
                    {JSON.stringify(errorDetails, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <h3 className="text-xl font-semibold mb-4 text-green-800 dark:text-green-200">
                ✅ Job Submitted Successfully!
              </h3>

              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Job ID:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white font-mono">
                    {result.jobId}
                  </span>
                </div>

                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Attestation Hash:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white font-mono text-sm break-all">
                    {result.attestationHash}
                  </span>
                </div>

                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Signing Mode:
                  </span>
                  <span className="ml-2 text-gray-900 dark:text-white font-mono text-sm">
                    {result.signingMode}
                    {result.signingMode === 'session' && result.promptsUsed && (
                      <span className="text-gray-600 dark:text-gray-400"> (prompt #{result.promptsUsed})</span>
                    )}
                  </span>
                </div>

                {(result.signer || result.submitter) && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {result.signingMode === 'session' ? 'Session owner:' : 'Signed by:'}
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono text-sm">
                      {result.signer || result.submitter}
                    </span>
                  </div>
                )}

                {result.receiptHash && (
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Receipt Hash:
                    </span>
                    <span className="ml-2 text-gray-900 dark:text-white font-mono text-sm break-all">
                      {result.receiptHash}
                    </span>
                  </div>
                )}

                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Transaction:
                  </span>
                  <a
                    href={`${EXPLORER_URL}/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-blue-600 dark:text-blue-400 hover:underline font-mono text-sm"
                  >
                    {result.txHash.substring(0, 10)}...{result.txHash.substring(result.txHash.length - 8)} →
                  </a>
                </div>
              </div>

              {/* Security Details (Collapsible) */}
              {result.artifactPreview && (
                <details className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
                  <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400">
                    🔒 Security Details (Attestation Artifact)
                  </summary>
                  <pre className="mt-3 text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded-sm overflow-x-auto text-gray-800 dark:text-gray-200">
                    {JSON.stringify(result.artifactPreview, null, 2)}
                  </pre>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    Only the hash of this artifact is stored on-chain. The raw
                    prompt is never sent or stored.
                  </p>
                </details>
              )}
            </div>
          )}
        </main>

        <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Powered by MegaETH Testnet • Privacy-first AI • On-chain Attestation
          </p>
          {signingMode === 'client' && (
            <p className="mt-1">
              🔐 Client-signed mode: Your wallet, your control
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
