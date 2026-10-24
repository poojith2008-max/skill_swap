import api from './axios';

export const fetchSkills = async (q = '') => {
  const res = await api.get(`/skills${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  return res.data.skills;
};
