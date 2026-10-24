import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notifications';
import { fetchConversations } from '../api/conversations';
import { fetchSessions } from '../api/sessions';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingSessionsCount, setPendingSessionsCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [token]);

  const loadUnreadMessages = useCallback(async () => {
    if (!token) return;
    try {
      const convs = await fetchConversations();
      const count = (convs || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0);
      setUnreadMessagesCount(count);
    } catch (err) {
      // silent
    }
  }, [token]);

  const loadPendingSessions = useCallback(async () => {
    if (!token || !user) return;
    try {
      const sess = await fetchSessions();
      const count = (sess || []).filter(
        (s) => s.status === 'proposed' && s.partner?._id?.toString() === user._id?.toString()
      ).length;
      setPendingSessionsCount(count);
    } catch (err) {
      // silent
    }
  }, [token, user]);

  useEffect(() => {
    loadNotifications();
    loadUnreadMessages();
    loadPendingSessions();
  }, [loadNotifications, loadUnreadMessages, loadPendingSessions]);

  useEffect(() => {
    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    // Real-time notification handler
    socketInstance.on('notification', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);
      toast.info(notif.message, notif.title);
      if (notif.type?.includes('session')) {
        loadPendingSessions();
      }
    });

    // Real-time chat notification outside active chat
    socketInstance.on('new_message_notification', (data) => {
      setUnreadMessagesCount((prev) => prev + 1);
      toast.info(`${data.sender.name}: ${data.text.slice(0, 45)}...`, 'New Message');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [token, user, loadPendingSessions]);

  const markRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications read:', err);
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        notifications,
        unreadCount,
        unreadMessagesCount,
        pendingSessionsCount,
        markRead,
        markAllRead,
        refreshNotifications: loadNotifications,
        refreshUnreadMessages: loadUnreadMessages,
        refreshPendingSessions: loadPendingSessions,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
