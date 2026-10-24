import api from './axios';

export const fetchConversations = async () => {
  const res = await api.get('/conversations');
  return res.data.conversations;
};

export const startConversation = async (recipientId) => {
  const res = await api.post('/conversations', { recipientId });
  return res.data.conversation;
};

export const fetchMessages = async (conversationId, before) => {
  const url = `/conversations/${conversationId}/messages${before ? `?before=${before}` : ''}`;
  const res = await api.get(url);
  return res.data;
};

export const sendMessageREST = async (conversationId, text) => {
  const res = await api.post(`/conversations/${conversationId}/messages`, { text });
  return res.data.message;
};
