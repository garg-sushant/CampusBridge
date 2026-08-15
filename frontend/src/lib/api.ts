export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
  }
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  return rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
}

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('token') || localStorage.getItem('token');
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

  // Setup abort controller with a generous 30s timeout for Cloud DBs (Neon/Supabase) & AI LLM pipelines
  const isUpload = path.includes('/upload') || options.body instanceof FormData;
  const isLongTask = path.includes('/submit') || path.includes('/assessment') || path.includes('/provide-info');
  const timeoutMs = isLongTask ? 45000 : 30000; // 30s standard, 45s for AI/submit endpoints

  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | undefined;

  if (!isUpload && !options.signal) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    options.signal = controller.signal;
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  try {
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
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Connection timeout while connecting to server. Please try again.');
    }
    throw err;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }

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

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/login`, {
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

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/complaints/${complaintId}/upload`, {
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
  },

  // Additional Information & Evidence submission handler (for 30-60 score pending_info)
  provideInfo: async <T = unknown>(complaintId: string, formData: FormData): Promise<T> => {
    const token = getAuthToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/complaints/${complaintId}/provide-info`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let errorDetail = 'Failed to submit additional information.';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    return response.json() as Promise<T>;
  },

  // Google Login payload handler
  googleLogin: async (email: string, role?: string, departmentId?: number, idToken?: string): Promise<{ access_token: string; token_type: string }> => {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/auth/google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        role: role || 'student',
        department_id: departmentId || null,
        id_token: idToken || null,
      }),
    });

    if (!response.ok) {
      let errorDetail = 'Google Login failed';
      try {
        const errJson = await response.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {}
      throw new Error(errorDetail);
    }

    return response.json() as Promise<{ access_token: string; token_type: string }>;
  }
};

/**
 * Returns the fully qualified URL for backend media files (uploads/static).
 */
export function getBackendMediaUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // If in browser and running on localhost, always point to local backend
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return `http://localhost:8000${cleanPath}`;
  }

  const apiBase = getApiBaseUrl();
  const host = apiBase.replace(/\/api\/?$/, '');
  return `${host}${cleanPath}`;
}



