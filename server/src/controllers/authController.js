const User = require('../models/User');
const AppError = require('../utils/AppError');
const { signToken } = require('../utils/jwt');

const register = async (req, res, next) => {
  try {
    const { name, email, password, bio, timezone } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return next(new AppError('An account with this email address already exists.', 409, 'EMAIL_EXISTS'));
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      bio: bio || '',
      timezone: timezone || 'Asia/Kolkata',
    });

    const token = signToken({ userId: user._id });

    res.status(201).json({
      message: 'Account registered successfully',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+passwordHash')
      .populate('skillsOffered.skill')
      .populate('skillsWanted.skill');

    if (!user) {
      return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    const token = signToken({ userId: user._id });

    res.status(200).json({
      message: 'Logged in successfully',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res) => {
  res.status(200).json({
    message: 'Logged out successfully',
  });
};

const getMe = async (req, res) => {
  res.status(200).json({
    user: req.user.toJSON ? req.user.toJSON() : req.user,
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
};
