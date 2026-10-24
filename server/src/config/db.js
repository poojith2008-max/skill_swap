const dns = require('dns');
const mongoose = require('mongoose');
const env = require('./env');

let memoryServer = null;

const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    let mongoUri = env.MONGODB_URI;

    if (mongoUri && mongoUri.startsWith('mongodb+srv://')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
      } catch (dnsErr) {
        // Continue if environment prevents setting DNS servers
      }
    }

    if (mongoUri === 'memory' || env.NODE_ENV === 'test') {
      if (!memoryServer) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        console.log('⚡ Initialized MongoMemoryServer for development/testing');
      }
      mongoUri = memoryServer.getUri();
    }

    mongoose.set('strictQuery', true);
    await mongoose.connect(mongoUri);

    console.log(`✅ MongoDB connected successfully to: ${mongoUri.includes('127.0.0.1') || mongoUri.includes('localhost') ? 'Local/In-Memory MongoDB' : 'Remote MongoDB'}`);
    return mongoose.connection;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // In dev fallback to memory server if local MongoDB is unreachable
    try {
      console.log('⚠️ Attempting fallback to MongoMemoryServer in development...');
      if (!memoryServer) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
      }
      const fallbackUri = memoryServer.getUri();
      await mongoose.connect(fallbackUri);
      console.log('✅ Fallback MongoMemoryServer connected successfully');
      return mongoose.connection;
    } catch (fallbackError) {
      console.error('❌ Fallback failed:', fallbackError.message);
      process.exit(1);
    }
  }
};

const disconnectDB = async (forceStop = false) => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (forceStop && memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
  } catch (error) {
    console.error('Error during MongoDB disconnect:', error.message);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
