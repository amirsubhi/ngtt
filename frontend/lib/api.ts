const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    credentials: 'include', // include refresh_token cookie
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'UNKNOWN', message: res.statusText }));
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Request failed');
  }

  return res.json();
}

export const api = {
  get:    <T>(path: string, token?: string | null) => request<T>('GET', path, undefined, token),
  post:   <T>(path: string, body: unknown, token?: string | null) => request<T>('POST', path, body, token),
  put:    <T>(path: string, body: unknown, token?: string | null) => request<T>('PUT', path, body, token),
  delete: <T>(path: string, token?: string | null) => request<T>('DELETE', path, undefined, token),
};
