const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const APP_BASE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'kalttoffline')
  : path.join(__dirname, '..');

const DATA_DIR = path.join(APP_BASE_DIR, 'data');
const LOG_DIR = path.join(APP_BASE_DIR, 'logs');
const ASSETS_DIR = path.join(APP_BASE_DIR, 'assets');
const CONFIG_DIR = path.join(APP_BASE_DIR, 'config');

[DATA_DIR, LOG_DIR, ASSETS_DIR, CONFIG_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// IPC – DB: מאגר בחורים (ת.ז כ־ID ראשי)
ipcMain.handle('db:list-persons', async (_event, payload) => {
  try {
    const persons = db.listPersons(payload?.limit || 500);
    return { ok: true, persons };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:upsert-person', async (_event, payload) => {
  try {
    const person = db.upsertPerson({
      id: payload.id,
      fullName: payload.fullName,
      groupId: payload.groupId || null,
      isPremium: !!payload.isPremium,
    });
    const persons = db.listPersons(500);
    return { ok: true, person, persons };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:delete-person', async (_event, payload) => {
  try {
    db.deletePerson(payload.id);
    const persons = db.listPersons(500);
    return { ok: true, persons };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:find-person-by-id', async (_event, payload) => {
  try {
    const person = db.findPersonById(payload.id);
    return { ok: true, person };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:search-persons', async (_event, payload) => {
  try {
    const persons = db.searchPersons(payload.query || '', payload.limit || 50);
    return { ok: true, persons };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// IPC – DB: ימי איסוף ואיסוף בפועל (במקום אקסל)
ipcMain.handle('db:list-collection-days', async () => {
  try {
    const days = db.listCollectionDaysForCurrentYear();
    return { ok: true, days };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:create-collection-day', async (_event, payload) => {
  try {
    const day = db.createCollectionDayForCurrentYear({ name: payload.name });
    const days = db.listCollectionDaysForCurrentYear();
    return { ok: true, day, days };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:update-collection-day', async (_event, payload) => {
  try {
    const day = db.updateCollectionDay({ id: payload.id, name: payload.name });
    const days = db.listCollectionDaysForCurrentYear();
    return { ok: true, day, days };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:delete-collection-day', async (_event, payload) => {
  try {
    db.deleteCollectionDay(payload.id);
    const days = db.listCollectionDaysForCurrentYear();
    const collections = db.listCollectionsForCurrentYear();
    return { ok: true, days, collections };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:list-collections', async () => {
  try {
    const collections = db.listCollectionsForCurrentYear();
    return { ok: true, collections };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:set-collection-amount', async (_event, payload) => {
  try {
    db.setCollectionAmount({
      personId: payload.personId,
      dayId: payload.dayId,
      amount: payload.amount,
    });
    const collections = db.listCollectionsForCurrentYear();
    return { ok: true, collections };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// IPC – DB: הודעות/באנרים/טיקר
ipcMain.handle('db:list-announcements', async () => {
  try {
    const announcements = db.listAnnouncementsForCurrentYear();
    return { ok: true, announcements };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:create-announcement', async (_event, payload) => {
  try {
    const announcement = db.createAnnouncementForCurrentYear({
      type: payload.type,
      title: payload.title,
      text: payload.text,
      signature: payload.signature,
      expiresAtIso: payload.expiresAtIso || null,
      payload: payload.payload || {},
    });
    const announcements = db.listAnnouncementsForCurrentYear();
    const activeAnnouncements = db.listActiveAnnouncementsNow();

    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.webContents.send('display:active-announcements', { activeAnnouncements });
    }

    return { ok: true, announcement, announcements, activeAnnouncements };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:delete-announcement', async (_event, payload) => {
  try {
    db.deleteAnnouncement(payload.id);
    const announcements = db.listAnnouncementsForCurrentYear();
    const activeAnnouncements = db.listActiveAnnouncementsNow();

    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.webContents.send('display:active-announcements', { activeAnnouncements });
    }

    return { ok: true, announcements, activeAnnouncements };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

let dashboardWindow;
let displayWindow;

function createDashboardWindow() {
  dashboardWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'דשבורד ניהול - kalttoffline',
  });

  dashboardWindow.loadFile(path.join(__dirname, 'renderer', 'dashboard.html'));
}

function createDisplayWindow() {
  displayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'מסך תצוגה - kalttoffline',
    fullscreen: false,
  });

  displayWindow.loadFile(path.join(__dirname, 'renderer', 'display.html'));

  displayWindow.webContents.on('did-finish-load', () => {
    try {
      const activeAnnouncements = db.listActiveAnnouncementsNow();
      displayWindow.webContents.send('display:active-announcements', { activeAnnouncements });
    } catch (_err) {
      // ignore
    }
  });
}

app.whenReady().then(() => {
  createDashboardWindow();
  createDisplayWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDashboardWindow();
      createDisplayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC – sync between dashboard and display (תצוגת התחייבויות חדשה)
ipcMain.on('display:new-commitment', (_event, payload) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('display:new-commitment', payload);
  }
});

// IPC – DB: טעינת נתוני פתיחה לדשבורד (קבוצות + התחייבויות אחרונות)
ipcMain.handle('db:load-initial-dashboard-data', async () => {
  try {
    const year = db.getCurrentYear();
    const groups = db.listGroupsForCurrentYear();
    const commitments = db.listRecentCommitments(200);
    const persons = db.listPersons(500);
    const collectionDays = db.listCollectionDaysForCurrentYear();
    const collections = db.listCollectionsForCurrentYear();
    const targetsMap = db.getLatestTargetByPersonForCurrentYear();
    const targets = Object.fromEntries(targetsMap);
    const announcements = db.listAnnouncementsForCurrentYear();
    const activeAnnouncements = db.listActiveAnnouncementsNow();
    return {
      ok: true,
      year,
      groups,
      commitments,
      persons,
      collectionDays,
      collections,
      targets,
      announcements,
      activeAnnouncements,
    };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// IPC – DB: קבוצות (CRUD בסיסי לשנה הנוכחית)
ipcMain.handle('db:create-group', async (_event, payload) => {
  try {
    db.createGroupForCurrentYear({
      id: payload.id,
      name: payload.name,
      logoPath: payload.logoPath || null,
    });
    const groups = db.listGroupsForCurrentYear();
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:update-group', async (_event, payload) => {
  try {
    db.updateGroup({
      id: payload.id,
      name: payload.name,
      logoPath: payload.logoPath || null,
    });
    const groups = db.listGroupsForCurrentYear();
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('db:delete-group', async (_event, payload) => {
  try {
    db.deleteGroup(payload.id);
    const groups = db.listGroupsForCurrentYear();
    return { ok: true, groups };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

// IPC – DB: הוספת התחייבות חדשה
ipcMain.handle('db:add-commitment', async (_event, payload) => {
  try {
    const saved = db.addCommitment({
      personId: payload.personId,
      fullName: payload.fullName,
      groupId: payload.groupId,
      target: payload.target,
      isPremium: payload.isPremium,
    });
    return { ok: true, commitment: saved };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

module.exports = {
  APP_BASE_DIR,
  DATA_DIR,
  LOG_DIR,
  ASSETS_DIR,
  CONFIG_DIR,
};
