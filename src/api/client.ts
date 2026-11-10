import { mockApiClient } from '@/api/mock/mock-client';
import type { ApiClient } from '@/api/types';

export const USE_MOCK_DATA = true;

export const api: ApiClient = mockApiClient;

if (USE_MOCK_DATA) {
  console.info('[api] running on clearly-labelled MOCK sample data — not production. See IMPLEMENTATION_PLAN.md and docs/api-contracts.md.');
}
