import { z } from 'zod';
import { env } from './config/env.js';

/**
 * Validation schema for job submission
 */
export const jobSubmitSchema = z.object({
  prompt: z
    .string({
      required_error: 'Prompt is required',
      invalid_type_error: 'Prompt must be a string',
    })
    .min(1, 'Prompt cannot be empty')
    .max(8000, 'Prompt too long (maximum 8,000 characters)')
    .trim()
    .refine(
      (val) => {
        // Check for binary/control characters (except newlines/tabs)
        return !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(val);
      },
      {
        message: 'Prompt contains invalid characters',
      }
    ),
  amountEth: z
    .string({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a string',
    })
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      {
        message: 'Amount must be a positive number',
      }
    )
    .refine(
      (val) => {
        const num = parseFloat(val);
        const minEth = parseFloat(env.minJobEth);
        return num >= minEth;
      },
      {
        message: `Amount too low (minimum ${env.minJobEth} ETH)`,
      }
    )
    .refine(
      (val) => {
        const num = parseFloat(val);
        const maxEth = parseFloat(env.maxJobEth);
        return num <= maxEth;
      },
      {
        message: `Amount too high (maximum ${env.maxJobEth} ETH)`,
      }
    ),
});

export type JobSubmitInput = z.infer<typeof jobSubmitSchema>;

/**
 * Validate job submission input
 * Returns parsed data or throws ZodError
 */
export function validateJobInput(input: unknown): JobSubmitInput {
  return jobSubmitSchema.parse(input);
}

/**
 * Format Zod validation errors for API response
 */
export function formatValidationError(error: z.ZodError): string {
  const firstError = error.errors[0];
  return firstError?.message || 'Validation failed';
}

