const mongoose = require('mongoose');

const sessionHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ['proposed', 'accepted', 'countered', 'declined', 'cancelled', 'completed', 'expired'],
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    proposer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Proposer is required'],
      index: true,
    },
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Partner is required'],
      index: true,
    },
    start: {
      type: Date,
      required: [true, 'Start time is required'],
      index: true,
    },
    end: {
      type: Date,
      required: [true, 'End time is required'],
      index: true,
    },
    topics: {
      proposerTeaches: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
        default: null,
      },
      partnerTeaches: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Skill',
        default: null,
      },
    },
    status: {
      type: String,
      enum: ['proposed', 'accepted', 'countered', 'declined', 'cancelled', 'completed', 'expired'],
      default: 'proposed',
      index: true,
    },
    counterOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    completion: {
      proposer: {
        type: Boolean,
        default: false,
      },
      partner: {
        type: Boolean,
        default: false,
      },
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    history: [sessionHistorySchema],
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

// Indexes for conflict queries
sessionSchema.index({ proposer: 1, start: 1, end: 1, status: 1 });
sessionSchema.index({ partner: 1, start: 1, end: 1, status: 1 });
sessionSchema.index({ expiresAt: 1, status: 1 });

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
