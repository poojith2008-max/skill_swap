const User = require('../models/User');
const AppError = require('../utils/AppError');
const { resolveSkill } = require('../utils/skillResolver');
const { normalizeAvailability } = require('../services/availability');

// GET /api/users/:id - Public profile
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .populate('skillsOffered.skill')
      .populate('skillsWanted.skill');

    if (!user) {
      return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
    }

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        bio: user.bio,
        timezone: user.timezone,
        skillsOffered: user.skillsOffered,
        skillsWanted: user.skillsWanted,
        availability: user.availability,
        reputation: user.reputation,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/me - Update profile (bio, timezone, skillsOffered, skillsWanted)
const updateMe = async (req, res, next) => {
  try {
    const { bio, timezone, skillsOffered, skillsWanted } = req.body;
    const user = await User.findById(req.user._id);

    if (bio !== undefined) {
      user.bio = bio;
    }

    if (timezone !== undefined) {
      user.timezone = timezone;
    }

    if (skillsOffered !== undefined && Array.isArray(skillsOffered)) {
      const resolvedOffered = [];
      for (const item of skillsOffered) {
        const rawSkill = item.skill || item;
        const resolved = await resolveSkill(rawSkill);
        if (resolved) {
          resolvedOffered.push({
            skill: resolved._id,
            level: ['beginner', 'intermediate', 'expert'].includes(item.level)
              ? item.level
              : 'intermediate',
          });
        }
      }
      user.skillsOffered = resolvedOffered;
    }

    if (skillsWanted !== undefined && Array.isArray(skillsWanted)) {
      const resolvedWanted = [];
      for (const item of skillsWanted) {
        const rawSkill = item.skill || item;
        const resolved = await resolveSkill(rawSkill);
        if (resolved) {
          resolvedWanted.push({
            skill: resolved._id,
          });
        }
      }
      user.skillsWanted = resolvedWanted;
    }

    await user.save();
    const updated = await User.findById(user._id)
      .populate('skillsOffered.skill')
      .populate('skillsWanted.skill');

    res.status(200).json({
      message: 'Profile updated successfully',
      user: updated.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/users/me/availability - Weekly availability editor
const updateMyAvailability = async (req, res, next) => {
  try {
    const { availability } = req.body;
    const normalized = normalizeAvailability(availability || []);

    const user = await User.findById(req.user._id);
    user.availability = normalized;
    await user.save();

    res.status(200).json({
      message: 'Availability updated successfully',
      availability: user.availability,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserById,
  updateMe,
  updateMyAvailability,
};
