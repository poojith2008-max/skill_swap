const Skill = require('../models/Skill');

// Generate URL/lookup slug from string
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^\w\s-]/g, '') // remove invalid chars
    .replace(/[\s_-]+/g, '-') // collapse whitespace and replace by -
    .replace(/^-+|-+$/g, ''); // trim - from ends
};

/**
 * Resolves a skill from input string or ObjectId.
 * Normalizes (lowercase, trim) and matches by slug or alias.
 * If nothing matches, creates a new Skill.
 */
const resolveSkill = async (input) => {
  if (!input) return null;

  // If already an ObjectId or Mongoose document
  if (typeof input === 'object' && input._id) {
    return input;
  }

  const raw = String(input).trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const slug = slugify(raw);

  // 1. Search by exact slug or alias match or case-insensitive name
  let skill = await Skill.findOne({
    $or: [
      { slug },
      { aliases: normalized },
      { name: new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    ],
  });

  if (skill) {
    return skill;
  }

  // 2. Not found: create new Skill
  // Format readable name with capital first letters
  const formattedName = raw
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  skill = await Skill.create({
    name: formattedName,
    slug: slug || `skill-${Date.now()}`,
    aliases: [normalized],
  });

  return skill;
};

module.exports = {
  resolveSkill,
  slugify,
};
