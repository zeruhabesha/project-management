import { api } from './index';

export const getDashboardStats = () => {
  return api.get('/reports/dashboard');
};

export const getProjectProgress = (projectId: string) => {
  return api.get(`/reports/projects/${projectId}/progress`);
};

export const getProjectCost = (projectId: string) => {
  return api.get(`/reports/projects/${projectId}/cost`);
};