import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// DCA Demo Plan Types and API
export interface DCADemoPlan {
  id?: string;
  userId: string;
  username?: string;
  symbol: string;
  amountUSD: number;
  side: 'BUY' | 'SELL';
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  targetHour?: number;
  targetWeekday?: number;
  targetDate?: number;
  scheduleTime?: string;
  timezone?: string;
  active?: boolean;
  nextRun?: string;
  createdAt?: string;
  totalInvested?: number;
  currentValue?: number;
  totalCoins?: number;
}

export const createDCADemoPlan = (plan: DCADemoPlan) => {
  return api.post<DCADemoPlan>('/dca/demo/plan', plan);
};

export const getDCADemoPlansByUser = (userId: string) => {
  return api.get<DCADemoPlan[]>(`/dca/demo/plans/${userId}`);
};

export const getDCADemoPlan = (id: string) => {
  return api.get<DCADemoPlan>(`/dca/demo/plan/${id}`);
};

export const updateDCADemoPlan = (id: string, plan: DCADemoPlan) => {
  return api.put<DCADemoPlan>(`/dca/demo/plan/${id}`, plan);
};

export const toggleDCADemoPlan = (id: string) => {
  return api.post<DCADemoPlan>(`/dca/demo/plan/${id}/toggle`);
};

export const deleteDCADemoPlan = (id: string) => {
  return api.delete(`/dca/demo/plan/${id}`);
};

export default api;

