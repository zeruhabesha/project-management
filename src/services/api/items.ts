import { api } from './index';

export const getItems = (params?: any) => {
  return api.get('/items', { params });
};

export const createItem = (data: any) => {
  return api.post('/items', data);
};

export const updateItem = (id: string, data: any) => {
  return api.put(`/items/${id}`, data);
};

export const deleteItem = (id: string) => {
  return api.delete(`/items/${id}`);
};