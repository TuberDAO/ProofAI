/**
 * Model inference helper - Single integration point for LLM backends
 * 
 * This is the ONLY place in the codebase that talks to external LLM APIs.
 * Both SoftwareInferenceEngine and future NitroTEEInferenceEngine implementations
 * will call this function, keeping a single integration point for LLM backends.
 * 
 * To connect to a real LLM server, set the LLM_API_URL environment variable.
 * If LLM_API_URL is not set or empty, this function returns stubbed responses.
 * 
 * Example LLM server setup:
 * - llama.cpp server: https://github.com/ggerganov/llama.cpp/tree/master/examples/server
 * - vLLM: https://docs.vllm.ai/en/latest/
 * - Ollama: https://ollama.ai/
 */

export interface ModelInferenceResult {
  output: string;
  model: string;
  usedStub: boolean;       // true if we did NOT call any external LLM
}

/**
 * Run model inference on a prompt
 * 
 * This is the ONLY function that communicates with external LLM backends.
 * Callers should check the `usedStub` field to determine if a real backend was used.
 * The LLM_API_URL environment variable controls whether we are in "real LLM" vs "stub" mode.
 * 
 * @param prompt - The input prompt for the model
 * @param options - Required configuration for the model (model, maxTokens, temperature)
 * @returns Model output with metadata including usedStub flag
 */
export async function runModelInference(
  prompt: string,
  options: { model: string; maxTokens: number; temperature: number }
): Promise<ModelInferenceResult> {
  const { model, maxTokens, temperature } = options;
  
  // Read LLM_API_URL from environment
  const llmApiUrl = process.env.LLM_API_URL?.trim();
  
  // If LLM_API_URL is missing or empty, return stubbed response
  if (!llmApiUrl) {
    return {
      output: `[STUBBED MODEL RESPONSE]\n\nModel: ${model}\nPrompt preview: "${prompt.slice(0, 160)}${prompt.length > 160 ? '...' : ''}"`,
      model,
      usedStub: true,
    };
  }
  
  // Real LLM API call logic
  try {
    console.log(`[LLM] Calling model inference: ${model} at ${llmApiUrl}`);
    
    // Make HTTP POST to LLM_API_URL (assumes OpenAI/vLLM-style API)
    const requestBody = {
      model,
      prompt,
      max_tokens: maxTokens,
      temperature,
    };
    
    const response = await fetch(llmApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      // Set timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    if (!response.ok) {
      throw new Error(`LLM API returned status ${response.status}: ${response.statusText}`);
    }
    
    const data = (await response.json()) as { output: string };
    
    // Expect a JSON response with a top-level `output` string
    if (!data.output || typeof data.output !== 'string') {
      throw new Error('LLM API response missing or invalid output field');
    }
    
    console.log(`[LLM] Inference completed successfully (${data.output.length} chars)`);
    
    return {
      output: data.output,
      model,
      usedStub: false,
    };
    
  } catch (error) {
    // On error (network, non-2xx, missing fields, etc.), fall back to stub
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LLM] Inference failed: ${errorMessage}. Falling back to stub.`);
    
    return {
      output: `[STUBBED MODEL RESPONSE]\n\nModel: ${model}\nPrompt preview: "${prompt.slice(0, 160)}${prompt.length > 160 ? '...' : ''}"\n\nError: ${errorMessage}`,
      model,
      usedStub: true,
    };
  }
}

