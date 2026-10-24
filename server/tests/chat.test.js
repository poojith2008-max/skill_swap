const request = require('supertest');
const http = require('http');
const ioClient = require('socket.io-client');
const app = require('../src/app');
const User = require('../src/models/User');
const Skill = require('../src/models/Skill');
const Session = require('../src/models/Session');
const Conversation = require('../src/models/Conversation');
const Message = require('../src/models/Message');
const { connectDB, disconnectDB } = require('../src/config/db');
const { initSocket } = require('../src/sockets/chatSocket');
const { canInitiateConversation } = require('../src/services/chatService');

describe('Real-Time Chat & Socket.io Integration Tests', () => {
  let tokenA, userA;
  let tokenB, userB;
  let tokenC, userC;
  let skillPy, skillJs;
  let server, io, socketServerUrl;

  beforeAll(async () => {
    await connectDB();

    // Start ephemeral HTTP server for socket testing
    server = http.createServer(app);
    io = initSocket(server, ['*']);
    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        socketServerUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (io) io.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Skill.deleteMany({});
    await Session.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    skillPy = await Skill.create({ name: 'Python', slug: 'python' });
    skillJs = await Skill.create({ name: 'JavaScript', slug: 'javascript' });

    // User A: offers Python, wants JS
    const resA = await request(app).post('/api/auth/register').send({
      name: 'Alice Coder',
      email: 'alice@chat.test',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user;
    await User.findByIdAndUpdate(userA._id, {
      skillsOffered: [{ skill: skillPy._id, level: 'expert' }],
      skillsWanted: [{ skill: skillJs._id }],
    });

    // User B: offers JS, wants Python (Mutual match with A)
    const resB = await request(app).post('/api/auth/register').send({
      name: 'Bob Scripter',
      email: 'bob@chat.test',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user;
    await User.findByIdAndUpdate(userB._id, {
      skillsOffered: [{ skill: skillJs._id, level: 'intermediate' }],
      skillsWanted: [{ skill: skillPy._id }],
    });

    // User C: no skill match with A or B
    const resC = await request(app).post('/api/auth/register').send({
      name: 'Charlie Stranger',
      email: 'charlie@chat.test',
      password: 'Password123!',
    });
    tokenC = resC.body.token;
    userC = resC.body.user;
  });

  describe('Chat Permission Guard', () => {
    it('should permit conversation between users with mutual skill match', async () => {
      const allowed = await canInitiateConversation(userA._id, userB._id);
      expect(allowed).toBe(true);
    });

    it('should forbid conversation between strangers with zero matches and no session', async () => {
      const allowed = await canInitiateConversation(userA._id, userC._id);
      expect(allowed).toBe(false);
    });

    it('should permit conversation if users have an active or past session even if skill match changes', async () => {
      // Create session between A and C
      await Session.create({
        proposer: userA._id,
        partner: userC._id,
        start: new Date(Date.now() + 24 * 3600 * 1000),
        end: new Date(Date.now() + 25 * 3600 * 1000),
        status: 'proposed',
      });

      const allowed = await canInitiateConversation(userA._id, userC._id);
      expect(allowed).toBe(true);
    });
  });

  describe('REST Endpoints: /api/conversations', () => {
    it('POST /api/conversations should create or return unique conversation between matched users', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id });

      expect(res.statusCode).toBe(200);
      expect(res.body.conversation).toHaveProperty('_id');
      expect(res.body.conversation.participants).toHaveLength(2);

      // Re-querying should return the exact same conversation
      const res2 = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ recipientId: userA._id });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.conversation._id).toBe(res.body.conversation._id);
    });

    it('POST /api/conversations should reject unmatched strangers with 403', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userC._id });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('CHAT_NOT_PERMITTED');
    });

    it('POST /api/conversations/:id/messages should persist message and update conversation', async () => {
      // Create conversation
      const convRes = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id });
      const convId = convRes.body.conversation._id;

      // Send message
      const msgRes = await request(app)
        .post(`/api/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: 'Hello Bob! Ready to exchange skills?' });

      expect(msgRes.statusCode).toBe(201);
      expect(msgRes.body.message.text).toBe('Hello Bob! Ready to exchange skills?');
      expect(msgRes.body.message.sender._id).toBe(userA._id);

      // Fetch messages
      const getRes = await request(app)
        .get(`/api/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(getRes.statusCode).toBe(200);
      expect(getRes.body.messages).toHaveLength(1);
      expect(getRes.body.messages[0].text).toBe('Hello Bob! Ready to exchange skills?');
    });
  });

  describe('WebSocket Handshake & Real-Time Events', () => {
    it('should reject socket connection with missing or invalid token', (done) => {
      const socket = ioClient(socketServerUrl, {
        auth: { token: 'invalid_token_here' },
        transports: ['websocket'],
      });

      socket.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication error');
        socket.disconnect();
        done();
      });
    });

    it('should authenticate valid JWT, join conversation, and emit real-time messages', (done) => {
      // Create conversation first via REST
      request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ recipientId: userB._id })
        .then((res) => {
          const convId = res.body.conversation._id;

          // Connect Client A
          const clientA = ioClient(socketServerUrl, {
            auth: { token: tokenA },
            transports: ['websocket'],
          });

          // Connect Client B
          const clientB = ioClient(socketServerUrl, {
            auth: { token: tokenB },
            transports: ['websocket'],
          });

          clientB.on('connect', () => {
            // Client B joins conversation room
            clientB.emit('join_conversation', { conversationId: convId }, (joinRes) => {
              expect(joinRes.success).toBe(true);

              // Client B listens for new_message
              clientB.on('new_message', (payload) => {
                expect(payload.conversationId).toBe(convId);
                expect(payload.message.text).toBe('Live WebSocket message from A to B!');
                clientA.disconnect();
                clientB.disconnect();
                done();
              });

              // Client A sends message via WebSocket
              clientA.emit('send_message', {
                conversationId: convId,
                text: 'Live WebSocket message from A to B!',
              });
            });
          });
        });
    });
  });
});
