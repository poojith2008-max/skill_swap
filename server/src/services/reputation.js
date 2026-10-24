const User = require('../models/User');
const Review = require('../models/Review');

const DEFAULT_PRIOR_WEIGHT_C = 5;
const DEFAULT_PRIOR_MEAN_M = 3.5;

/**
 * Pure function to compute Bayesian Average rating.
 * Formula: (C * m + sum(ratings)) / (C + n)
 *
 * @param {number[]} ratings - Array of ratings (1-5)
 * @param {object} options - Prior parameters { C, m }
 * @returns {object} { avg: number, count: number, bayesian: number }
 */
const calculateBayesianReputation = (
  ratings = [],
  { C = DEFAULT_PRIOR_WEIGHT_C, m = DEFAULT_PRIOR_MEAN_M } = {}
) => {
  const n = ratings.length;
  if (n === 0) {
    return {
      avg: 0,
      count: 0,
      bayesian: m,
    };
  }

  const sum = ratings.reduce((acc, curr) => acc + curr, 0);
  const avg = Math.round((sum / n) * 100) / 100;
  const bayesian = Math.round(((C * m + sum) / (C + n)) * 100) / 100;

  return {
    avg,
    count: n,
    bayesian,
  };
};

/**
 * Recomputes and updates the reputation for a user based on all verified reviews.
 */
const updateUserReputation = async (userId) => {
  const reviews = await Review.find({ reviewee: userId }).select('rating');
  const ratings = reviews.map(r => r.rating);

  const reputation = calculateBayesianReputation(ratings);

  await User.findByIdAndUpdate(userId, {
    $set: { reputation },
  });

  return reputation;
};

module.exports = {
  calculateBayesianReputation,
  updateUserReputation,
  DEFAULT_PRIOR_WEIGHT_C,
  DEFAULT_PRIOR_MEAN_M,
};
