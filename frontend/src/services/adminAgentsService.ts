/**
 * Admin API для агентов (рефералов).
 */

import { apiGet, apiPut, isMockMode } from './apiClient';

export type AgentStatus = 'active' | 'inactive' | 'suspended';

export type AdminAgent = {
  id: string;
  userId: string;
  agentCode: string;
  status: AgentStatus;
  totalReferrals: number;
  totalActiveReferrals: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    telegramId?: number;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

const BASE = '/api/admin/agents';

const MOCK_AGENTS: AdminAgent[] = [
  {
    id: 'a1',
    userId: 'u1',
    agentCode: 'REF001',
    status: 'active',
    totalReferrals: 12,
    totalActiveReferrals: 8,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    user: { id: 'u1', username: 'agent1', firstName: 'Иван', lastName: 'Агентов' },
  },
  {
    id: 'a2',
    userId: 'u2',
    agentCode: 'REF002',
    status: 'inactive',
    totalReferrals: 5,
    totalActiveReferrals: 2,
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-20T00:00:00Z',
    user: { id: 'u2', username: 'agent2', firstName: 'Мария', lastName: null },
  },
  {
    id: 'a3',
    userId: 'u3',
    agentCode: 'REF003',
    status: 'active',
    totalReferrals: 28,
    totalActiveReferrals: 19,
    createdAt: '2025-12-05T00:00:00Z',
    updatedAt: '2026-01-22T00:00:00Z',
    user: { id: 'u3', username: 'partner_spb', firstName: 'Дмитрий', lastName: 'Козлов' },
  },
  {
    id: 'a4',
    userId: 'u4',
    agentCode: 'REF004',
    status: 'suspended',
    totalReferrals: 3,
    totalActiveReferrals: 0,
    createdAt: '2026-01-12T00:00:00Z',
    updatedAt: '2026-01-18T00:00:00Z',
    user: { id: 'u4', username: 'ex_agent', firstName: 'Олег', lastName: 'Сидоров' },
  },
  {
    id: 'a5',
    userId: 'u5',
    agentCode: 'REF005',
    status: 'active',
    totalReferrals: 7,
    totalActiveReferrals: 5,
    createdAt: '2026-01-20T00:00:00Z',
    updatedAt: '2026-01-25T00:00:00Z',
    user: { id: 'u5', username: null, firstName: 'Анна', lastName: 'Волкова' },
  },
];

/** Моки для UI, когда API недоступен или пустой (как в adminBookingService) */
export function getMockAgents(status?: AgentStatus): AdminAgent[] {
  return status ? MOCK_AGENTS.filter((a) => a.status === status) : [...MOCK_AGENTS];
}

export async function getAdminAgents(status?: AgentStatus): Promise<AdminAgent[]> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    return getMockAgents(status);
  }
  try {
    const q = status ? `?status=${status}` : '';
    const list = await apiGet<AdminAgent[]>(`${BASE}${q}`);
    const arr = Array.isArray(list) ? list : [];
    return arr.length > 0 ? arr : getMockAgents(status);
  } catch {
    return getMockAgents(status);
  }
}

export async function updateAdminAgentStatus(
  id: string,
  status: AgentStatus
): Promise<AdminAgent> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    const idx = MOCK_AGENTS.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Agent not found');
    const updated = { ...MOCK_AGENTS[idx], status, updatedAt: new Date().toISOString() };
    MOCK_AGENTS[idx] = updated;
    return updated;
  }
  const res = await apiPut<{ success: boolean; data: AdminAgent }>(`${BASE}/${id}/status`, {
    status,
  });
  return res.data;
}
