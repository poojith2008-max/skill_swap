import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { updateProfile, updateAvailability } from '../api/users';
import { fetchSkills } from '../api/skills';
import {
  User,
  Clock,
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  Save,
  Globe,
  Search,
  CheckCircle,
} from 'lucide-react';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const COMMON_TIMEZONES = [
  'Asia/Kolkata',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
];

// Helper to convert minutes to HH:MM format
const minutesToTimeStr = (min) => {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

// Helper to convert HH:MM to minutes
const timeStrToMinutes = (str) => {
  if (!str) return 0;
  const [h, m] = str.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
};

export default function ProfileEditor() {
  const { user, updateCurrentUser, refreshUser } = useAuth();
  const toast = useToast();

  const [bio, setBio] = useState(user?.bio || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [skillsOffered, setSkillsOffered] = useState([]);
  const [skillsWanted, setSkillsWanted] = useState([]);
  const [availability, setAvailability] = useState([]);

  // Autocomplete state
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const [skillCatalog, setSkillCatalog] = useState([]);
  const [activeTab, setActiveTab] = useState('skills'); // 'skills' | 'availability' | 'info'
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);

  // New offered skill draft
  const [newOfferedSkill, setNewOfferedSkill] = useState('');
  const [newOfferedLevel, setNewOfferedLevel] = useState('intermediate');

  // New wanted skill draft
  const [newWantedSkill, setNewWantedSkill] = useState('');

  // New availability draft
  const [newDay, setNewDay] = useState(1); // Monday
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('11:00');

  useEffect(() => {
    if (user) {
      setBio(user.bio || '');
      setTimezone(user.timezone || 'Asia/Kolkata');

      // Map offered
      const offered = (user.skillsOffered || []).map((o) => ({
        id: o.skill?._id || o.skill,
        name: o.skill?.name || 'Skill',
        level: o.level || 'intermediate',
      }));
      setSkillsOffered(offered);

      // Map wanted
      const wanted = (user.skillsWanted || []).map((w) => ({
        id: w.skill?._id || w.skill,
        name: w.skill?.name || 'Skill',
      }));
      setSkillsWanted(wanted);

      setAvailability(user.availability || []);
    }
  }, [user]);

  // Autocomplete fetch
  useEffect(() => {
    let cancel = false;
    const run = async () => {
      try {
        const skills = await fetchSkills(skillSearchQuery);
        if (!cancel) setSkillCatalog(skills);
      } catch (e) {
        console.error(e);
      }
    };
    const t = setTimeout(run, 200);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [skillSearchQuery]);

  const handleAddOffered = (skillName) => {
    const nameToAdd = skillName || newOfferedSkill.trim();
    if (!nameToAdd) return;

    if (skillsOffered.some((s) => s.name.toLowerCase() === nameToAdd.toLowerCase())) {
      toast.info('You already listed this offered skill');
      return;
    }

    setSkillsOffered([...skillsOffered, { name: nameToAdd, level: newOfferedLevel }]);
    setNewOfferedSkill('');
  };

  const handleRemoveOffered = (index) => {
    setSkillsOffered(skillsOffered.filter((_, i) => i !== index));
  };

  const handleAddWanted = (skillName) => {
    const nameToAdd = skillName || newWantedSkill.trim();
    if (!nameToAdd) return;

    if (skillsWanted.some((s) => s.name.toLowerCase() === nameToAdd.toLowerCase())) {
      toast.info('You already listed this wanted skill');
      return;
    }

    setSkillsWanted([...skillsWanted, { name: nameToAdd }]);
    setNewWantedSkill('');
  };

  const handleRemoveWanted = (index) => {
    setSkillsWanted(skillsWanted.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    const startMin = timeStrToMinutes(newStartTime);
    const endMin = timeStrToMinutes(newEndTime);

    if (startMin >= endMin) {
      toast.error('Start time must be strictly before end time');
      return;
    }

    setAvailability([
      ...availability,
      {
        weekday: parseInt(newDay, 10),
        startMin,
        endMin,
      },
    ]);
  };

  const handleRemoveSlot = (index) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      const updated = await updateProfile({
        bio,
        timezone,
        skillsOffered: skillsOffered.map((s) => ({ skill: s.name, level: s.level })),
        skillsWanted: skillsWanted.map((s) => ({ skill: s.name })),
      });
      updateCurrentUser(updated);
      toast.success('Profile and skills saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      setSavingAvailability(true);
      const res = await updateAvailability(availability);
      setAvailability(res.availability || []);
      if (user) {
        updateCurrentUser({ ...user, availability: res.availability });
      }
      toast.success('Weekly availability updated & normalized!');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save availability');
    } finally {
      setSavingAvailability(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">
          Profile & Learning Preferences
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Customize the skills you can teach, what you want to learn, and your weekly availability.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-8">
        {[
          { id: 'skills', label: 'Skills Exchange', icon: Sparkles },
          { id: 'availability', label: 'Weekly Availability', icon: Clock },
          { id: 'info', label: 'Bio & Timezone', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: SKILLS */}
      {activeTab === 'skills' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Skills Offered */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-400" />
                  Skills You Offer (What You Can Teach)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select the level of proficiency you have in each skill.
                </p>
              </div>
            </div>

            {/* Existing tags */}
            <div className="flex flex-wrap gap-2.5 mb-6 min-h-[44px] p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
              {skillsOffered.length === 0 ? (
                <span className="text-xs text-slate-500 italic">
                  No offered skills yet. Add your first skill below!
                </span>
              ) : (
                skillsOffered.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs font-medium"
                  >
                    <span>{skill.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] uppercase font-bold text-indigo-300">
                      {skill.level}
                    </span>
                    <button
                      onClick={() => handleRemoveOffered(index)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add new offered skill */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Add a Skill You Offer
                </label>
                <input
                  type="text"
                  value={newOfferedSkill}
                  onChange={(e) => {
                    setNewOfferedSkill(e.target.value);
                    setSkillSearchQuery(e.target.value);
                  }}
                  placeholder="e.g. Acoustic Guitar, Python, Spanish..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Proficiency Level
                </label>
                <select
                  value={newOfferedLevel}
                  onChange={(e) => setNewOfferedLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-sm text-slate-100 outline-none cursor-pointer"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="expert">Expert</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => handleAddOffered()}
                  className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Autocomplete suggestions preview */}
            {newOfferedSkill && skillCatalog.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500 self-center">Suggestions:</span>
                {skillCatalog.slice(0, 6).map((catSkill) => (
                  <button
                    key={catSkill._id}
                    onClick={() => handleAddOffered(catSkill.name)}
                    className="px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-indigo-900/60 text-slate-300 hover:text-indigo-200 border border-slate-700 transition-colors"
                  >
                    + {catSkill.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Skills Wanted */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  Skills You Want to Learn
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Our mutual-match engine pairs you with users who offer these exact topics.
                </p>
              </div>
            </div>

            {/* Existing wanted tags */}
            <div className="flex flex-wrap gap-2.5 mb-6 min-h-[44px] p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
              {skillsWanted.length === 0 ? (
                <span className="text-xs text-slate-500 italic">
                  No learning goals listed. Add skills you wish to learn!
                </span>
              ) : (
                skillsWanted.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-950/60 border border-violet-500/30 text-violet-200 text-xs font-medium"
                  >
                    <span>{skill.name}</span>
                    <button
                      onClick={() => handleRemoveWanted(index)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add new wanted skill */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-10">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Add a Skill You Want to Learn
                </label>
                <input
                  type="text"
                  value={newWantedSkill}
                  onChange={(e) => {
                    setNewWantedSkill(e.target.value);
                    setSkillSearchQuery(e.target.value);
                  }}
                  placeholder="e.g. Docker, Piano, UI/UX Design..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-violet-500 text-sm text-slate-100 placeholder:text-slate-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => handleAddWanted()}
                  className="w-full py-2.5 rounded-xl font-semibold bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {newWantedSkill && skillCatalog.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-slate-500 self-center">Suggestions:</span>
                {skillCatalog.slice(0, 6).map((catSkill) => (
                  <button
                    key={catSkill._id}
                    onClick={() => handleAddWanted(catSkill.name)}
                    className="px-2.5 py-1 rounded-md text-xs bg-slate-800 hover:bg-violet-900/60 text-slate-300 hover:text-violet-200 border border-slate-700 transition-colors"
                  >
                    + {catSkill.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving Changes...' : 'Save Skills & Profile'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: WEEKLY AVAILABILITY EDITOR */}
      {activeTab === 'availability' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  Weekly Recurring Time Slots
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set the hours you are free to swap sessions. Adjacent and overlapping slots on the
                  same day are automatically merged on save.
                </p>
              </div>
            </div>

            {/* Current schedule display by weekday */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {WEEKDAYS.map((dayName, dayIndex) => {
                const daySlots = availability.filter((s) => s.weekday === dayIndex);
                return (
                  <div
                    key={dayName}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-xs text-slate-200">{dayName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-1.5 min-h-[30px]">
                      {daySlots.length === 0 ? (
                        <span className="text-[11px] text-slate-600 italic">No free slots</span>
                      ) : (
                        daySlots.map((slot, sIdx) => {
                          const originalIdx = availability.findIndex((item) => item === slot);
                          return (
                            <div
                              key={sIdx}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20 text-xs font-mono text-indigo-300"
                            >
                              <span>
                                {minutesToTimeStr(slot.startMin)} - {minutesToTimeStr(slot.endMin)}
                              </span>
                              <button
                                onClick={() => handleRemoveSlot(originalIdx)}
                                className="text-slate-500 hover:text-rose-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add time slot builder */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <h4 className="text-xs font-bold text-slate-200 mb-3 uppercase tracking-wider">
                Add Time Interval
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-xs text-slate-400 mb-1">Weekday</label>
                  <select
                    value={newDay}
                    onChange={(e) => setNewDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 outline-none"
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs text-slate-400 mb-1">End Time</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <button
                    onClick={handleAddSlot}
                    className="w-full py-2 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Range
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveAvailability}
              disabled={savingAvailability}
              className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingAvailability ? 'Normalizing & Saving...' : 'Save Weekly Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: BIO & TIMEZONE */}
      {activeTab === 'info' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm space-y-6 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Primary Timezone
            </label>
            <div className="relative max-w-md">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 outline-none cursor-pointer"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Your availability is automatically aligned with partners around the world using this timezone.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Personal Bio
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell partners about your background, projects you're working on, or learning goals..."
              maxLength={500}
              className="w-full p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
            <div className="flex justify-between text-[11px] text-slate-500 mt-1">
              <span>Markdown supported</span>
              <span>{bio.length}/500</span>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving...' : 'Save Profile Info'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
