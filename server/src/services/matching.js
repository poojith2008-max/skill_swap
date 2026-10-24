const User = require('../models/User');

const TOTAL_WEEK_MINUTES = 7 * 1440; // 10080 minutes in a 7-day week

/**
 * Computes offset in minutes for an IANA timezone relative to UTC.
 * E.g. Asia/Kolkata -> +330, America/New_York -> -240 / -300 depending on DST.
 */
const getTimezoneOffsetMinutes = (timeZone) => {
  try {
    const now = new Date();
    // Compare ISO representation between UTC and given timezone
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = now.toLocaleString('en-US', { timeZone });
    const utcDate = new Date(utcStr);
    const tzDate = new Date(tzStr);
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000);
  } catch (err) {
    // Fallback if invalid timezone name
    return 0;
  }
};

/**
 * Converts local availability slots into non-wrapped UTC intervals [startMin, endMin] within [0, 10080].
 */
const convertSlotsToUtcIntervals = (availability = [], timeZone = 'UTC') => {
  const offset = getTimezoneOffsetMinutes(timeZone);
  const intervals = [];

  for (const slot of availability) {
    const localStart = slot.weekday * 1440 + slot.startMin;
    const localEnd = slot.weekday * 1440 + slot.endMin;

    // Convert to UTC by subtracting offset
    let utcStart = localStart - offset;
    let utcEnd = localEnd - offset;

    // Shift to positive range
    while (utcStart < 0) {
      utcStart += TOTAL_WEEK_MINUTES;
      utcEnd += TOTAL_WEEK_MINUTES;
    }

    utcStart = utcStart % TOTAL_WEEK_MINUTES;
    utcEnd = utcEnd % TOTAL_WEEK_MINUTES;

    if (utcStart < utcEnd) {
      intervals.push({ start: utcStart, end: utcEnd });
    } else if (utcStart > utcEnd) {
      // Slot wrapped around week boundary (Sunday midnight UTC)
      intervals.push({ start: utcStart, end: TOTAL_WEEK_MINUTES });
      intervals.push({ start: 0, end: utcEnd });
    }
  }

  // Sort and merge intervals
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a.start - b.start);

  const merged = [];
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= cur.end) {
      cur.end = Math.max(cur.end, next.end);
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);

  return merged;
};

/**
 * Computes intersection of two sets of UTC intervals.
 * Returns { totalOverlapMinutes, overlappingIntervals }
 */
const intersectUtcIntervals = (intervalsA = [], intervalsB = []) => {
  const overlaps = [];
  let totalMinutes = 0;

  for (const a of intervalsA) {
    for (const b of intervalsB) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);

      if (start < end) {
        overlaps.push({ start, end });
        totalMinutes += end - start;
      }
    }
  }

  return { totalMinutes, overlaps };
};

/**
 * Converts UTC intervals back to user's local weekly slots
 */
const convertUtcIntervalsToLocalSlots = (utcIntervals = [], userTimeZone = 'Asia/Kolkata') => {
  const offset = getTimezoneOffsetMinutes(userTimeZone);
  const localSlots = [];

  const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const interval of utcIntervals) {
    let localStart = (interval.start + offset) % TOTAL_WEEK_MINUTES;
    let localEnd = (interval.end + offset) % TOTAL_WEEK_MINUTES;
    if (localStart < 0) localStart += TOTAL_WEEK_MINUTES;
    if (localEnd < 0) localEnd += TOTAL_WEEK_MINUTES;

    const weekday = Math.floor(localStart / 1440);
    const startMin = localStart % 1440;
    const endMin = (interval.end - interval.start) + startMin;

    const formatTime = (min) => {
      const h = Math.floor(min / 60).toString().padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    localSlots.push({
      weekday,
      weekdayName: WEEKDAY_NAMES[weekday],
      startMin,
      endMin: Math.min(1440, endMin),
      label: `${WEEKDAY_NAMES[weekday]} ${formatTime(startMin)} - ${formatTime(Math.min(1440, endMin))}`,
    });
  }

  return localSlots;
};

/**
 * Pure scoring function between a target user and a candidate user
 */
const calculateMatchScore = (targetUser, candidateUser) => {
  // 1. Skill overlap detection
  const targetOfferedIds = (targetUser.skillsOffered || []).map(s => (s.skill?._id || s.skill).toString());
  const targetWantedIds = (targetUser.skillsWanted || []).map(s => (s.skill?._id || s.skill).toString());

  const candidateOffered = candidateUser.skillsOffered || [];
  const candidateWanted = candidateUser.skillsWanted || [];

  const candidateOfferedIds = candidateOffered.map(s => (s.skill?._id || s.skill).toString());
  const candidateWantedIds = candidateWanted.map(s => (s.skill?._id || s.skill).toString());

  // Forward: Target teaches, candidate wants
  const targetTeachesSkills = (targetUser.skillsOffered || []).filter(o =>
    candidateWantedIds.includes((o.skill?._id || o.skill).toString())
  );

  // Backward: Candidate teaches, target wants
  const candidateTeachesSkills = candidateOffered.filter(o =>
    targetWantedIds.includes((o.skill?._id || o.skill).toString())
  );

  // Exclude users with zero skill overlap in either direction
  if (targetTeachesSkills.length === 0 && candidateTeachesSkills.length === 0) {
    return null;
  }

  let score = 0;
  const isMutual = targetTeachesSkills.length > 0 && candidateTeachesSkills.length > 0;

  // Mutual match: +50, One-way match: +20
  if (isMutual) {
    score += 50;
  } else {
    score += 20;
  }

  // Level fit: +5 if the learner's wanted skill is offered at higher-or-equal level than beginner (intermediate or expert)
  let levelFit = false;
  if (candidateTeachesSkills.some(s => s.level === 'intermediate' || s.level === 'expert')) {
    levelFit = true;
  }
  if (targetTeachesSkills.some(s => s.level === 'intermediate' || s.level === 'expert')) {
    levelFit = true;
  }
  if (levelFit) {
    score += 5;
  }

  // Availability overlap: +2 per overlapping hour/week (cap +20)
  const targetUtcIntervals = convertSlotsToUtcIntervals(targetUser.availability, targetUser.timezone);
  const candidateUtcIntervals = convertSlotsToUtcIntervals(candidateUser.availability, candidateUser.timezone);
  const { totalMinutes, overlaps } = intersectUtcIntervals(targetUtcIntervals, candidateUtcIntervals);

  const overlappingHours = totalMinutes / 60;
  const availabilityScore = Math.min(20, Math.round(overlappingHours * 2 * 10) / 10);
  score += availabilityScore;

  // Reputation boost: + (bayesian avg - 3) * 3
  const candidateBayesian = candidateUser.reputation?.bayesian ?? 3.5;
  const repBoost = Math.round((candidateBayesian - 3) * 3 * 10) / 10;
  score += repBoost;

  score = Math.round(score * 10) / 10;

  // Human-readable explanation
  const targetTeachNames = targetTeachesSkills
    .map(s => s.skill?.name || 'their skill')
    .filter(Boolean);
  const candidateTeachNames = candidateTeachesSkills
    .map(s => s.skill?.name || 'their skill')
    .filter(Boolean);

  let explanation = '';
  if (isMutual) {
    explanation = `Mutual match! You teach ${targetTeachNames.join(', ')}, they teach ${candidateTeachNames.join(', ')}, ${Math.round(overlappingHours)} overlapping hours/week`;
  } else if (candidateTeachesSkills.length > 0) {
    explanation = `They can teach you ${candidateTeachNames.join(', ')}, ${Math.round(overlappingHours)} overlapping hours/week`;
  } else {
    explanation = `You can teach them ${targetTeachNames.join(', ')}, ${Math.round(overlappingHours)} overlapping hours/week`;
  }

  const sharedSlots = convertUtcIntervalsToLocalSlots(overlaps, targetUser.timezone);

  return {
    user: candidateUser,
    score,
    isMutual,
    levelFit,
    overlappingHours: Math.round(overlappingHours * 10) / 10,
    availabilityScore,
    reputationBoost: repBoost,
    targetTeachesSkills,
    candidateTeachesSkills,
    explanation,
    sharedSlots,
  };
};

/**
 * Retrieves ranked partner matches for a user
 */
const getMatches = async (userId, { limit = 20 } = {}) => {
  const targetUser = await User.findById(userId)
    .populate('skillsOffered.skill')
    .populate('skillsWanted.skill');

  if (!targetUser) {
    throw new Error('User not found');
  }

  // Find all other users
  const candidates = await User.find({ _id: { $ne: userId } })
    .populate('skillsOffered.skill')
    .populate('skillsWanted.skill');

  const matches = [];

  for (const candidate of candidates) {
    const match = calculateMatchScore(targetUser, candidate);
    if (match) {
      matches.push(match);
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, limit);
};

module.exports = {
  getMatches,
  calculateMatchScore,
  getTimezoneOffsetMinutes,
  convertSlotsToUtcIntervals,
  intersectUtcIntervals,
  convertUtcIntervalsToLocalSlots,
};
