import { apiGet, apiPost, apiPut, apiDelete, apiRequest } from './apiClient';

const MAX_PARTNERS = 9;

export type AdminPartner = {
  id: string;
  name: string;
  logoUrl: string;
  website?: string;
  order: number;
};

type ApiPartner = {
  id: string;
  name: string;
  logoUrl: string | null;
  link: string | null;
  order: number;
};

function fromApi(p: ApiPartner): AdminPartner {
  return {
    id: p.id,
    name: p.name,
    logoUrl: p.logoUrl ?? '',
    website: p.link ?? undefined,
    order: p.order ?? 0,
  };
}

export async function getAdminPartners(): Promise<AdminPartner[]> {
  const data = await apiGet<ApiPartner[]>('/api/admin/partners');
  const list = Array.isArray(data) ? data : [];
  return list.map(fromApi).sort((a, b) => a.order - b.order);
}

export async function createAdminPartner(input: {
  name: string;
  logoUrl: string;
  website?: string;
  order: number;
}): Promise<AdminPartner> {
  const data = await apiPost<ApiPartner>('/api/admin/partners', {
    name: input.name,
    logoUrl: input.logoUrl,
    link: input.website || undefined,
    order: input.order,
  });
  return fromApi(data);
}

export async function updateAdminPartner(
  id: string,
  input: { name?: string; logoUrl?: string; website?: string; order?: number }
): Promise<AdminPartner> {
  const data = await apiPut<ApiPartner>(`/api/admin/partners/${id}`, {
    name: input.name,
    logoUrl: input.logoUrl,
    link: input.website,
    order: input.order,
  });
  return fromApi(data);
}

export async function deleteAdminPartner(id: string): Promise<void> {
  await apiDelete(`/api/admin/partners/${id}`);
}

export async function reorderAdminPartners(ids: string[]): Promise<void> {
  await apiRequest<{ success: boolean }>('/api/admin/partners/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

export { MAX_PARTNERS };
