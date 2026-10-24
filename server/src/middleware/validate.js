const { z } = require('zod');
const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

// Zod custom validator for MongoDB ObjectId
const objectIdSchema = z.string().refine(val => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId format',
});

// Generic validation middleware accepting schemas for body, query, and params
const validate = ({ body, query, params }) => {
  return async (req, res, next) => {
    try {
      if (body) {
        req.body = await body.parseAsync(req.body);
      }
      if (query) {
        req.query = await query.parseAsync(req.query);
      }
      if (params) {
        req.params = await params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  validate,
  objectIdSchema,
};
