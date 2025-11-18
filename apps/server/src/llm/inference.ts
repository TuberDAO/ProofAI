/**
 * Model inference helper
 * 
 * This module provides a simple interface for running model inference.
 * By default, it returns stubbed responses. To connect to a real LLM server,
 * set the LLM_API_URL environment variable.
 * 
 * Example LLM server setup:
 * - llama.cpp server: https://github.com/ggerganov/llama.cpp/tree/master/examples/server
 * - vLLM: https://docs.vllm.ai/en/latest/
 * - Ollama: https://ollama.ai/
 */

export interface ModelInferenceOptions {
  model?: string;          // logical model name, default to "llama-3-8b-instruct"
  temperature?: number;    // optional, default 0.7
  maxTokens?: number;      // optional, default 512
}

export interface ModelInferenceResult {
  output: string;
  model: string;
  usedStub: boolean;       // true if we did NOT call any external LLM
}

/**
 * Flexible type for LLM API responses
 * Supports multiple common formats: llama.cpp, vLLM, Ollama, OpenAI-compatible, etc.
 */
type LLMApiResponse = {
  // Direct text fields (llama.cpp, simple APIs)
  text?: string;
  content?: string;
  response?: string;
  
  // OpenAI-style / vLLM-style
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
  
  // Ollama-style
  output?: {
    text?: string;
  } | string;
  
  // Allow extra fields without being strict
  [key: string]: unknown;
}

/**
 * Run model inference on a prompt
 * 
 * @param prompt - The input prompt for the model
 * @param options - Optional configuration for the model
 * @returns Model output with metadata
 */
export async function runModelInference(
  prompt: string,
  options: ModelInferenceOptions = {}
): Promise<ModelInferenceResult> {
  const model = options.model ?? 'llama-3-8b-instruct';
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 512;
  
  // Check if LLM API URL is configured
  const llmApiUrl = process.env.LLM_API_URL?.trim();
  
  // If no LLM API URL is set, return stub response
  if (!llmApiUrl) {
    return {
      output: `[STUBBED MODEL RESPONSE]\n\nModel: ${model}\nPrompt preview: "${prompt.slice(0, 160)}${prompt.length > 160 ? '...' : ''}"\n\nThis is a placeholder response. Set LLM_API_URL environment variable to connect to a real LLM server (e.g., llama.cpp, vLLM, or Ollama).`,
      model,
      usedStub: true,
    };
  }
  
  // Real LLM API call logic
  try {
    console.log(`[LLM] Calling model inference: ${model} at ${llmApiUrl}`);
    
    // TODO: Customize this request format based on your LLM server
    // This is a generic format that works with many LLM servers
    // Adjust the request body format for your specific backend:
    //
    // For llama.cpp server: POST /completion
    // Body: { prompt, n_predict: maxTokens, temperature }
    //
    // For vLLM (OpenAI-compatible): POST /v1/completions
    // Body: { model, prompt, max_tokens, temperature }
    //
    // For Ollama: POST /api/generate
    // Body: { model, prompt, options: { temperature, num_predict } }
    
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
    
    const data = (await response.json()) as LLMApiResponse;
    
    // Safely extract text from various response formats
    // Priority order: response, content, text, choices array, output field
    const extractedText = 
      data.response ??
      data.content ??
      data.text ??
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      (typeof data.output === 'string' ? data.output : data.output?.text) ??
      null;
    
    // Fallback to JSON stringification if no known field contains text
    const output = extractedText ?? JSON.stringify(data);
    
    console.log(`[LLM] Inference completed successfully (${output.length} chars)`);
    
    return {
      output,
      model,
      usedStub: false,
    };
    
  } catch (error) {
    // On any error, fall back to stub mode
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[LLM] Inference failed: ${errorMessage}. Falling back to stub.`);
    
    return {
      output: `[LLM BACKEND UNAVAILABLE]\n\nAttempted to call: ${llmApiUrl}\nError: ${errorMessage}\n\nFalling back to stubbed response for prompt: "${prompt.slice(0, 160)}${prompt.length > 160 ? '...' : ''}"`,
      model,
      usedStub: true,
    };
  }
}

