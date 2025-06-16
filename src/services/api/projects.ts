import { api } from './index';

export const getProjects = (params?: any) => {
  return api.get('/projects', { params });
};

export const getProject = (id: string) => {
  return api.get(`/projects/${id}`);
};

export const createProject = (data: any) => {
  return api.post('/projects', data);
};

export const updateProject = (id: string, data: any) => {
  return api.put(`/projects/${id}`, data);
};

export const deleteProject = (id: string) => {
  return api.delete(`/projects/${id}`);
};