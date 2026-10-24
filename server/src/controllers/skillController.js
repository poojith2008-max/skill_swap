const Skill = require('../models/Skill');
const skillsSeedData = require('../seed/skillsData');

const seedSkillsIfEmpty = async () => {
  const count = await Skill.countDocuments();
  if (count === 0) {
    console.log('🌱 Seeding initial skills catalog (~44 skills)...');
    await Skill.insertMany(skillsSeedData);
    console.log('✅ Skills catalog seeded successfully');
  }
};

const getSkills = async (req, res, next) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    let skills;

    if (!q) {
      skills = await Skill.find().sort({ name: 1 }).limit(50);
    } else {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQ, 'i');

      skills = await Skill.find({
        $or: [
          { name: regex },
          { slug: regex },
          { aliases: regex },
        ],
      })
        .sort({ name: 1 })
        .limit(20);
    }

    res.status(200).json({
      skills,
      count: skills.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSkills,
  seedSkillsIfEmpty,
};
