const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { persistMessage, markMessagesRead } = require('../services/chatService');
const { setSocketIO, createNotification } = require('../services/notificationService');

const initSocket = (httpServer, allowedOrigins) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Share io instance with notification service
  setSocketIO(io);

  // JWT-authenticated handshake middleware
  io.use(async (socket, next) => {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!authHeader) {
        return next(new Error('Authentication error: Missing token'));
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('name email timezone');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const userRoom = `user:${userId}`;

    // Join per-user personal room for in-app notifications and background alerts
    socket.join(userRoom);

    // Event: join_conversation
    socket.on('join_conversation', async ({ conversationId }, callback) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          if (callback) callback({ error: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participants.some(
          p => p.toString() === userId
        );

        if (!isParticipant) {
          if (callback) callback({ error: 'Not authorized to join this conversation' });
          return;
        }

        const room = `conversation:${conversationId}`;
        socket.join(room);

        // Mark messages as read upon entering
        await markMessagesRead(conversationId, socket.user._id);
        socket.to(room).emit('message_read', { conversationId, userId });

        if (callback) callback({ success: true, conversationId });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Event: send_message
    socket.on('send_message', async ({ conversationId, text }, callback) => {
      try {
        // Persist message to database first!
        const { conversation, message } = await persistMessage(conversationId, socket.user._id, text);

        const room = `conversation:${conversationId}`;

        // Emit new_message to all clients in conversation room
        io.to(room).emit('new_message', {
          conversationId,
          message,
        });

        // Also notify the other participant in their personal user room
        const otherParticipantId = conversation.participants.find(
          p => p.toString() !== userId
        );

        if (otherParticipantId) {
          io.to(`user:${otherParticipantId.toString()}`).emit('new_message_notification', {
            conversationId,
            sender: {
              _id: socket.user._id,
              name: socket.user.name,
            },
            text: message.text,
            createdAt: message.createdAt,
          });
        }

        if (callback) callback({ success: true, message });
      } catch (err) {
        if (callback) callback({ error: err.message });
      }
    });

    // Event: typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(`conversation:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        userName: socket.user.name,
        isTyping: !!isTyping,
      });
    });

    // Event: mark_read
    socket.on('mark_read', async ({ conversationId }) => {
      try {
        await markMessagesRead(conversationId, socket.user._id);
        socket.to(`conversation:${conversationId}`).emit('message_read', {
          conversationId,
          userId,
        });
      } catch (err) {
        console.error('Error in mark_read socket event:', err);
      }
    });

    socket.on('disconnect', () => {
      // Disconnect handled cleanly
    });
  });

  return io;
};

module.exports = {
  initSocket,
};
