import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let authRedirecting = false;

api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const message = (error.response?.data as any)?.error?.message || error.message;
    console.error('API error:', message);
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (status === 401 && !url.includes('/auth/login') && !authRedirecting) {
      authRedirecting = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const inMemoryCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000;

function cachedGet<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = inMemoryCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    fetcher().then(data => inMemoryCache.set(key, { data, ts: Date.now() })).catch(() => {});
    return Promise.resolve(hit.data);
  }
  return fetcher().then(data => {
    inMemoryCache.set(key, { data, ts: Date.now() });
    return data;
  });
}

export function invalidateCache(pattern?: string) {
  if (pattern) {
    for (const key of inMemoryCache.keys()) {
      if (key.startsWith(pattern)) inMemoryCache.delete(key);
    }
  } else {
    inMemoryCache.clear();
  }
}

export function notifyOrdersUpdated() {
  invalidateCache('getOrders');
  invalidateCache('getOrderById');
  invalidateCache('getDetail');
  window.dispatchEvent(new Event('orders-updated'));
}

function buildParams(filters: Record<string, any>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  return params.toString();
}

export const analyticsApi = {
  getOverview: () => api.get('/v1/analytics/overview'),
  getSlaBreach: () => api.get('/v1/analytics/sla-breach'),
  getCallOutcomes: () => api.get('/v1/analytics/call-outcomes'),
  getAgentPerformance: () => api.get('/v1/analytics/agent-performance'),
  getOrderLifecycle: () => api.get('/v1/analytics/order-lifecycle'),
};

export const taskApi = {
  create: (data: any) => api.post('/v1/tasks', data),
  list: (filters: Record<string, any> = {}) => {
    return api.get(`/v1/tasks?${buildParams(filters)}`);
  },
  getById: (id: string) => api.get(`/v1/tasks/${id}`),
  getNext: () => api.get('/v1/tasks/next'),
  getNextAdvanced: (limit?: number) => api.get(`/v1/tasks/next-advanced${limit ? `?limit=${limit}` : ''}`),
  assign: (id: string, data: any) => api.put(`/v1/tasks/${id}/assign`, data),
  complete: (id: string, data: any) => api.put(`/v1/tasks/${id}/complete`, data),
  skip: (id: string, data: any) => api.put(`/v1/tasks/${id}/skip`, data),
  update: (id: string, data: any) => api.put(`/v1/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/v1/tasks/${id}`),
  schedule: (id: string, scheduledDate: string) => api.put(`/v1/tasks/${id}/schedule`, { scheduledDate }),
  getByOrder: (orderId: string, status?: string) => {
    const params = status ? `?status=${status}` : '';
    return api.get(`/v1/tasks/by-order/${orderId}${params}`);
  },
};

export const ruleApi = {
  list: () => api.get('/v1/rules'),
  create: (data: any) => api.post('/v1/rules', data),
  update: (id: string, data: any) => api.put(`/v1/rules/${id}`, data),
  delete: (id: string) => api.delete(`/v1/rules/${id}`),
  toggle: (id: string) => api.patch(`/v1/rules/${id}/toggle`),
  evaluate: (data: any) => api.post('/v1/rules/evaluate', data),
};

export const recoveryApi = {
  list: () => api.get('/v1/recovery'),
  create: (data: any) => api.post('/v1/recovery', data),
  update: (id: string, data: any) => api.put(`/v1/recovery/${id}`, data),
  getStats: () => api.get('/v1/recovery/stats'),
};

export const dashboardApi = {
  getToday: () => api.get('/v1/dashboard/today'),
  getStats: () => api.get('/v1/dashboard/stats'),
  getOrders: () => api.get('/v1/dashboard/orders'),
};

export const commerceApi = {
  login: () => api.post('/v1/commerce/login'),
  syncOrders: (options: Record<string, any> = {}) => {
    invalidateCache('getOrders');
    return api.post(`/v1/commerce/sync?${buildParams(options)}`);
  },
  syncAll: () => {
    invalidateCache('getOrders');
    return api.post('/v1/commerce/sync/all');
  },
  resetCursor: () => api.post('/v1/commerce/sync/reset-cursor'),
  getSyncStatus: () => api.get('/v1/commerce/sync/status'),
  getOrders: (filters: Record<string, any> = {}) => {
    const key = `getOrders:${JSON.stringify(filters)}`;
    return cachedGet(key, () => {
      return api.get(`/v1/commerce/orders?${buildParams(filters)}`);
    });
  },
  getSegmentCounts: () => api.get('/v1/commerce/orders/segment-counts'),
  getReviews: (filters: Record<string, any> = {}) => api.get(`/v1/commerce/reviews?${buildParams(filters)}`),
  getOrderById: (id: string) => {
    const key = `getOrderById:${id}`;
    return cachedGet(key, () => api.get(`/v1/commerce/orders/${id}`));
  },
  getOrderStatus: (id: string) => api.get(`/v1/commerce/orders/${id}/status`),
  getDetail: (id: string) => {
    const key = `getDetail:${id}`;
    return cachedGet(key, () => api.get(`/v1/commerce/orders/${id}/detail`));
  },
  updatePhone: (id: string, phone: string, type: string) => {
    invalidateCache('getOrders');
    invalidateCache('getDetail');
    return api.put(`/v1/commerce/orders/${id}/phone`, { phone, type });
  },
  updateStatus: (id: string, data: Record<string, any>) => {
    invalidateCache('getOrders');
    invalidateCache('getDetail');
    return api.put(`/v1/commerce/orders/${id}/status`, data);
  },
  getExternalComments: (id: string) => api.get(`/v1/commerce/orders/${id}/comments`),
  postExternalComment: (id: string, comments: string) => {
    invalidateCache('getDetail');
    return api.post(`/v1/commerce/orders/${id}/comment`, { comments });
  },
  getReturns: (filters: Record<string, any> = {}) => api.get(`/v1/commerce/returns?${buildParams(filters)}`),
  updateReturnStatus: (returnId: string, data: Record<string, any>) => api.put(`/v1/commerce/returns/${returnId}/status`, data),
  syncReturns: () => api.post('/v1/commerce/sync/returns'),
};

export const noteApi = {
  addNote: (taskId: string, note: string) => api.post(`/v1/tasks/${taskId}/notes`, { note }),
  addOrderNote: (orderId: string, note: string) => api.post(`/v1/commerce/orders/${orderId}/notes`, { note }),
};

export const authApi = {
  login: (email: string, password: string) => api.post('/v1/auth/login', { email, password }),
};

export const settingsApi = {
  get: () => api.get('/v1/settings'),
  update: (data: Record<string, any>) => api.put('/v1/settings', data),
};

export const adminApi = {
  listUsers: () => api.get('/v1/admin/users'),
  createUser: (data: Record<string, any>) => api.post('/v1/admin/users', data),
  updateUser: (id: string, data: Record<string, any>) => api.patch(`/v1/admin/users/${id}`, data),
  resetPassword: (id: string, password: string) => api.post(`/v1/admin/users/${id}/reset-password`, { password }),
  listBranches: () => api.get('/v1/admin/branches'),
};

export const attendanceApi = {
  getStatus: () => api.get('/v1/attendance/status'),
  checkIn: (notes?: string) => api.post('/v1/attendance/check-in', { notes }),
  checkOut: (notes?: string) => api.post('/v1/attendance/check-out', { notes }),
};

export default api;
