const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const AppError = require('../utils/AppError');
const {
  findOrCreateConversation,
  persistMessage,
  markMessagesRead,
} = require('../services/chatService');

const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({
      participants: userId,
    })
      .populate('participants', 'name email timezone reputation bio')
      .sort({ lastMessageAt: -1 });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId },
        });

        const convObj = conv.toJSON();
        convObj.unreadCount = unreadCount;
        return convObj;
      })
    );

    res.status(200).json({
      conversations: conversationsWithUnread,
      count: conversationsWithUnread.length,
    });
  } catch (error) {
    next(error);
  }
};

const createOrGetConversation = async (req, res, next) => {
  try {
    const { recipientId } = req.body;
    const conversation = await findOrCreateConversation(req.user._id, recipientId);

    res.status(200).json({
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { before, limit = 50 } = req.query;
    const maxLimit = Math.min(parseInt(limit, 10), 100);

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return next(new AppError('Conversation not found', 404, 'NOT_FOUND'));
    }

    const isParticipant = conversation.participants.some(
      p => p.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return next(new AppError('You are not authorized to view this conversation', 403, 'FORBIDDEN'));
    }

    const query = { conversation: conversationId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    // Fetch messages sorted newest first, then reverse to chronological order for client display
    const rawMessages = await Message.find(query)
      .populate('sender', 'name reputation')
      .sort({ createdAt: -1 })
      .limit(maxLimit);

    const messages = rawMessages.reverse();

    // Mark messages as read by current user
    await markMessagesRead(conversationId, req.user._id);

    res.status(200).json({
      messages,
      count: messages.length,
      hasMore: rawMessages.length === maxLimit,
    });
  } catch (error) {
    next(error);
  }
};

const sendMessageREST = async (req, res, next) => {
  try {
    const { id: conversationId } = req.params;
    const { text } = req.body;

    const { message } = await persistMessage(conversationId, req.user._id, text);

    res.status(201).json({
      message,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessageREST,
};
