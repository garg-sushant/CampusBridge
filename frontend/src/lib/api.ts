const BASE_URL = 'http://localhost:8000/api';

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('token');
  }
  return null;
}

interface RequestOptions extends RequestInit {
  json?: unknown;
}

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  // Inject authentication header if available
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set json content headers
  if (options.json && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.json);
  }

  options.headers = headers;

  // Set cache: 'no-store' to bypass Next.js client caching for real-time updates
  if (options.method === 'GET') {
    options.cache = 'no-store';
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  // Handle empty bodies (e.g. 204 status)
  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path, { method: 'GET' }),
  
  post: <T = unknown>(path: string, body: unknown) => request<T>(path, { method: 'POST', json: body }),
  
  patch: <T = unknown>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', json: body }),
  
  // Custom login handler that sends URL-encoded form data (required by FastAPI OAuth2)
  login: async (email: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      let errorDetail = 'Login failed';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    return response.json() as Promise<{ access_token: string; token_type: string }>;
  },

  // Multipart upload handler
  upload: async <T = unknown>(complaintId: string, files: File[]): Promise<T> => {
    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${BASE_URL}/complaints/${complaintId}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = 'Upload failed';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    return response.json() as Promise<T>;
  }
};
