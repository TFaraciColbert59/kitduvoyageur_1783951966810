import { describe, expect, it } from 'vitest';
import { auditEnvContract } from '@/lib/envContract';

describe('envContract (P00-06)', () => {
  it('validates required keys and redacts all secret values', () => {
    const report = auditEnvContract({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:38423',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'super-secret-anon-key-value',
      GEMINI_API_KEY: 'sk-never-leak-this',
    });

    expect(report.isValid).toBe(true);
    expect(report.environment).toBe('local');
    expect(report.targetHost).toBe('127.0.0.1');

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('super-secret-anon-key-value');
    expect(serialized).not.toContain('sk-never-leak-this');

    const ai = report.features.find((f) => f.feature === 'ai_assistant');
    expect(ai?.status).toBe('configured');

    const firms = report.features.find((f) => f.feature === 'wildfire_firms');
    expect(firms?.status).toBe('missing_optional');
  });

  it('rejects placeholder values and flags missing required variables', () => {
    const report = auditEnvContract({
      NEXT_PUBLIC_SUPABASE_URL: 'your-supabase-url',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    });

    expect(report.isValid).toBe(false);
    const core = report.features.find((f) => f.feature === 'supabase_core');
    expect(core?.status).toBe('missing_required');
  });
});
