import api from './axios';

export const fetchUserProfile = async (id) => {
  const res = await api.get(`/users/${id}`);
  return res.data.user;
};

export const updateProfile = async (data) => {
  const res = await api.put('/users/me', data);
  return res.data.user;
};

export const updateAvailability = async (availability) => {
  const res = await api.put('/users/me/availability', { availability });
  return res.data;
};

export const fetchUserReviews = async (id) => {
  const res = await api.get(`/users/${id}/reviews`);
  return res.data;
};
