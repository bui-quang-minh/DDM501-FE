const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...headers, ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
