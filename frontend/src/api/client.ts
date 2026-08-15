import type { RiskSummary, TreeDetail, TreeSummary } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("fht_token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("fht_token", token);
  else localStorage.removeItem("fht_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return body as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string };
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ user: AuthResponse["user"] }>("/auth/me"),

  listTrees: () => request<{ trees: TreeSummary[] }>("/trees"),
  createTree: (data: {
    treeName: string;
    corePersonFirstName: string;
    corePersonLastName?: string;
    corePersonSex?: string;
  }) => request<TreeDetail>("/trees", { method: "POST", body: JSON.stringify(data) }),
  joinTree: (inviteCode: string) =>
    request<{ treeId: string; alreadyMember: boolean }>("/trees/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    }),
  getTree: (treeId: string, perspective?: string) =>
    request<TreeDetail>(`/trees/${treeId}${perspective ? `?perspective=${perspective}` : ""}`),
  updateTree: (treeId: string, data: { name?: string; corePersonId?: string }) =>
    request<TreeDetail>(`/trees/${treeId}`, { method: "PATCH", body: JSON.stringify(data) }),
  getRiskSummary: (treeId: string, perspective?: string) =>
    request<RiskSummary>(`/trees/${treeId}/risk-summary${perspective ? `?perspective=${perspective}` : ""}`),

  createPerson: (treeId: string, data: Record<string, unknown>) =>
    request<TreeDetail>(`/trees/${treeId}/people`, { method: "POST", body: JSON.stringify(data) }),
  updatePerson: (treeId: string, personId: string, data: Record<string, unknown>) =>
    request<TreeDetail>(`/trees/${treeId}/people/${personId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePerson: (treeId: string, personId: string) =>
    request<TreeDetail>(`/trees/${treeId}/people/${personId}`, { method: "DELETE" }),

  addRelationship: (treeId: string, parentId: string, childId: string) =>
    request<TreeDetail>(`/trees/${treeId}/relationships`, {
      method: "POST",
      body: JSON.stringify({ parentId, childId }),
    }),
  removeRelationship: (treeId: string, relationshipId: string) =>
    request<TreeDetail>(`/trees/${treeId}/relationships/${relationshipId}`, { method: "DELETE" }),

  addPartnership: (treeId: string, personAId: string, personBId: string, status?: string) =>
    request<TreeDetail>(`/trees/${treeId}/partnerships`, {
      method: "POST",
      body: JSON.stringify({ personAId, personBId, status }),
    }),
  removePartnership: (treeId: string, partnershipId: string) =>
    request<TreeDetail>(`/trees/${treeId}/partnerships/${partnershipId}`, { method: "DELETE" }),

  addCondition: (treeId: string, personId: string, data: Record<string, unknown>) =>
    request<TreeDetail>(`/trees/${treeId}/people/${personId}/conditions`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCondition: (treeId: string, conditionId: string, data: Record<string, unknown>) =>
    request<TreeDetail>(`/trees/${treeId}/conditions/${conditionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCondition: (treeId: string, conditionId: string) =>
    request<TreeDetail>(`/trees/${treeId}/conditions/${conditionId}`, { method: "DELETE" }),
};
