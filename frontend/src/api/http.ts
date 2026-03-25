import { z } from 'zod';

const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
const DEFAULT_BASE_URL = 'http://localhost:3001';

export const apiBaseUrl = envBaseUrl && envBaseUrl.length > 0 ? envBaseUrl : DEFAULT_BASE_URL;

const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

export class ApiError extends Error {
  public code: string;
  public details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit & { parseJson?: (json: unknown) => T }) {
  const url = `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const text = await res.text();
  const json = text.length > 0 ? safeJsonParse(text) : null;

  if (!res.ok) {
    const parsed = json ? errorSchema.safeParse(json) : null;
    const message = parsed?.success ? parsed.data.message : `HTTP ${res.status}`;
    const code = parsed?.success ? parsed.data.code : 'HTTP_ERROR';
    throw new ApiError(message, code, parsed?.success ? parsed.data.details : undefined);
  }

  if (!init?.parseJson) {
    return json as T;
  }
  return init.parseJson(json);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

