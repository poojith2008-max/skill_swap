const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    // Sorted participant string key to guarantee uniqueness regardless of array order
    participantKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastMessage: {
      text: { type: String, default: '' },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdAt: { type: Date, default: Date.now },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

conversationSchema.index({ participants: 1 });

// Helper static method to generate canonical participantKey
conversationSchema.statics.generateParticipantKey = function (userIdA, userIdB) {
  const sorted = [userIdA.toString(), userIdB.toString()].sort();
  return `${sorted[0]}_${sorted[1]}`;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

module.exports = Conversation;
