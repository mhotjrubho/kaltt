const path = require('path');
const fs = require('fs');

const APP_BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(APP_BASE_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function listAnnouncementsForCurrentYear() {
  const s = loadState();
  const year = getCurrentYear();
  return (s.announcements || [])
    .filter((a) => a.year_id === year.id)
    .sort((a, b) => b.id - a.id);
}

function listActiveAnnouncementsNow() {
  const s = loadState();
  const year = getCurrentYear();
  const now = Date.now();
  return (s.announcements || [])
    .filter((a) => a.year_id === year.id)
    .filter((a) => !a.expires_at || Date.parse(a.expires_at) > now)
    .sort((a, b) => b.id - a.id);
}

function createAnnouncementForCurrentYear({ type, title, text, signature, expiresAtIso, payload }) {
  const s = loadState();
  const year = getCurrentYear();
  const id = s.nextAnnouncementId || 1;
  s.nextAnnouncementId = id + 1;

  const announcement = {
    id,
    type,
    title: title || '',
    text: text || '',
    signature: signature || '',
    created_at: new Date().toISOString(),
    expires_at: expiresAtIso || null,
    payload: payload || {},
    year_id: year.id,
  };

  s.announcements = s.announcements || [];
  s.announcements.push(announcement);
  saveState();
  return announcement;
}

function deleteAnnouncement(id) {
  const s = loadState();
  s.announcements = (s.announcements || []).filter((a) => a.id !== id);
  saveState();
}

function listCollectionDaysForCurrentYear() {
  const s = loadState();
  const year = getCurrentYear();
  return (s.collection_days || [])
    .filter((d) => d.year_id === year.id)
    .sort((a, b) => a.id - b.id);
}

function createCollectionDayForCurrentYear({ name }) {
  const s = loadState();
  const year = getCurrentYear();
  const id = s.nextCollectionDayId || 1;
  s.nextCollectionDayId = id + 1;
  s.collection_days = s.collection_days || [];
  s.collection_days.push({ id, name, year_id: year.id });
  saveState();
  return { id, name, year_id: year.id };
}

function updateCollectionDay({ id, name }) {
  const s = loadState();
  s.collection_days = s.collection_days || [];
  const day = s.collection_days.find((d) => d.id === id);
  if (!day) {
    throw new Error('יום איסוף לא נמצא לעדכון');
  }
  day.name = name;
  saveState();
  return day;
}

function deleteCollectionDay(id) {
  const s = loadState();
  s.collection_days = (s.collection_days || []).filter((d) => d.id !== id);
  s.collections = (s.collections || []).filter((c) => c.day_id !== id);
  saveState();
}

function setCollectionAmount({ personId, dayId, amount }) {
  const s = loadState();
  s.collections = s.collections || [];
  const normalized = Number(amount || 0);
  const idx = s.collections.findIndex((c) => c.person_id === personId && c.day_id === dayId);

  if (!normalized || normalized <= 0) {
    if (idx >= 0) {
      s.collections.splice(idx, 1);
      saveState();
    }
    return;
  }

  if (idx >= 0) {
    s.collections[idx].amount = normalized;
  } else {
    s.collections.push({ person_id: personId, day_id: dayId, amount: normalized });
  }
  saveState();
}

function listCollectionsForCurrentYear() {
  const s = loadState();
  const days = listCollectionDaysForCurrentYear();
  const dayIds = new Set(days.map((d) => d.id));
  return (s.collections || []).filter((c) => dayIds.has(c.day_id));
}

function getLatestTargetByPersonForCurrentYear() {
  const s = loadState();
  const year = getCurrentYear();
  const map = new Map();
  const relevant = (s.commitments || [])
    .filter((c) => c.year_id === year.id)
    .sort((a, b) => a.id - b.id);

  relevant.forEach((c) => {
    map.set(c.person_id, c.target);
  });

  return map;
}

const DB_PATH = path.join(DATA_DIR, 'db.json');

let state = null;

function loadState() {
  if (state) return state;
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      state = JSON.parse(raw);
    } catch (e) {
      state = null;
    }
  }

  if (!state) {
    const currentYearLabel = new Date().getFullYear().toString();
    state = {
      years: [
        {
          id: 1,
          label: currentYearLabel,
          is_current: 1,
        },
      ],
      groups: [
        { id: 'default-1', name: 'קבוצת דוגמה א', logo_path: null, year_id: 1 },
        { id: 'default-2', name: 'קבוצת דוגמה ב', logo_path: null, year_id: 1 },
      ],
      persons: [],
      commitments: [],
      collection_days: [],
      collections: [],
      announcements: [],
      nextCommitmentId: 1,
      nextCollectionDayId: 1,
      nextAnnouncementId: 1,
      nextYearId: 2,
    };
    saveState();
  }

  return state;
}

function saveState() {
  if (!state) return;
  fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function getCurrentYear() {
  const s = loadState();
  const year = s.years.find((y) => y.is_current === 1) || s.years[0];
  return year;
}

function listGroupsForCurrentYear() {
  const s = loadState();
  const year = getCurrentYear();
  return s.groups
    .filter((g) => g.year_id === year.id)
    .sort((a, b) => a.name.localeCompare(b.name, 'he-IL'));
}

function createGroupForCurrentYear({ id, name, logoPath = null }) {
  const s = loadState();
  const year = getCurrentYear();
  const exists = s.groups.find((g) => g.id === id && g.year_id === year.id);
  if (exists) {
    throw new Error('קבוצה עם מזהה זה כבר קיימת בשנה הנוכחית');
  }
  s.groups.push({ id, name, logo_path: logoPath, year_id: year.id });
  saveState();
}

function updateGroup({ id, name, logoPath = null }) {
  const s = loadState();
  const g = s.groups.find((gr) => gr.id === id);
  if (!g) {
    throw new Error('קבוצה לא נמצאה לעדכון');
  }
  g.name = name;
  g.logo_path = logoPath;
  saveState();
}

function deleteGroup(id) {
  const s = loadState();
  s.groups = s.groups.filter((g) => g.id !== id);
  // לא מוחקים commitments/persons כאן, אפשר להרחיב בהמשך לפי לוגיקה עסקית
  saveState();
}

function listRecentCommitments(limit = 50) {
  const s = loadState();
  const year = getCurrentYear();
  const filtered = s.commitments
    .filter((c) => c.year_id === year.id)
    .sort((a, b) => b.id - a.id)
    .slice(0, limit);

  return filtered.map((c) => {
    const person = s.persons.find((p) => p.id === c.person_id);
    const group = s.groups.find((g) => g.id === c.group_id);
    return {
      id: c.id,
      person_id: c.person_id,
      group_id: c.group_id,
      target: c.target,
      is_premium: c.is_premium ? 1 : 0,
      created_at: c.created_at,
      name: person ? person.full_name : '',
      group_name: group ? group.name : '',
    };
  });
}

function listPersons(limit = 500) {
  const s = loadState();
  const persons = [...s.persons].sort((a, b) => a.full_name.localeCompare(b.full_name, 'he-IL'));
  return persons.slice(0, limit);
}

function upsertPerson({ id, fullName, groupId = null, isPremium = false }) {
  const s = loadState();
  let person = s.persons.find((p) => p.id === id);
  if (!person) {
    person = {
      id,
      full_name: fullName,
      group_id: groupId,
      is_premium: isPremium ? 1 : 0,
    };
    s.persons.push(person);
  } else {
    person.full_name = fullName;
    person.group_id = groupId;
    person.is_premium = isPremium ? 1 : 0;
  }
  saveState();
  return person;
}

function deletePerson(id) {
  const s = loadState();
  s.persons = s.persons.filter((p) => p.id !== id);
  // משאירים התחייבויות היסטוריות, ניתן להרחיב בהמשך
  saveState();
}

function findPersonById(id) {
  const s = loadState();
  return s.persons.find((p) => p.id === id) || null;
}

function searchPersons(query, limit = 50) {
  const s = loadState();
  const q = (query || '').trim();
  if (!q) return [];
  const isIdSearch = /^\d+$/.test(q);
  let arr = s.persons;
  if (isIdSearch) {
    arr = arr.filter((p) => p.id.startsWith(q));
  } else {
    const lower = q.toLowerCase();
    arr = arr.filter((p) => p.full_name.toLowerCase().includes(lower));
  }
  arr = arr
    .sort((a, b) => a.full_name.localeCompare(b.full_name, 'he-IL'))
    .slice(0, limit);
  return arr;
}

function addCommitment({ personId, fullName, groupId, target, isPremium }) {
  const s = loadState();
  const year = getCurrentYear();
  const nowIso = new Date().toISOString();

  const group = s.groups.find((g) => g.id === groupId && g.year_id === year.id);
  if (!group) {
    throw new Error('קבוצה לא נמצאה במסד הנתונים המקומי');
  }

  let person = s.persons.find((p) => p.id === personId);
  if (!person) {
    person = {
      id: personId,
      full_name: fullName,
      group_id: groupId,
      is_premium: isPremium ? 1 : 0,
    };
    s.persons.push(person);
  } else {
    person.full_name = fullName;
    person.group_id = groupId;
    person.is_premium = isPremium ? 1 : 0;
  }

  const id = s.nextCommitmentId || 1;
  s.nextCommitmentId = id + 1;

  const commitment = {
    id,
    person_id: personId,
    group_id: groupId,
    target,
    is_premium: isPremium ? 1 : 0,
    created_at: nowIso,
    year_id: year.id,
  };

  s.commitments.push(commitment);
  saveState();

  return {
    id,
    personId,
    fullName,
    groupId,
    groupName: group.name,
    target,
    isPremium,
    createdAt: nowIso,
  };
}

module.exports = {
  getCurrentYear,
  listGroupsForCurrentYear,
  listRecentCommitments,
  createGroupForCurrentYear,
  updateGroup,
  deleteGroup,
   listPersons,
   upsertPerson,
   deletePerson,
   findPersonById,
   searchPersons,
  listCollectionDaysForCurrentYear,
  createCollectionDayForCurrentYear,
  updateCollectionDay,
  deleteCollectionDay,
  setCollectionAmount,
  listCollectionsForCurrentYear,
  getLatestTargetByPersonForCurrentYear,
  listAnnouncementsForCurrentYear,
  listActiveAnnouncementsNow,
  createAnnouncementForCurrentYear,
  deleteAnnouncement,
  addCommitment,
};
