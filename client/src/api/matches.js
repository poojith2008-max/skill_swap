import api from './axios';

export const fetchMatches = async (limit = 20) => {
  const res = await api.get(`/matches?limit=${limit}`);
  return res.data.matches;
};
