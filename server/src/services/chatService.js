const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Session = require('../models/Session');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { calculateMatchScore } = require('./matching');

/**
 * Checks whether userA is authorized to start a conversation with userB.
 * Allowed only if they have a session together (any status) OR if they have skill match overlap.
 */
const canInitiateConversation = async (userIdA, userIdB) => {
  if (userIdA.toString() === userIdB.toString()) {
    return false;
  }

  // 1. Check if any session exists between them
  const hasSession = await Session.exists({
    $or: [
      { proposer: userIdA, partner: userIdB },
      { proposer: userIdB, partner: userIdA },
    ],
  });

  if (hasSession) {
    return true;
  }

  // 2. Check if they match in skills
  const [userA, userB] = await Promise.all([
    User.findById(userIdA).populate('skillsOffered.skill').populate('skillsWanted.skill'),
    User.findById(userIdB).populate('skillsOffered.skill').populate('skillsWanted.skill'),
  ]);

  if (!userA || !userB) {
    return false;
  }

  const match = calculateMatchScore(userA, userB);
  return match !== null;
};

/**
 * Finds or creates a conversation between two users after verifying permissions.
 */
const findOrCreateConversation = async (userIdA, userIdB) => {
  const allowed = await canInitiateConversation(userIdA, userIdB);
  if (!allowed) {
    throw new AppError(
      'You can only message users you have a session with or who match your learning/teaching skills.',
      403,
      'CHAT_NOT_PERMITTED'
    );
  }

  const participantKey = Conversation.generateParticipantKey(userIdA, userIdB);

  let conversation = await Conversation.findOne({ participantKey })
    .populate('participants', 'name email timezone reputation bio');

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [userIdA, userIdB],
      participantKey,
      lastMessageAt: new Date(),
    });

    conversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name email timezone reputation bio');
  }

  return conversation;
};

/**
 * Saves a new message to the database and updates conversation lastMessage.
 */
const persistMessage = async (conversationId, senderId, text) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');
  }

  const isParticipant = conversation.participants.some(
    p => p.toString() === senderId.toString()
  );

  if (!isParticipant) {
    throw new AppError('You are not a participant in this conversation', 403, 'FORBIDDEN');
  }

  const cleanText = String(text || '').trim().slice(0, 1000);
  if (!cleanText) {
    throw new AppError('Message cannot be empty', 400, 'EMPTY_MESSAGE');
  }

  const message = await Message.create({
    conversation: conversationId,
    sender: senderId,
    text: cleanText,
    readBy: [senderId],
  });

  // Update conversation lastMessage
  conversation.lastMessage = {
    text: cleanText,
    sender: senderId,
    createdAt: message.createdAt,
  };
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();

  const populated = await Message.findById(message._id).populate('sender', 'name reputation');
  return { conversation, message: populated };
};

/**
 * Marks messages in a conversation as read by a user.
 */
const markMessagesRead = async (conversationId, userId) => {
  await Message.updateMany(
    {
      conversation: conversationId,
      readBy: { $ne: userId },
    },
    {
      $addToSet: { readBy: userId },
    }
  );
};

module.exports = {
  canInitiateConversation,
  findOrCreateConversation,
  persistMessage,
  markMessagesRead,
};
