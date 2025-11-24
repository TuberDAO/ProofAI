/**
 * API Client for ProofAI Backend
 * 
 * Helper functions for calling the backend API endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8081";

export interface DevTestJobResponse {
  devMode: boolean;
  skipOnChain: boolean;
  signingMode: "server";
  jobId: string;
  txHash: string | null;
  receiptHash: string | null;
  attestationHash: string;
  modelOutput: {
    text: string;
    model: string;
    usedStub: boolean;
  };
  jobHash: string;
  attestation: {
    mode: string;
    provider?: string;
    region?: string;
    instanceType?: string;
    logging?: string;
    training?: string;
    [key: string]: unknown;
  };
}

/**
 * Call the dev-only /jobs/dev-test endpoint
 * This endpoint never touches the blockchain and only runs inference
 */
export async function postDevTestJob(
  prompt: string,
  model = "llama-3-8b-instruct"
): Promise<DevTestJobResponse> {
  const res = await fetch(`${API_BASE_URL}/jobs/dev-test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, model }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Dev test request failed: ${res.status} ${res.statusText} - ${text}`
    );
  }

  return res.json();
}

