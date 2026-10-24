const AppError = require('../utils/AppError');

/**
 * Validates, sorts, and merges adjacent and overlapping availability slots per weekday.
 * Each slot has { weekday: 0-6, startMin: 0-1440, endMin: 0-1440 }.
 * Start must be strictly less than end.
 * If two intervals touch or overlap (e.g. [540, 600] and [600, 720]), they are merged into [540, 720].
 */
const normalizeAvailability = (slots = []) => {
  if (!Array.isArray(slots)) {
    throw new AppError('Availability must be an array of time intervals', 422, 'INVALID_AVAILABILITY');
  }

  // 1. Validate each slot format
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const { weekday, startMin, endMin } = slot;

    if (
      typeof weekday !== 'number' ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isInteger(weekday)
    ) {
      throw new AppError(`Slot at index ${i} has invalid weekday. Must be integer between 0 and 6`, 422, 'INVALID_WEEKDAY');
    }

    if (
      typeof startMin !== 'number' ||
      typeof endMin !== 'number' ||
      startMin < 0 ||
      endMin > 1440 ||
      !Number.isInteger(startMin) ||
      !Number.isInteger(endMin)
    ) {
      throw new AppError(`Slot at index ${i} has invalid minutes. Must be integer between 0 and 1440`, 422, 'INVALID_MINUTES');
    }

    if (startMin >= endMin) {
      throw new AppError(
        `Slot at index ${i} invalid: start (${startMin}) must be strictly less than end (${endMin})`,
        422,
        'INVALID_INTERVAL'
      );
    }
  }

  // 2. Group by weekday
  const byWeekday = {};
  for (let d = 0; d <= 6; d++) {
    byWeekday[d] = [];
  }

  for (const slot of slots) {
    byWeekday[slot.weekday].push({
      startMin: slot.startMin,
      endMin: slot.endMin,
    });
  }

  // 3. For each weekday, sort by startMin, merge overlapping & adjacent intervals
  const normalized = [];

  for (let d = 0; d <= 6; d++) {
    const daySlots = byWeekday[d];
    if (daySlots.length === 0) continue;

    daySlots.sort((a, b) => a.startMin - b.startMin);

    const merged = [];
    let current = { ...daySlots[0] };

    for (let i = 1; i < daySlots.length; i++) {
      const next = daySlots[i];
      // If next starts before or exactly when current ends (adjacent or overlapping)
      if (next.startMin <= current.endMin) {
        current.endMin = Math.max(current.endMin, next.endMin);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);

    for (const m of merged) {
      normalized.push({
        weekday: d,
        startMin: m.startMin,
        endMin: m.endMin,
      });
    }
  }

  return normalized;
};

module.exports = {
  normalizeAvailability,
};
