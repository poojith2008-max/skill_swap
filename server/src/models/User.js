const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('./Skill');

const availabilitySchema = new mongoose.Schema(
  {
    weekday: {
      type: Number,
      required: true,
      min: 0,
      max: 6, // 0 = Sunday, 6 = Saturday
    },
    startMin: {
      type: Number,
      required: true,
      min: 0,
      max: 1440, // minutes from midnight
    },
    endMin: {
      type: Number,
      required: true,
      min: 0,
      max: 1440,
    },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
      trim: true,
    },
    skillsOffered: [
      {
        skill: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Skill',
          required: true,
        },
        level: {
          type: String,
          enum: ['beginner', 'intermediate', 'expert'],
          default: 'intermediate',
        },
      },
    ],
    skillsWanted: [
      {
        skill: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Skill',
          required: true,
        },
      },
    ],
    availability: [availabilitySchema],
    reputation: {
      avg: {
        type: Number,
        default: 0,
      },
      count: {
        type: Number,
        default: 0,
      },
      bayesian: {
        type: Number,
        default: 3.5, // Prior mean m=3.5
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Method to verify password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash not loaded');
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash password
userSchema.statics.hashPassword = async function (password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
