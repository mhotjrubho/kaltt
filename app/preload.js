const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kaltApi', {
  // Display sync
  onNewCommitment: (callback) => {
    ipcRenderer.on('display:new-commitment', (_event, payload) => {
      callback(payload);
    });
  },
  onActiveAnnouncements: (callback) => {
    ipcRenderer.on('display:active-announcements', (_event, payload) => {
      callback(payload);
    });
  },
  notifyNewCommitment: (payload) => {
    ipcRenderer.send('display:new-commitment', payload);
  },

  // DB helpers for dashboard
  loadInitialDashboardData: async () => {
    const res = await ipcRenderer.invoke('db:load-initial-dashboard-data');
    return res;
  },
  addCommitment: async (payload) => {
    const res = await ipcRenderer.invoke('db:add-commitment', payload);
    return res;
  },
  createGroup: async (payload) => {
    const res = await ipcRenderer.invoke('db:create-group', payload);
    return res;
  },
  updateGroup: async (payload) => {
    const res = await ipcRenderer.invoke('db:update-group', payload);
    return res;
  },
  deleteGroup: async (payload) => {
    const res = await ipcRenderer.invoke('db:delete-group', payload);
    return res;
  },

  // מאגר בחורים
  listPersons: async (payload) => {
    const res = await ipcRenderer.invoke('db:list-persons', payload || {});
    return res;
  },
  upsertPerson: async (payload) => {
    const res = await ipcRenderer.invoke('db:upsert-person', payload);
    return res;
  },
  deletePerson: async (payload) => {
    const res = await ipcRenderer.invoke('db:delete-person', payload);
    return res;
  },
  findPersonById: async (payload) => {
    const res = await ipcRenderer.invoke('db:find-person-by-id', payload);
    return res;
  },
  searchPersons: async (payload) => {
    const res = await ipcRenderer.invoke('db:search-persons', payload);
    return res;
  },

  // איסוף בפועל (ימים דינמיים)
  listCollectionDays: async () => {
    const res = await ipcRenderer.invoke('db:list-collection-days');
    return res;
  },
  createCollectionDay: async (payload) => {
    const res = await ipcRenderer.invoke('db:create-collection-day', payload);
    return res;
  },
  updateCollectionDay: async (payload) => {
    const res = await ipcRenderer.invoke('db:update-collection-day', payload);
    return res;
  },
  deleteCollectionDay: async (payload) => {
    const res = await ipcRenderer.invoke('db:delete-collection-day', payload);
    return res;
  },
  listCollections: async () => {
    const res = await ipcRenderer.invoke('db:list-collections');
    return res;
  },
  setCollectionAmount: async (payload) => {
    const res = await ipcRenderer.invoke('db:set-collection-amount', payload);
    return res;
  },

  // הודעות/באנרים/טיקר
  listAnnouncements: async () => {
    const res = await ipcRenderer.invoke('db:list-announcements');
    return res;
  },
  createAnnouncement: async (payload) => {
    const res = await ipcRenderer.invoke('db:create-announcement', payload);
    return res;
  },
  deleteAnnouncement: async (payload) => {
    const res = await ipcRenderer.invoke('db:delete-announcement', payload);
    return res;
  },
});
