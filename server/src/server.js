const http = require('http');
const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { initSocket } = require('./sockets/chatSocket');
const { startExpiryCron } = require('./jobs/expiryJob');

const server = http.createServer(app);

// Initialize Socket.io
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

const io = initSocket(server, allowedOrigins);

const startServer = async () => {
  try {
    await connectDB();

    // Start auto-expiry cron (every 10 minutes)
    startExpiryCron(io);

    server.listen(env.PORT, () => {
      console.log(`🚀 SkillSwap Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
      console.log(`🩺 Health check available at http://localhost:${env.PORT}/api/health`);
    });
  } catch (error) {
    console.error('Fatal startup error:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  server.close(() => {
    process.exit(1);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = { server, startServer };
