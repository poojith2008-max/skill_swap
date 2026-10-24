// Recursive object cleaner to prevent MongoDB operator injection ($gt, $where, etc.)
const sanitizeInput = (data) => {
  if (data instanceof Array) {
    return data.map(item => sanitizeInput(item));
  }
  if (data !== null && typeof data === 'object') {
    const cleanObj = {};
    for (const key of Object.keys(data)) {
      if (key.startsWith('$') || key.includes('.')) {
        // Drop dangerous keys
        continue;
      }
      cleanObj[key] = sanitizeInput(data[key]);
    }
    return cleanObj;
  }
  return data;
};

const sanitizeMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeInput(req.body);
  if (req.params) req.params = sanitizeInput(req.params);
  // Note: in Express 4 req.query can also be sanitized
  if (req.query) req.query = sanitizeInput(req.query);
  next();
};

module.exports = sanitizeMiddleware;
