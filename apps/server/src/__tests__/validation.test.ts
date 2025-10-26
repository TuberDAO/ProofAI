import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import { validateJobInput, formatValidationError } from '../validation';

describe('Validation Module', () => {
  describe('validateJobInput', () => {
    describe('valid inputs', () => {
      it('accepts valid prompt and amount', () => {
        const input = {
          prompt: 'What is machine learning?',
          amountEth: '0.0001',
        };

        const result = validateJobInput(input);

        expect(result.prompt).toBe('What is machine learning?');
        expect(result.amountEth).toBe('0.0001');
      });

      it('trims whitespace from prompt', () => {
        const input = {
          prompt: '  Hello world  ',
          amountEth: '0.0001',
        };

        const result = validateJobInput(input);

        expect(result.prompt).toBe('Hello world');
      });

      it('accepts amounts within bounds', () => {
        const validAmounts = ['0.00001', '0.0001', '0.001', '0.01'];

        validAmounts.forEach((amount) => {
          const input = {
            prompt: 'Test',
            amountEth: amount,
          };

          expect(() => validateJobInput(input)).not.toThrow();
        });
      });

      it('accepts maximum length prompt', () => {
        const input = {
          prompt: 'A'.repeat(8000),
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).not.toThrow();
      });

      it('accepts UTF-8 characters', () => {
        const input = {
          prompt: 'こんにちは 世界 🌍 Привет',
          amountEth: '0.0001',
        };

        const result = validateJobInput(input);

        expect(result.prompt).toContain('こんにちは');
      });

      it('accepts multiline prompts', () => {
        const input = {
          prompt: 'Line 1\nLine 2\nLine 3',
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).not.toThrow();
      });
    });

    describe('invalid prompts', () => {
      it('rejects empty prompt', () => {
        const input = {
          prompt: '',
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Prompt cannot be empty');
      });

      it('rejects whitespace-only prompt', () => {
        const input = {
          prompt: '   ',
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Prompt cannot be empty');
      });

      it('rejects too long prompt', () => {
        const input = {
          prompt: 'A'.repeat(8001),
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Prompt too long (maximum 8,000 characters)'
        );
      });

      it('rejects prompt with control characters', () => {
        const input = {
          prompt: 'Test\x00\x01\x02',
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Prompt contains invalid characters'
        );
      });

      it('rejects missing prompt', () => {
        const input = {
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Prompt is required');
      });

      it('rejects non-string prompt', () => {
        const input = {
          prompt: 12345,
          amountEth: '0.0001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Prompt must be a string');
      });
    });

    describe('invalid amounts', () => {
      it('rejects missing amount', () => {
        const input = {
          prompt: 'Test',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Amount is required');
      });

      it('rejects non-numeric amount', () => {
        const input = {
          prompt: 'Test',
          amountEth: 'not a number',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Amount must be a positive number'
        );
      });

      it('rejects zero amount', () => {
        const input = {
          prompt: 'Test',
          amountEth: '0',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Amount must be a positive number'
        );
      });

      it('rejects negative amount', () => {
        const input = {
          prompt: 'Test',
          amountEth: '-0.001',
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Amount must be a positive number'
        );
      });

      it('rejects amount below minimum', () => {
        const input = {
          prompt: 'Test',
          amountEth: '0.000001', // Less than 0.00001
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Amount too low (minimum 0.00001 ETH)'
        );
      });

      it('rejects amount above maximum', () => {
        const input = {
          prompt: 'Test',
          amountEth: '0.1', // More than 0.01
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow(
          'Amount too high (maximum 0.01 ETH)'
        );
      });

      it('rejects non-string amount', () => {
        const input = {
          prompt: 'Test',
          amountEth: 0.0001,
        };

        expect(() => validateJobInput(input)).toThrow(ZodError);
        expect(() => validateJobInput(input)).toThrow('Amount must be a string');
      });
    });
  });

  describe('formatValidationError', () => {
    it('extracts first error message', () => {
      try {
        validateJobInput({ prompt: '', amountEth: '0.0001' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatValidationError(error);
          expect(message).toBe('Prompt cannot be empty');
        }
      }
    });

    it('handles multiple errors', () => {
      try {
        validateJobInput({ prompt: '', amountEth: 'invalid' });
      } catch (error) {
        if (error instanceof ZodError) {
          const message = formatValidationError(error);
          // Should return the first error
          expect(message).toBeTruthy();
          expect(typeof message).toBe('string');
        }
      }
    });
  });
});

