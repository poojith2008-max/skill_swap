const { getMatches } = require('../services/matching');

const getMatchesHandler = async (req, res, next) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    const matches = await getMatches(req.user._id, { limit });

    res.status(200).json({
      matches,
      count: matches.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMatchesHandler,
};
