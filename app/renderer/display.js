const displayToastContainer = document.getElementById('display-toast-container');
const displayGroupsGrid = document.getElementById('display-groups-grid');
const displayPremiumStrip = document.getElementById('display-premium-strip');
const displayTotalTarget = document.getElementById('display-total-target');
const displayHebrewDate = document.getElementById('display-hebrew-date');
const tickerInner = document.getElementById('ticker-inner');
const displayActiveLottery = document.getElementById('display-active-lottery');

let groupsState = {};
let premiumList = [];
let totalTarget = 0;
let tickerMessages = [];

let announcementTickerText = '';
let bannerHtml = '';

function initRtlAndDatesDisplay() {
  document.documentElement.dir = 'rtl';
  document.body.style.direction = 'rtl';
  const now = new Date();
  displayHebrewDate.textContent = now.toLocaleDateString('he-IL-u-ca-hebrew', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function renderGroups() {
  displayGroupsGrid.innerHTML = '';
  Object.values(groupsState).forEach((g) => {
    const card = document.createElement('div');
    card.className = 'display-group-card';
    const currentNames = g.names.slice(0, 10);
    const totalForGroup = g.names.reduce((sum, n) => sum + n.target, 0);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="font-weight:700;font-size:1rem;">${g.name}</div>
        <div style="font-size:0.8rem;color:#bfdbfe;">יעד קבוצתי: ${totalForGroup.toLocaleString('he-IL')} ₪</div>
      </div>
      <div style="margin-top:6px;font-size:0.8rem;">
        ${currentNames
          .map(
            (n) =>
              `<div style="display:flex;justify-content:space-between;gap:8px;">
                <span>${n.name}</span>
                <span>${n.target.toLocaleString('he-IL')} ₪</span>
              </div>`
          )
          .join('')}
      </div>
    `;
    displayGroupsGrid.appendChild(card);
  });
}

function renderPremium() {
  displayPremiumStrip.innerHTML = '';
  premiumList.slice(0, 5).forEach((p) => {
    const item = document.createElement('div');
    item.className = 'display-premium-item';
    item.textContent = `${p.name} – ${p.target.toLocaleString('he-IL')} ₪`;
    displayPremiumStrip.appendChild(item);
  });
}

function renderTotalTarget() {
  displayTotalTarget.textContent = totalTarget.toLocaleString('he-IL');
}

function renderTicker() {
  const text = tickerMessages.join(' ‎· ');
  const combined = [announcementTickerText, text].filter(Boolean).join(' ‎· ');
  tickerInner.textContent = combined || 'ברוכים הבאים לערב ההתחייבויות – בהצלחה לכולם!';
}

function renderBanner() {
  let banner = document.getElementById('display-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'display-banner';
    banner.style.padding = '0 32px 10px 32px';
    banner.style.display = 'none';
    banner.style.textAlign = 'right';
    const header = document.querySelector('.display-header');
    header.insertAdjacentElement('afterend', banner);
  }

  if (!bannerHtml) {
    banner.style.display = 'none';
    banner.innerHTML = '';
    return;
  }

  banner.style.display = '';
  banner.innerHTML = `
    <div style="border-radius:24px;border:1px solid rgba(148,163,184,0.35);background:radial-gradient(circle at top left, rgba(244,63,94,0.18), rgba(15,23,42,0.96));padding:12px 16px;">
      ${bannerHtml}
    </div>
  `;
}

function applyActiveAnnouncements(activeAnnouncements) {
  const now = Date.now();
  const active = (activeAnnouncements || []).filter((a) => {
    if (!a.expires_at) return true;
    return Date.parse(a.expires_at) > now;
  });

  const ticker = active
    .filter((a) => a.type === 'ticker')
    .map((a) => [a.title, a.text, a.signature].filter(Boolean).join(' – '))
    .join(' ‎· ');
  announcementTickerText = ticker;

  const banner = active.find((a) => a.type === 'banner');
  if (banner) {
    const parts = [
      banner.title ? `<div style=\"font-weight:800;font-size:1.05rem;\">${banner.title}</div>` : '',
      banner.text ? `<div style=\"margin-top:4px;font-size:0.95rem;\">${banner.text}</div>` : '',
      banner.signature ? `<div style=\"margin-top:6px;color:#cbd5e1;font-size:0.85rem;\">${banner.signature}</div>` : '',
    ].filter(Boolean);
    bannerHtml = parts.join('');
  } else {
    bannerHtml = '';
  }

  renderBanner();
  renderTicker();

  // push notifications
  active
    .filter((a) => a.type === 'push')
    .slice(0, 1)
    .forEach((a) => {
      const msg = [a.title, a.text].filter(Boolean).join(' – ');
      if (msg) showDisplayToast(msg, 0);
    });
}

function showDisplayToast(message, amount) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div style="font-weight:700;">התחייבות חדשה על המסך</div>
    <div>${message}</div>
    <div style="font-size:0.8rem;color:#bbf7d0;">סכום: ${amount.toLocaleString('he-IL')} ₪</div>
  `;
  displayToastContainer.prepend(toast);

  while (displayToastContainer.children.length > 6) {
    displayToastContainer.lastElementChild?.remove();
  }

  setTimeout(() => toast.remove(), 5000);
}

function handleNewCommitment(payload) {
  const { id, name, groupName, target, premium } = payload;
  if (!groupsState[groupName]) {
    groupsState[groupName] = { name: groupName, names: [] };
  }
  groupsState[groupName].names.unshift({ id, name, target, premium });
  totalTarget += target;

  tickerMessages.unshift(`${name} (${groupName}) התחייב ל-${target.toLocaleString('he-IL')} ₪`);
  tickerMessages = tickerMessages.slice(0, 50);

  if (premium) {
    premiumList.unshift({ id, name, target });
    premiumList = premiumList.slice(0, 5);
  }

  renderGroups();
  renderPremium();
  renderTotalTarget();
  renderTicker();
  showDisplayToast(`${name} (${groupName})`, target);
}

window.addEventListener('DOMContentLoaded', () => {
  initRtlAndDatesDisplay();
  renderGroups();
  renderPremium();
  renderTotalTarget();
  renderTicker();
  renderBanner();

  if (window.kaltApi && typeof window.kaltApi.onNewCommitment === 'function') {
    window.kaltApi.onNewCommitment(handleNewCommitment);
  }

  // announcements sync
  if (window.kaltApi) {
    window.kaltApi.onActiveAnnouncements?.((payload) => {
      applyActiveAnnouncements(payload.activeAnnouncements || []);
    });
  }
});
