const toastContainer = document.getElementById('toast-container');
const commitmentsTableBody = document.querySelector('#table-commitments tbody');
const groupsTableBody = document.querySelector('#table-groups tbody');
const personsTableBody = document.querySelector('#table-persons tbody');

const collectDaysTableBody = document.querySelector('#table-collect-days tbody');
const collectionsTable = document.getElementById('table-collections');
const collectionsThead = document.querySelector('#table-collections thead');
const collectionsTbody = document.querySelector('#table-collections tbody');

let groups = [];
let commitments = [];
let persons = [];

let collectionDays = [];
let collections = [];
let targets = {};
let editingCollectDayId = null;

let announcements = [];
const announcementsTableBody = document.querySelector('#table-announcements tbody');

function initRtlAndDates() {
  document.documentElement.dir = 'rtl';
  document.body.style.direction = 'rtl';
  const now = new Date();
  const hebrewDateLabel = document.getElementById('hebrew-date-label');
  const yearLabel = document.getElementById('current-year-label');

  const gregYear = now.getFullYear();
  yearLabel.textContent = `שנת קמפיין ${gregYear}`;
  hebrewDateLabel.textContent = now.toLocaleDateString('he-IL-u-ca-hebrew', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function renderAnnouncementsTable() {
  if (!announcementsTableBody) return;
  announcementsTableBody.innerHTML = '';
  announcements.forEach((a) => {
    const expires = a.expires_at ? new Date(a.expires_at).toLocaleString('he-IL') : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.type}</td>
      <td>${a.title || ''}</td>
      <td>${a.text || ''}</td>
      <td>${expires}</td>
      <td>
        <button data-action="delete-ann" data-ann-id="${a.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;background:linear-gradient(to left,#ef4444,#f97316);box-shadow:none;">מחיקה</button>
      </td>
    `;
    announcementsTableBody.appendChild(tr);
  });
}

function renderAnnouncementPreview() {
  const typeEl = document.getElementById('ann-type');
  const titleEl = document.getElementById('ann-title');
  const textEl = document.getElementById('ann-text');
  const sigEl = document.getElementById('ann-signature');
  const preview = document.getElementById('ann-preview');
  if (!typeEl || !titleEl || !textEl || !sigEl || !preview) return;

  const type = typeEl.value;
  const title = (titleEl.value || '').trim();
  const text = (textEl.value || '').trim();
  const sig = (sigEl.value || '').trim();

  if (type === 'ticker') {
    preview.textContent = [title, text, sig].filter(Boolean).join(' – ') || 'טקסט הטיקר יופיע כאן...';
    return;
  }

  if (type === 'push') {
    preview.innerHTML = `
      <div style="font-weight:800;">הודעת דחיפה</div>
      <div style="margin-top:4px;">${[title, text].filter(Boolean).join(' – ') || '...'}</div>
    `;
    return;
  }

  preview.innerHTML = `
    <div style="border-radius:20px;border:1px solid rgba(148,163,184,0.35);background:radial-gradient(circle at top left, rgba(244,63,94,0.18), rgba(15,23,42,0.96));padding:12px 16px;">
      ${title ? `<div style=\"font-weight:800;font-size:1.05rem;\">${title}</div>` : ''}
      ${text ? `<div style=\"margin-top:4px;font-size:0.95rem;\">${text}</div>` : ''}
      ${sig ? `<div style=\"margin-top:6px;color:#cbd5e1;font-size:0.85rem;\">${sig}</div>` : ''}
    </div>
  `;
}

function initAnnouncementsUi() {
  const btn = document.getElementById('btn-create-ann');
  const typeEl = document.getElementById('ann-type');
  const titleEl = document.getElementById('ann-title');
  const textEl = document.getElementById('ann-text');
  const sigEl = document.getElementById('ann-signature');
  const ttlEl = document.getElementById('ann-ttl');

  [typeEl, titleEl, textEl, sigEl, ttlEl].forEach((el) => {
    el?.addEventListener('input', renderAnnouncementPreview);
    el?.addEventListener('change', renderAnnouncementPreview);
  });

  btn?.addEventListener('click', async () => {
    if (!window.kaltApi || typeof window.kaltApi.createAnnouncement !== 'function') {
      showToast('שגיאה: ניהול הודעות לא זמין.', 0);
      return;
    }
    const type = typeEl.value;
    const title = (titleEl.value || '').trim();
    const text = (textEl.value || '').trim();
    const signature = (sigEl.value || '').trim();
    const ttlMinutes = Number(ttlEl.value || 0);
    const expiresAtIso = ttlMinutes > 0 ? new Date(Date.now() + ttlMinutes * 60_000).toISOString() : null;

    const res = await window.kaltApi.createAnnouncement({ type, title, text, signature, expiresAtIso });
    if (!res.ok) {
      showToast(`שגיאה בפרסום הודעה: ${res.error || ''}`, 0);
      return;
    }
    announcements = res.announcements || announcements;
    renderAnnouncementsTable();
    renderAnnouncementPreview();
    showToast('ההודעה פורסמה.', 0);
  });

  announcementsTableBody?.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const idRaw = target.getAttribute('data-ann-id');
    if (action !== 'delete-ann' || !idRaw) return;
    const id = Number(idRaw);
    if (!window.kaltApi || typeof window.kaltApi.deleteAnnouncement !== 'function') return;
    const res = await window.kaltApi.deleteAnnouncement({ id });
    if (!res.ok) {
      showToast(`שגיאה במחיקת הודעה: ${res.error || ''}`, 0);
      return;
    }
    announcements = res.announcements || [];
    renderAnnouncementsTable();
    showToast('ההודעה נמחקה.', 0);
  });

  renderAnnouncementPreview();
}

function renderPersonsTable(list) {
  if (!personsTableBody) return;
  personsTableBody.innerHTML = '';

  (list || persons).forEach((p) => {
    const group = groups.find((g) => g.id === p.group_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.full_name}</td>
      <td>${group ? group.name : ''}</td>
      <td>${p.is_premium ? '<span class="badge-premium">פרימיום</span>' : ''}</td>
      <td>
        <button data-action="edit-person" data-person-id="${p.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;">עריכה</button>
        <button data-action="delete-person" data-person-id="${p.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;background:linear-gradient(to left,#ef4444,#f97316);box-shadow:none;">מחיקה</button>
      </td>
    `;
    personsTableBody.appendChild(tr);
  });
}

function initPersonsUi() {
  const saveBtn = document.getElementById('btn-save-person');
  const idInput = document.getElementById('person-id');
  const nameInput = document.getElementById('person-name');
  const groupSelect = document.getElementById('person-group');
  const premiumInput = document.getElementById('person-premium');
  const searchInput = document.getElementById('person-search');

  if (groupSelect) {
    groupSelect.innerHTML = '';
    groups.forEach((g) => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = g.name;
      groupSelect.appendChild(opt);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const id = (idInput.value || '').trim();
      const fullName = (nameInput.value || '').trim();
      const groupId = groupSelect ? groupSelect.value : null;
      const isPremium = premiumInput ? premiumInput.checked : false;

      if (!id || !fullName) {
        showToast('יש למלא ת.ז ושם מלא לפני שמירה.', 0);
        return;
      }

      if (!window.kaltApi || typeof window.kaltApi.upsertPerson !== 'function') {
        showToast('שגיאה: חיבור למאגר בחורים לא זמין.', 0);
        return;
      }

      const res = await window.kaltApi.upsertPerson({ id, fullName, groupId, isPremium });
      if (!res.ok) {
        showToast(`שגיאה בשמירת בחור: ${res.error || ''}`, 0);
        return;
      }

      persons = res.persons || persons;
      renderPersonsTable();
      showToast('הבחור נשמר בהצלחה במאגר.', 0);

      idInput.value = '';
      nameInput.value = '';
      if (premiumInput) premiumInput.checked = false;

      // רענון טבלת איסוף (כי יכול להשתנות שם/קבוצה)
      renderCollectionsGrid();
    });
  }

  if (personsTableBody) {
    personsTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      const personId = target.getAttribute('data-person-id');
      if (!action || !personId) return;

      if (action === 'edit-person') {
        const p = persons.find((pp) => pp.id === personId);
        if (!p) return;
        idInput.value = p.id;
        nameInput.value = p.full_name;
        if (groupSelect) groupSelect.value = p.group_id || '';
        if (premiumInput) premiumInput.checked = !!p.is_premium;
      }

      if (action === 'delete-person') {
        if (!window.kaltApi || typeof window.kaltApi.deletePerson !== 'function') {
          showToast('שגיאה: מחיקת בחור אינה זמינה.', 0);
          return;
        }
        const res = await window.kaltApi.deletePerson({ id: personId });
        if (!res.ok) {
          showToast(`שגיאה במחיקת בחור: ${res.error || ''}`, 0);
          return;
        }
        persons = res.persons || [];
        renderPersonsTable();
        showToast('הבחור הוסר מהמאגר.', 0);
        renderCollectionsGrid();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      const q = searchInput.value || '';
      if (!q) {
        renderPersonsTable();
        return;
      }
      if (!window.kaltApi || typeof window.kaltApi.searchPersons !== 'function') return;
      const res = await window.kaltApi.searchPersons({ query: q, limit: 200 });
      if (!res.ok) return;
      renderPersonsTable(res.persons || []);
    });
  }
}

function populateGroupsSelect() {
  const select = document.getElementById('input-group');
  select.innerHTML = '';
  groups.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    select.appendChild(opt);
  });
}

function addCommitmentRow(c) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${c.personId}</td>
    <td>${c.fullName}</td>
    <td>${c.groupName}</td>
    <td>${c.target.toLocaleString('he-IL')}</td>
    <td>${c.isPremium ? '<span class="badge-premium">פרימיום</span>' : ''}</td>
  `;
  commitmentsTableBody.prepend(tr);
}

function showToast(message, amount) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div style="font-weight:700;">התקבלה התחייבות חדשה</div>
    <div>${message}</div>
    <div style="font-size:0.8rem;color:#bbf7d0;">סכום ההתחייבות: ${
      amount ? amount.toLocaleString('he-IL') : 0
    } ₪</div>
  `;
  toastContainer.prepend(toast);

  while (toastContainer.children.length > 6) {
    toastContainer.lastElementChild?.remove();
  }

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

async function handleAddCommitment() {
  const idInput = document.getElementById('input-id');
  const nameInput = document.getElementById('input-name');
  const groupSelect = document.getElementById('input-group');
  const targetInput = document.getElementById('input-target');
  const premiumInput = document.getElementById('input-premium');

  const id = idInput.value.trim();
  const name = nameInput.value.trim();
  const groupId = groupSelect.value;
  const target = Number(targetInput.value || '0');
  const premium = premiumInput.checked;

  if (!id || !name || !groupId || !target) {
    showToast('יש למלא את כל השדות החיוניים לפני שמירה.', 0);
    return;
  }

  const group = groups.find((g) => g.id === groupId);

  if (!window.kaltApi || typeof window.kaltApi.addCommitment !== 'function') {
    showToast('שגיאה פנימית: חיבור למסד הנתונים לא זמין.', 0);
    return;
  }

  const res = await window.kaltApi.addCommitment({
    personId: id,
    fullName: name,
    groupId,
    target,
    isPremium: premium,
  });

  if (!res.ok) {
    showToast(`שגיאה בשמירת ההתחייבות: ${res.error || ''}`, 0);
    return;
  }

  const saved = res.commitment;
  const commitment = {
    personId: saved.personId,
    fullName: saved.fullName,
    groupId: saved.groupId,
    groupName: saved.groupName,
    target: saved.target,
    isPremium: saved.isPremium,
    createdAt: saved.createdAt,
  };

  commitments.unshift(commitment);
  addCommitmentRow(commitment);

  // עדכון מיידי של יעד ונתוני בחור לטבלת האיסוף בפועל
  targets[commitment.personId] = commitment.target;
  const existingPerson = persons.find((p) => p.id === commitment.personId);
  if (!existingPerson) {
    persons.push({
      id: commitment.personId,
      full_name: commitment.fullName,
      group_id: commitment.groupId,
      is_premium: commitment.isPremium ? 1 : 0,
    });
  } else {
    existingPerson.full_name = commitment.fullName;
    existingPerson.group_id = commitment.groupId;
    existingPerson.is_premium = commitment.isPremium ? 1 : 0;
  }
  renderCollectionsGrid();

  if (window.kaltApi && typeof window.kaltApi.notifyNewCommitment === 'function') {
    window.kaltApi.notifyNewCommitment({
      id: commitment.personId,
      name: commitment.fullName,
      groupName: commitment.groupName,
      target: commitment.target,
      premium: commitment.isPremium,
    });
  }

  showToast(
    `התחייבות חדשה עבור ${commitment.fullName} בקבוצה ${commitment.groupName}`,
    commitment.target
  );

  idInput.value = '';
  nameInput.value = '';
  targetInput.value = '';
  premiumInput.checked = false;
  idInput.focus();
}

function initEvents() {
  const btnAdd = document.getElementById('btn-add-commitment');
  btnAdd.addEventListener('click', handleAddCommitment);

  document.getElementById('input-target').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleAddCommitment();
    }
  });

  // אוטו-השלמה לפי ת.ז במעמד הזנת התחייבות
  const idInput = document.getElementById('input-id');
  idInput.addEventListener('blur', async () => {
    const id = (idInput.value || '').trim();
    if (!id || !window.kaltApi || typeof window.kaltApi.findPersonById !== 'function') return;
    const res = await window.kaltApi.findPersonById({ id });
    if (!res.ok || !res.person) return;
    const person = res.person;
    const nameInput = document.getElementById('input-name');
    const groupSelect = document.getElementById('input-group');
    if (person.full_name) nameInput.value = person.full_name;
    if (person.group_id && groupSelect) {
      groupSelect.value = person.group_id;
    }
    const premiumInput = document.getElementById('input-premium');
    premiumInput.checked = !!person.is_premium;
  });
}

function renderGroupsTable() {
  if (!groupsTableBody) return;
  groupsTableBody.innerHTML = '';
  groups.forEach((g) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${g.id}</td>
      <td>${g.name}</td>
      <td>
        <button data-action="edit-group" data-group-id="${g.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;">עריכה</button>
        <button data-action="delete-group" data-group-id="${g.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;background:linear-gradient(to left,#ef4444,#f97316);box-shadow:none;">מחיקה</button>
      </td>
    `;
    groupsTableBody.appendChild(tr);
  });
}

function initGroupsUi() {
  const saveBtn = document.getElementById('btn-save-group');
  const idInput = document.getElementById('group-id');
  const nameInput = document.getElementById('group-name');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const id = (idInput.value || '').trim();
      const name = (nameInput.value || '').trim();
      if (!id || !name) {
        showToast('יש למלא מזהה קבוצה ושם קבוצה.', 0);
        return;
      }

      if (!window.kaltApi || typeof window.kaltApi.createGroup !== 'function') {
        showToast('שגיאה: חיבור למסד הנתונים לקבוצות לא זמין.', 0);
        return;
      }

      const exists = groups.some((g) => g.id === id);
      const apiMethod = exists ? 'updateGroup' : 'createGroup';
      const res = await window.kaltApi[apiMethod]({ id, name });
      if (!res.ok) {
        showToast(`שגיאה בשמירת הקבוצה: ${res.error || ''}`, 0);
        return;
      }

      groups = res.groups || [];
      populateGroupsSelect();
      renderGroupsTable();
      showToast('הקבוצה נשמרה בהצלחה.', 0);

      idInput.value = '';
      nameInput.value = '';
    });
  }

  if (groupsTableBody) {
    groupsTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      const groupId = target.getAttribute('data-group-id');
      if (!action || !groupId) return;

      if (action === 'edit-group') {
        const g = groups.find((gr) => gr.id === groupId);
        if (!g) return;
        idInput.value = g.id;
        nameInput.value = g.name;
      } else if (action === 'delete-group') {
        if (!window.kaltApi || typeof window.kaltApi.deleteGroup !== 'function') {
          showToast('שגיאה: חיבור למחיקת קבוצה לא זמין.', 0);
          return;
        }
        const res = await window.kaltApi.deleteGroup({ id: groupId });
        if (!res.ok) {
          showToast(`שגיאה במחיקת קבוצה: ${res.error || ''}`, 0);
          return;
        }
        groups = res.groups || [];
        populateGroupsSelect();
        renderGroupsTable();
        showToast('הקבוצה נמחקה.', 0);
      }
    });
  }
}

function initSidebarNavigation() {
  const navButtons = document.querySelectorAll('.nav-link[data-view]');
  const sections = document.querySelectorAll('[data-view-section]');

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');

      const hasSection = Array.from(sections).some(
        (section) => section.getAttribute('data-view-section') === view
      );
      if (!hasSection) {
        showToast('מסך זה עדיין לא פעיל (בקרוב).', 0);
        return;
      }

      navButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach((section) => {
        const sectionView = section.getAttribute('data-view-section');
        section.style.display = sectionView === view ? '' : 'none';
      });
    });
  });
}

function renderCollectionDaysTable() {
  if (!collectDaysTableBody) return;
  collectDaysTableBody.innerHTML = '';
  collectionDays.forEach((d) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.id}</td>
      <td>${d.name}</td>
      <td>
        <button data-action="edit-collect-day" data-day-id="${d.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;">עריכה</button>
        <button data-action="delete-collect-day" data-day-id="${d.id}" class="button-primary" style="padding:4px 10px;font-size:0.75rem;background:linear-gradient(to left,#ef4444,#f97316);box-shadow:none;">מחיקה</button>
      </td>
    `;
    collectDaysTableBody.appendChild(tr);
  });
}

function collectionsKey(personId, dayId) {
  return `${personId}::${dayId}`;
}

function buildCollectionsMap() {
  const map = new Map();
  (collections || []).forEach((c) => {
    map.set(collectionsKey(c.person_id, c.day_id), Number(c.amount || 0));
  });
  return map;
}

function getPersonGroupName(p) {
  const g = groups.find((gg) => gg.id === p.group_id);
  return g ? g.name : '';
}

function filterPersonsForCollections(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return persons;
  return persons.filter((p) => {
    const groupName = getPersonGroupName(p).toLowerCase();
    return (
      (p.id || '').toLowerCase().includes(q) ||
      (p.full_name || '').toLowerCase().includes(q) ||
      groupName.includes(q)
    );
  });
}

function renderCollectionsHeader() {
  if (!collectionsThead) return;
  const dayHeaders = collectionDays.map((d) => `<th>${d.name}</th>`).join('');
  collectionsThead.innerHTML = `
    <tr>
      <th>ת.ז</th>
      <th>שם</th>
      <th>קבוצה</th>
      <th>יעד</th>
      ${dayHeaders}
      <th>סה"כ אסף</th>
      <th>נשאר</th>
      <th>%</th>
    </tr>
  `;
}

function renderCollectionsGrid(listOverride) {
  if (!collectionsTbody) return;
  renderCollectionsHeader();

  const searchValue = document.getElementById('collect-search')?.value;
  const list = listOverride || filterPersonsForCollections(searchValue);
  const map = buildCollectionsMap();

  collectionsTbody.innerHTML = '';
  list.forEach((p) => {
    const target = Number(targets?.[p.id] || 0);
    let collectedSum = 0;

    const cells = collectionDays
      .map((d) => {
        const val = Number(map.get(collectionsKey(p.id, d.id)) || 0);
        collectedSum += val;
        return `
          <td>
            <input
              class="input"
              style="min-width:110px;max-width:140px;"
              type="number"
              inputmode="numeric"
              min="0"
              step="1"
              data-person-id="${p.id}"
              data-day-id="${d.id}"
              value="${val ? val : ''}"
              placeholder="0"
            />
          </td>
        `;
      })
      .join('');

    const remaining = Math.max(0, target - collectedSum);
    const pct = target > 0 ? Math.min(100, Math.round((collectedSum / target) * 100)) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.full_name}</td>
      <td>${getPersonGroupName(p)}</td>
      <td>${target ? target.toLocaleString('he-IL') : ''}</td>
      ${cells}
      <td>${collectedSum ? collectedSum.toLocaleString('he-IL') : ''}</td>
      <td>${remaining ? remaining.toLocaleString('he-IL') : ''}</td>
      <td>${pct ? pct + '%' : ''}</td>
    `;
    collectionsTbody.appendChild(tr);
  });
}

function initCollectionsUi() {
  const addDayBtn = document.getElementById('btn-add-collect-day');
  const dayNameInput = document.getElementById('collect-day-name');
  const searchInput = document.getElementById('collect-search');

  if (addDayBtn && dayNameInput) {
    addDayBtn.addEventListener('click', async () => {
      const name = (dayNameInput.value || '').trim();
      if (!name) {
        showToast('יש להזין שם ליום האיסוף.', 0);
        return;
      }

      if (!window.kaltApi) return;

      if (editingCollectDayId) {
        if (typeof window.kaltApi.updateCollectionDay !== 'function') return;
        const res = await window.kaltApi.updateCollectionDay({ id: editingCollectDayId, name });
        if (!res.ok) {
          showToast(`שגיאה בעדכון יום: ${res.error || ''}`, 0);
          return;
        }
        collectionDays = res.days || collectionDays;
        editingCollectDayId = null;
        dayNameInput.value = '';
        renderCollectionDaysTable();
        renderCollectionsGrid();
        return;
      }

      if (typeof window.kaltApi.createCollectionDay !== 'function') return;
      const res = await window.kaltApi.createCollectionDay({ name });
      if (!res.ok) {
        showToast(`שגיאה ביצירת יום: ${res.error || ''}`, 0);
        return;
      }
      collectionDays = res.days || collectionDays;
      dayNameInput.value = '';
      renderCollectionDaysTable();
      renderCollectionsGrid();
    });
  }

  if (collectDaysTableBody) {
    collectDaysTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      const dayIdRaw = target.getAttribute('data-day-id');
      if (!action || !dayIdRaw) return;
      const dayId = Number(dayIdRaw);

      if (action === 'edit-collect-day') {
        const day = collectionDays.find((d) => d.id === dayId);
        if (!day || !dayNameInput) return;
        editingCollectDayId = day.id;
        dayNameInput.value = day.name;
        dayNameInput.focus();
        return;
      }

      if (action === 'delete-collect-day') {
        if (!window.kaltApi || typeof window.kaltApi.deleteCollectionDay !== 'function') return;
        const res = await window.kaltApi.deleteCollectionDay({ id: dayId });
        if (!res.ok) {
          showToast(`שגיאה במחיקת יום: ${res.error || ''}`, 0);
          return;
        }
        collectionDays = res.days || [];
        collections = res.collections || [];
        renderCollectionDaysTable();
        renderCollectionsGrid();
      }
    });
  }

  if (collectionsTable) {
    collectionsTable.addEventListener('change', async (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement)) return;
      const personId = el.getAttribute('data-person-id');
      const dayIdRaw = el.getAttribute('data-day-id');
      if (!personId || !dayIdRaw) return;
      const dayId = Number(dayIdRaw);
      const amount = Number(el.value || 0);
      if (!window.kaltApi || typeof window.kaltApi.setCollectionAmount !== 'function') return;

      const res = await window.kaltApi.setCollectionAmount({ personId, dayId, amount });
      if (!res.ok) {
        showToast(`שגיאה בשמירת איסוף: ${res.error || ''}`, 0);
        return;
      }
      collections = res.collections || collections;
      renderCollectionsGrid();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderCollectionsGrid();
    });
  }
}

async function loadInitialData() {
  if (!window.kaltApi || typeof window.kaltApi.loadInitialDashboardData !== 'function') {
    showToast('שגיאה: חיבור למסד הנתונים לא זמין.', 0);
    return;
  }

  const res = await window.kaltApi.loadInitialDashboardData();
  if (!res.ok) {
    showToast(`שגיאה בטעינת נתוני פתיחה: ${res.error || ''}`, 0);
    return;
  }

  const {
    year,
    groups: dbGroups,
    commitments: dbCommitments,
    persons: dbPersons,
    collectionDays: dbCollectionDays,
    collections: dbCollections,
    targets: dbTargets,
    announcements: dbAnnouncements,
  } = res;

  groups = dbGroups || [];
  commitments = [];
  persons = dbPersons || [];
  collectionDays = dbCollectionDays || [];
  collections = dbCollections || [];
  targets = dbTargets || {};
  announcements = dbAnnouncements || [];

  populateGroupsSelect();
  renderGroupsTable();
  renderPersonsTable();
  renderCollectionDaysTable();
  renderCollectionsGrid();
  renderAnnouncementsTable();

  const yearLabel = document.getElementById('current-year-label');
  if (year && year.label && yearLabel) {
    yearLabel.textContent = `שנת קמפיין ${year.label}`;
  }

  (dbCommitments || []).forEach((c) => {
    const mapped = {
      personId: c.person_id,
      fullName: c.name,
      groupId: c.group_id,
      groupName: c.group_name,
      target: c.target,
      isPremium: !!c.is_premium,
      createdAt: c.created_at,
    };
    commitments.push(mapped);
    addCommitmentRow(mapped);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initRtlAndDates();
  initEvents();
  initSidebarNavigation();
  initGroupsUi();
  initPersonsUi();
  initCollectionsUi();
  initAnnouncementsUi();
  loadInitialData();
});
