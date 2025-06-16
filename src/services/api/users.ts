import { api } from './index';

export const getUsers = () => {
  return api.get('/users');
};

export const createUser = (data: any) => {
  return api.post('/users', data);
};

export const updateUser = (id: string, data: any) => {
  return api.put(`/users/${id}`, data);
};

export const deleteUser = (id: string) => {
  return api.delete(`/users/${id}`);
};