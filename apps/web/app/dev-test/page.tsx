"use client";

import React, { useState } from "react";
import { postDevTestJob } from "../../lib/apiClient";

export default function DevTestPage() {
  const [prompt, setPrompt] = useState(
    "Say hello and mention that this is the dev-test endpoint."
  );
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await postDevTestJob(prompt);
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Dev Test: /jobs/dev-test</h1>
      <p>This page calls the ProofAI dev-only endpoint on port 8081.</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", marginBottom: "0.5rem" }}
      />
      <button onClick={handleRun} disabled={loading}>
        {loading ? "Running…" : "Run dev test"}
      </button>
      {error && (
        <pre style={{ color: "red", marginTop: "1rem", whiteSpace: "pre-wrap" }}>
          {error}
        </pre>
      )}
      {result && (
        <section style={{ marginTop: "1rem" }}>
          <h2>Model Output</h2>
          <p>
            <strong>Text:</strong> {result.modelOutput?.text ?? "(no text field)"}
          </p>
          <h3>Raw JSON</h3>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}

