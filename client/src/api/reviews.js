import api from './axios';

export const submitReview = async ({ sessionId, rating, comment }) => {
  const res = await api.post('/reviews', { sessionId, rating, comment });
  return res.data;
};
