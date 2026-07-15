import axios from 'axios';

const BASE_URL = '';

const api = axios.create({
  baseURL: BASE_URL,
});

export const alumnosApi = {
  list: () => api.get('/api/alumnos').then(r => r.data),
  save: (data: any) => api.post('/api/alumnos', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/alumnos/${id}`).then(r => r.data),
};

export const notasApi = {
  list: () => api.get('/api/notas').then(r => r.data),
  save: (data: any) => api.post('/api/notas', data).then(r => r.data),
  update: (id: string, data: any) => api.patch(`/api/notas/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/notas/${id}`).then(r => r.data),
  deleteAll: () => api.delete('/api/notas-all').then(r => r.data),
  getHistorical: () => api.get('/api/historico-notas').then(r => r.data),
};

export const configApi = {
  get: () => api.get('/api/config').then(r => r.data),
  update: (data: any) => api.patch('/api/config', data).then(r => r.data),
  regenerateApiKey: () => api.post('/api/config/regenerate-key').then(r => r.data),
  getDevices: () => api.get('/api/config/devices').then(r => r.data),
  deleteDevice: (id: string) => api.delete(`/api/config/devices/${id}`).then(r => r.data),
};

export const usersApi = {
  list: () => api.get('/api/users').then(r => r.data),
  getById: (id: string) => api.get(`/api/users/${id}`).then(r => r.data),
  create: (data: any) => api.post('/api/users/add-new', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/users/${id}`).then(r => r.data),
  resetPassword: (id: string, password: string) => api.post(`/api/users/password/${id}`, { password }).then(r => r.data),
  setRole: (userId: string, role: string) => api.post('/api/users/role', { userId, role }).then(r => r.data),
  login: (data: any) => api.post('/api/login', data).then(r => r.data),
};

export const auditApi = {
  list: () => api.get('/api/audit').then(r => r.data),
  save: (data: any) => api.post('/api/audit', data).then(r => r.data),
};

export const botApi = {
  get: () => api.get('/api/bot').then(r => r.data),
  update: (data: any) => api.patch('/api/bot', data).then(r => r.data),
  test: () => api.post('/api/telegram/publish', { is_test: true }).then(r => r.data),
  publish: (notaId: string) => api.post('/api/telegram/publish', { nota_id: notaId }).then(r => r.data),
  publishStudent: (alumnoId: string) => api.post('/api/telegram/publish', { alumno_id: alumnoId }).then(r => r.data),
  broadcast: (data: any) => api.post('/api/telegram/broadcast', data).then(r => r.data),
};

export const delegationsApi = {
  list: () => api.get('/api/delegations').then(r => r.data),
  save: (data: any) => api.post('/api/delegations', data).then(r => r.data),
};

export const sugerenciasApi = {
  list: () => api.get('/api/sugerencias').then(r => r.data),
  delete: (id: string) => api.delete(`/api/sugerencias/${id}`).then(r => r.data),
  reply: (data: { chat_id: string, respuesta: string }) => api.post('/api/telegram/reply-sugerencia', data).then(r => r.data),
};

export const plantillasApi = {
  list: () => api.get('/api/plantillas').then(r => r.data),
  save: (data: { titulo: string, mensaje: string }) => api.post('/api/plantillas', data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/plantillas/${id}`).then(r => r.data),
};

export const publicApi = {
  consulta: (nombre: string, ci: string) => api.get('/api/consulta', { params: { nombre, ci } }).then(r => r.data),
  getBotInfo: () => api.get('/api/bot-info').then(r => r.data),
};

export default api;
