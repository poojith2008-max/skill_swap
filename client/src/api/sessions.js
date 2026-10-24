import api from './axios';

export const proposeSession = async (payload) => {
  const res = await api.post('/sessions', payload);
  return res.data.session;
};

export const fetchSessions = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.role) query.append('role', params.role);
  const res = await api.get(`/sessions?${query.toString()}`);
  return res.data.sessions;
};

export const fetchSessionById = async (id) => {
  const res = await api.get(`/sessions/${id}`);
  return res.data.session;
};

export const acceptSession = async (id) => {
  const res = await api.patch(`/sessions/${id}/accept`);
  return res.data;
};

export const declineSession = async (id) => {
  const res = await api.patch(`/sessions/${id}/decline`);
  return res.data.session;
};

export const counterSession = async (id, { start, end }) => {
  const res = await api.patch(`/sessions/${id}/counter`, { start, end });
  return res.data;
};

export const cancelSession = async (id) => {
  const res = await api.patch(`/sessions/${id}/cancel`);
  return res.data.session;
};

export const completeSession = async (id) => {
  const res = await api.patch(`/sessions/${id}/complete`);
  return res.data.session;
};
