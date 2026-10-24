import api from './axios';

export const fetchNotifications = async () => {
  const res = await api.get('/notifications');
  return res.data;
};

export const markNotificationAsRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data.notification;
};

export const markAllNotificationsAsRead = async () => {
  const res = await api.patch('/notifications/read-all');
  return res.data;
};
