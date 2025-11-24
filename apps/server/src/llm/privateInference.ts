/**
 * TEE-ready inference abstraction
 * 
 * This module provides a clean abstraction for private inference that can be
 * swapped between software-only and TEE implementations without changing routes or frontend.
 */

import os from 'os';
import crypto from 'crypto';
import { runModelInference } from './inference.js';

export type AttestationMode = 'SOFTWARE_ONLY' | 'TEE_HARDWARE';

export interface AttestationPayload {
  mode: AttestationMode;
  // For software-only mode we use simple metadata:
  provider?: string;       // e.g. "AWS-EC2" or "Local-Dev"
  region?: string;         // e.g. "eu-west-2"
  instanceType?: string;   // e.g. "t3.micro" or "m5.xlarge"
  logging?: 'enabled' | 'disabled';
  training?: 'none' | 'fine-tune' | 'other';

  // For future TEE mode – keep them optional for now:
  measurement?: string;
  pcrs?: Record<string, string>;
  policyHash?: string;
  timestamp?: string;
}

export interface InferenceOptions {
  userId?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  // Extend as needed, but keep generic.
}

export interface PrivateInferenceResult {
  answer: string;
  jobHash: string;
  attestation: AttestationPayload;
  // Optional metadata for backward compatibility with existing API responses
  model?: string;
  usedStub?: boolean;
}

export interface PrivateInferenceEngine {
  infer(prompt: string, options?: InferenceOptions): Promise<PrivateInferenceResult>;
}

export class SoftwareInferenceEngine implements PrivateInferenceEngine {
  // If the existing inference needs dependencies, inject them via constructor later.
  constructor() {}

  private buildAttestation(): AttestationPayload {
    // Lightweight, software-only attestation metadata for now.
    return {
      mode: 'SOFTWARE_ONLY',
      provider: process.env.AWS_EXECUTION_ENV ? 'AWS-EC2' : 'Local-Dev',
      region: process.env.AWS_REGION,
      instanceType: process.env.EC2_INSTANCE_TYPE ?? os.hostname(),
      logging: 'disabled',
      training: 'none',
    };
  }

  private buildJobHash(prompt: string, answer: string, options: InferenceOptions): string {
    // Avoid new dependencies: use Node crypto.
    const payload = JSON.stringify({
      prompt,
      answer,
      userId: options.userId ?? null,
      model: options.model ?? null,
    });

    return '0x' + crypto.createHash('sha256').update(payload).digest('hex');
  }

  async infer(prompt: string, options: InferenceOptions = {}): Promise<PrivateInferenceResult> {
    // Call the existing inference logic
    const inferenceResult = await this.runExistingInference(prompt, options);

    const jobHash = this.buildJobHash(prompt, inferenceResult.output, options);
    const attestation = this.buildAttestation();

    return { 
      answer: inferenceResult.output, 
      jobHash, 
      attestation,
      model: inferenceResult.model,
      usedStub: inferenceResult.usedStub,
    };
  }

  private async runExistingInference(prompt: string, options: InferenceOptions) {
    // Call the current LLM inference implementation
    const result = await runModelInference(prompt, {
      model: options.model ?? 'llama-3-8b-instruct',
      maxTokens: options.maxTokens ?? 512,
      temperature: options.temperature ?? 0.7,
    });

    return result;
  }
}

