const mongoose = require('mongoose');
const env = require('../config/env');
const { connectDB } = require('../config/db');

// Models
const User = require('../models/User');
const Skill = require('../models/Skill');
const Session = require('../models/Session');
const Review = require('../models/Review');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Notification = require('../models/Notification');

// Data & Helpers
const skillsSeedData = require('./skillsData');
const { updateUserReputation } = require('../services/reputation');

const seedDatabase = async () => {
  try {
    console.log('🔄 Connecting to database for seeding...');
    await connectDB();

    console.log('🧹 Purging existing collections (idempotent seed)...');
    await Promise.all([
      User.deleteMany({}),
      Skill.deleteMany({}),
      Session.deleteMany({}),
      Review.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    console.log('🌱 Seeding skills catalog (44 skills)...');
    const insertedSkills = await Skill.insertMany(skillsSeedData);
    const skillMap = {};
    for (const s of insertedSkills) {
      skillMap[s.slug] = s;
    }

    const defaultPasswordHash = await User.hashPassword('Password123!');

    console.log('🌱 Seeding 20+ realistic users with mutual match pairs & timezones...');

    // 1. DEMO USER
    const demoUser = await User.create({
      name: 'Alex Rivera (Demo)',
      email: 'demo@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Fullstack engineer & guitar hobbyist. Looking to trade Python & Web dev skills for Spanish language and Chess strategy!',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['javascript']._id, level: 'expert' },
        { skill: skillMap['python']._id, level: 'expert' },
        { skill: skillMap['react']._id, level: 'expert' },
        { skill: skillMap['acoustic-guitar']._id, level: 'intermediate' },
      ],
      skillsWanted: [
        { skill: skillMap['spanish']._id },
        { skill: skillMap['chess-strategy']._id },
        { skill: skillMap['docker']._id },
        { skill: skillMap['ui-ux-design']._id },
      ],
      availability: [
        { weekday: 1, startMin: 540, endMin: 720 }, // Mon 09:00 - 12:00
        { weekday: 3, startMin: 1080, endMin: 1260 }, // Wed 18:00 - 21:00
        { weekday: 6, startMin: 600, endMin: 840 }, // Sat 10:00 - 14:00
      ],
    });

    // 2. MUTUAL MATCH 1: Maria Rodriguez (Teaches Spanish, wants Python)
    const maria = await User.create({
      name: 'Maria Rodriguez',
      email: 'maria@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Native Spanish speaker and linguist learning Python for data analysis.',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['spanish']._id, level: 'expert' },
        { skill: skillMap['french']._id, level: 'intermediate' },
      ],
      skillsWanted: [
        { skill: skillMap['python']._id },
        { skill: skillMap['javascript']._id },
      ],
      availability: [
        { weekday: 3, startMin: 1080, endMin: 1260 }, // Wed 18:00 - 21:00 (Overlaps with Demo!)
        { weekday: 5, startMin: 1080, endMin: 1200 },
      ],
    });

    // 3. MUTUAL MATCH 2: Viktor Kasparov (Teaches Chess, wants Acoustic Guitar)
    const viktor = await User.create({
      name: 'Viktor Kasparov',
      email: 'viktor@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Candidate Chess Master. Always dreamed of learning acoustic fingerstyle guitar!',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['chess-strategy']._id, level: 'expert' },
        { skill: skillMap['data-structures-algorithms']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['acoustic-guitar']._id },
      ],
      availability: [
        { weekday: 6, startMin: 600, endMin: 780 }, // Sat 10:00 - 13:00 (Overlaps with Demo!)
        { weekday: 0, startMin: 600, endMin: 780 },
      ],
    });

    // 4. MUTUAL MATCH 3: Hiroshi Tanaka & Elena Rostova
    const hiroshi = await User.create({
      name: 'Hiroshi Tanaka',
      email: 'hiroshi@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Tokyo native teaching Japanese, curious about Deep Learning and PyTorch.',
      timezone: 'Asia/Tokyo',
      skillsOffered: [
        { skill: skillMap['japanese']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['machine-learning']._id },
      ],
      availability: [
        { weekday: 2, startMin: 1140, endMin: 1320 },
        { weekday: 4, startMin: 1140, endMin: 1320 },
      ],
    });

    const elena = await User.create({
      name: 'Elena Rostova',
      email: 'elena@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'AI researcher and PyTorch practitioner eager to learn conversational Japanese.',
      timezone: 'Asia/Tokyo',
      skillsOffered: [
        { skill: skillMap['machine-learning']._id, level: 'expert' },
        { skill: skillMap['python']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['japanese']._id },
      ],
      availability: [
        { weekday: 2, startMin: 1140, endMin: 1320 },
        { weekday: 4, startMin: 1140, endMin: 1320 },
      ],
    });

    // 5. Priya Sharma (UI/UX Design)
    const priya = await User.create({
      name: 'Priya Sharma',
      email: 'priya@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Lead product designer at a fintech startup. Can coach Figma and design systems.',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['ui-ux-design']._id, level: 'expert' },
        { skill: skillMap['figma']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['react']._id },
        { skill: skillMap['nextjs']._id },
      ],
      availability: [
        { weekday: 1, startMin: 540, endMin: 720 },
        { weekday: 5, startMin: 960, endMin: 1140 },
      ],
    });

    // 6. Liam O'Connor (Vocal Singing & Guitar)
    const liam = await User.create({
      name: "Liam O'Connor",
      email: 'liam@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Vocal coach and indie songwriter. Looking to learn Web development fundamentals.',
      timezone: 'Europe/London',
      skillsOffered: [
        { skill: skillMap['vocal-singing']._id, level: 'expert' },
        { skill: skillMap['music-production']._id, level: 'intermediate' },
      ],
      skillsWanted: [
        { skill: skillMap['html-css']._id },
        { skill: skillMap['javascript']._id },
      ],
      availability: [
        { weekday: 6, startMin: 600, endMin: 900 },
      ],
    });

    // 7. Sofia Chen (Mandarin & DSA)
    const sofia = await User.create({
      name: 'Sofia Chen',
      email: 'sofia@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Software engineer at Big Tech. Passionate about Leetcode algorithms and Mandarin.',
      timezone: 'America/Los_Angeles',
      skillsOffered: [
        { skill: skillMap['mandarin-chinese']._id, level: 'expert' },
        { skill: skillMap['data-structures-algorithms']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['digital-photography']._id },
      ],
      availability: [
        { weekday: 0, startMin: 600, endMin: 900 },
      ],
    });

    // 8. Carlos Gomez (Electric Guitar & Music Production)
    const carlos = await User.create({
      name: 'Carlos Gomez',
      email: 'carlos@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Rock & metal guitarist. Ableton Live music producer.',
      timezone: 'America/Chicago',
      skillsOffered: [
        { skill: skillMap['electric-guitar']._id, level: 'expert' },
        { skill: skillMap['music-production']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['video-editing']._id },
      ],
      availability: [
        { weekday: 5, startMin: 1080, endMin: 1320 },
      ],
    });

    // 9. Aisha Patel (Databases & Python)
    const aisha = await User.create({
      name: 'Aisha Patel',
      email: 'aisha@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Database administrator specializing in PostgreSQL and MongoDB performance tuning.',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['sql-databases']._id, level: 'expert' },
        { skill: skillMap['mongodb']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['docker']._id },
      ],
      availability: [
        { weekday: 2, startMin: 600, endMin: 780 },
      ],
    });

    // 10. Jean Dupont (French & Writing)
    const jean = await User.create({
      name: 'Jean Dupont',
      email: 'jean@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Novelist and creative writing teacher based in Paris.',
      timezone: 'Europe/Paris',
      skillsOffered: [
        { skill: skillMap['french']._id, level: 'expert' },
        { skill: skillMap['creative-writing']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['piano-keyboard']._id },
      ],
      availability: [
        { weekday: 4, startMin: 900, endMin: 1140 },
      ],
    });

    // 11. Marcus Weber (Kubernetes & Go)
    const marcus = await User.create({
      name: 'Marcus Weber',
      email: 'marcus@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Cloud infrastructure architect from Berlin. Loving Go and K8s.',
      timezone: 'Europe/Berlin',
      skillsOffered: [
        { skill: skillMap['kubernetes']._id, level: 'expert' },
        { skill: skillMap['go-golang']._id, level: 'expert' },
        { skill: skillMap['docker']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['spanish']._id },
      ],
      availability: [
        { weekday: 3, startMin: 1080, endMin: 1260 },
      ],
    });

    // 12. Maya Lin (Illustration & Procreate)
    const maya = await User.create({
      name: 'Maya Lin',
      email: 'maya@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Digital artist and illustrator. Working in children books and game art.',
      timezone: 'America/New_York',
      skillsOffered: [
        { skill: skillMap['drawing-illustration']._id, level: 'expert' },
        { skill: skillMap['adobe-photoshop']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['blender-3d']._id },
      ],
      availability: [
        { weekday: 6, startMin: 720, endMin: 1020 },
      ],
    });

    // 13. David Kim (Next.js & TypeScript)
    const david = await User.create({
      name: 'David Kim',
      email: 'david@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Frontend engineer passionate about React SSR, Next.js 15, and TypeScript.',
      timezone: 'Asia/Tokyo',
      skillsOffered: [
        { skill: skillMap['nextjs']._id, level: 'expert' },
        { skill: skillMap['typescript']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['acoustic-guitar']._id },
      ],
      availability: [
        { weekday: 1, startMin: 600, endMin: 840 },
      ],
    });

    // 14. Chloe Bennett (Product Management & Public Speaking)
    const chloe = await User.create({
      name: 'Chloe Bennett',
      email: 'chloe@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Senior Product Manager and Toastmasters speaker.',
      timezone: 'America/New_York',
      skillsOffered: [
        { skill: skillMap['product-management']._id, level: 'expert' },
        { skill: skillMap['public-speaking']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['financial-modeling-excel']._id },
      ],
      availability: [
        { weekday: 5, startMin: 720, endMin: 900 },
      ],
    });

    // 15. Rohan Gupta (C++ & Algorithms)
    const rohan = await User.create({
      name: 'Rohan Gupta',
      email: 'rohan@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Competitive programmer and C++ enthusiast. Preparing for ICPC.',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['cpp']._id, level: 'expert' },
        { skill: skillMap['data-structures-algorithms']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['machine-learning']._id },
      ],
      availability: [
        { weekday: 0, startMin: 900, endMin: 1140 },
      ],
    });

    // 16. Nina Rossi (Italian & Photography)
    const nina = await User.create({
      name: 'Nina Rossi',
      email: 'nina@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Photographer and native Italian tutor from Rome.',
      timezone: 'Europe/Berlin',
      skillsOffered: [
        { skill: skillMap['italian']._id, level: 'expert' },
        { skill: skillMap['digital-photography']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['adobe-photoshop']._id },
      ],
      availability: [
        { weekday: 3, startMin: 840, endMin: 1080 },
      ],
    });

    // 17. Arjun Mehta (Blender 3D & Video Editing)
    const arjun = await User.create({
      name: 'Arjun Mehta',
      email: 'arjun@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: '3D motion designer and video editor. Teaching Blender fundamentals.',
      timezone: 'Asia/Kolkata',
      skillsOffered: [
        { skill: skillMap['blender-3d']._id, level: 'expert' },
        { skill: skillMap['video-editing']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['drawing-illustration']._id },
      ],
      availability: [
        { weekday: 6, startMin: 600, endMin: 840 },
      ],
    });

    // 18. Lucas Silva (Linux & Docker)
    const lucas = await User.create({
      name: 'Lucas Silva',
      email: 'lucas@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Sysadmin and Linux enthusiast. Bash scripting wizard.',
      timezone: 'UTC',
      skillsOffered: [
        { skill: skillMap['linux-administration']._id, level: 'expert' },
        { skill: skillMap['docker']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['rust']._id },
      ],
      availability: [
        { weekday: 2, startMin: 600, endMin: 900 },
      ],
    });

    // 19. Emily Watson (Financial Modeling & Excel)
    const emily = await User.create({
      name: 'Emily Watson',
      email: 'emily@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Investment analyst teaching financial models and advanced Excel.',
      timezone: 'Europe/London',
      skillsOffered: [
        { skill: skillMap['financial-modeling-excel']._id, level: 'expert' },
        { skill: skillMap['german']._id, level: 'intermediate' },
      ],
      skillsWanted: [
        { skill: skillMap['public-speaking']._id },
      ],
      availability: [
        { weekday: 5, startMin: 720, endMin: 960 },
      ],
    });

    // 20. Tariq Al-Mansoor (ML & Rust)
    const tariq = await User.create({
      name: 'Tariq Al-Mansoor',
      email: 'tariq@skillswap.dev',
      passwordHash: defaultPasswordHash,
      bio: 'Building high-performance ML inference kernels in Rust.',
      timezone: 'Asia/Singapore',
      skillsOffered: [
        { skill: skillMap['rust']._id, level: 'expert' },
        { skill: skillMap['machine-learning']._id, level: 'expert' },
      ],
      skillsWanted: [
        { skill: skillMap['go-golang']._id },
      ],
      availability: [
        { weekday: 4, startMin: 840, endMin: 1080 },
      ],
    });

    console.log('🌱 Seeding completed sessions with verified reviews...');

    // Completed Session 1: Demo (taught React) <-> Priya (taught UI/UX)
    const completedSession1 = await Session.create({
      proposer: priya._id,
      partner: demoUser._id,
      start: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      end: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 60 * 60 * 1000),
      topics: {
        proposerTeaches: skillMap['ui-ux-design']._id,
        partnerTeaches: skillMap['react']._id,
      },
      status: 'completed',
      completion: { proposer: true, partner: true },
      history: [
        { status: 'proposed', by: priya._id, at: new Date(Date.now() - 8 * 24 * 3600 * 1000) },
        { status: 'accepted', by: demoUser._id, at: new Date(Date.now() - 8 * 24 * 3600 * 1000 + 3600 * 1000) },
        { status: 'completed', by: demoUser._id, at: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 7200 * 1000) },
      ],
    });

    // Reviews for Session 1
    await Review.create({
      session: completedSession1._id,
      reviewer: priya._id,
      reviewee: demoUser._id,
      rating: 5,
      comment: 'Alex was extraordinary! Explained React component architecture with crystal clarity. Highly recommended partner!',
    });

    await Review.create({
      session: completedSession1._id,
      reviewer: demoUser._id,
      reviewee: priya._id,
      rating: 5,
      comment: 'Priya gave incredible actionable Figma feedback on my design system. Super patient teacher!',
    });

    // Completed Session 2: Hiroshi <-> Elena
    const completedSession2 = await Session.create({
      proposer: hiroshi._id,
      partner: elena._id,
      start: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      end: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 90 * 60 * 1000),
      topics: {
        proposerTeaches: skillMap['japanese']._id,
        partnerTeaches: skillMap['machine-learning']._id,
      },
      status: 'completed',
      completion: { proposer: true, partner: true },
      history: [
        { status: 'proposed', by: hiroshi._id, at: new Date(Date.now() - 4 * 24 * 3600 * 1000) },
        { status: 'accepted', by: elena._id, at: new Date(Date.now() - 4 * 24 * 3600 * 1000 + 1800 * 1000) },
        { status: 'completed', by: hiroshi._id, at: new Date(Date.now() - 3 * 24 * 3600 * 1000 + 7200 * 1000) },
      ],
    });

    await Review.create({
      session: completedSession2._id,
      reviewer: elena._id,
      reviewee: hiroshi._id,
      rating: 5,
      comment: 'Arigato gozaimasu! Excellent conversational practice.',
    });

    await Review.create({
      session: completedSession2._id,
      reviewer: hiroshi._id,
      reviewee: elena._id,
      rating: 5,
      comment: 'Elena made transformer neural networks feel intuitive and simple.',
    });

    // Update Bayesian reputation for reviewed users
    await updateUserReputation(demoUser._id);
    await updateUserReputation(priya._id);
    await updateUserReputation(hiroshi._id);
    await updateUserReputation(elena._id);

    console.log('🌱 Seeding pending & upcoming sessions for Demo account...');

    // Pending incoming proposal for Demo: Maria wants to learn Python on upcoming Wednesday
    const nextWed = new Date();
    nextWed.setDate(nextWed.getDate() + ((3 - nextWed.getDay() + 7) % 7 || 7));
    nextWed.setHours(19, 0, 0, 0);

    const pendingIncoming = await Session.create({
      proposer: maria._id,
      partner: demoUser._id,
      start: nextWed,
      end: new Date(nextWed.getTime() + 60 * 60 * 1000),
      topics: {
        proposerTeaches: skillMap['spanish']._id,
        partnerTeaches: skillMap['python']._id,
      },
      status: 'proposed',
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      history: [
        {
          status: 'proposed',
          by: maria._id,
          at: new Date(),
          note: 'Proposed session for Spanish <-> Python exchange',
        },
      ],
    });

    // Upcoming accepted session for Demo with Viktor: Saturday
    const nextSat = new Date();
    nextSat.setDate(nextSat.getDate() + ((6 - nextSat.getDay() + 7) % 7 || 7));
    nextSat.setHours(11, 0, 0, 0);

    await Session.create({
      proposer: demoUser._id,
      partner: viktor._id,
      start: nextSat,
      end: new Date(nextSat.getTime() + 60 * 60 * 1000),
      topics: {
        proposerTeaches: skillMap['acoustic-guitar']._id,
        partnerTeaches: skillMap['chess-strategy']._id,
      },
      status: 'accepted',
      history: [
        { status: 'proposed', by: demoUser._id, at: new Date(Date.now() - 3600 * 1000) },
        { status: 'accepted', by: viktor._id, at: new Date(Date.now() - 1800 * 1000), note: 'Accepted by Viktor' },
      ],
    });

    console.log('🌱 Seeding active conversation & real-time chat messages...');

    // Conversation Demo <-> Maria
    const convKeyDemoMaria = Conversation.generateParticipantKey(demoUser._id, maria._id);
    const convDemoMaria = await Conversation.create({
      participants: [demoUser._id, maria._id],
      participantKey: convKeyDemoMaria,
      lastMessage: {
        text: '¡Hola Alex! I saw your proposed session on Wednesday. Looking forward to our exchange!',
        sender: maria._id,
        createdAt: new Date(),
      },
      lastMessageAt: new Date(),
    });

    await Message.create({
      conversation: convDemoMaria._id,
      sender: demoUser._id,
      text: 'Hi Maria! I would love to learn conversational Spanish, and I can teach you all about Python functions and data science.',
      createdAt: new Date(Date.now() - 3600 * 1000),
      readBy: [demoUser._id, maria._id],
    });

    await Message.create({
      conversation: convDemoMaria._id,
      sender: maria._id,
      text: '¡Hola Alex! I saw your proposed session on Wednesday. Looking forward to our exchange!',
      createdAt: new Date(),
      readBy: [maria._id],
    });

    // Notifications for Demo User
    await Notification.create({
      recipient: demoUser._id,
      type: 'session_proposed',
      title: 'New Session Proposal Received',
      message: 'Maria Rodriguez proposed a session with you on Wednesday at 19:00.',
      data: { sessionId: pendingIncoming._id },
    });

    await Notification.create({
      recipient: demoUser._id,
      type: 'new_review',
      title: 'New 5-Star Review Received',
      message: 'Priya Sharma gave you a 5-star review: "Alex was extraordinary!"',
      data: { sessionId: completedSession1._id },
    });

    console.log('✅ SkillSwap database seeded successfully!');
    console.log('───────────────────────────────────────────────────────');
    console.log('👤 DEMO ACCOUNT CREDENTIALS:');
    console.log('   Email:    demo@skillswap.dev');
    console.log('   Password: Password123!');
    console.log('───────────────────────────────────────────────────────');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedDatabase().then(() => {
    process.exit(0);
  });
}

module.exports = seedDatabase;
