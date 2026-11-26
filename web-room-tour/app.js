/* =========================================================
   APP.JS — Data live Firebase untuk room tour
   Fitur sengaja dibatasi: jam/tanggal, suhu, kelembapan,
   status pintu, dan tombol unlock.
   ========================================================= */

(function () {
  'use strict';

  const firebaseConfig = {
    apiKey: "AIzaSyDcmkklfPbwnf_xI2Ie4bBffv_1A6Z9Nh0",
    authDomain: "pintuiot.firebaseapp.com",
    databaseURL: "https://pintuiot-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pintuiot",
    messagingSenderId: "555761531390",
    appId: "1:555761531390:web:d5093cf6c4dac86ba768af"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const $ = (id) => document.getElementById(id);
  const OFFLINE_MS = 25000;

  let lastMcuUpdate = 0;
  let currentTemp = 24;
  let doorOpen = false;
  let pending = null;
  let pendingTimer = null;
  let toastTimer = null;

  /* ---------- Jam & tanggal ---------- */
  function tickClock() {
    const d = new Date();
    $('clock').textContent = d.toLocaleTimeString('id-ID', { hour12: false });
    $('date').textContent = d.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------- Status koneksi ---------- */
  function isOnline() {
    return lastMcuUpdate > 0 && (Date.now() - lastMcuUpdate < OFFLINE_MS);
  }

  function setLink(state, text) {
    const b = $('link-badge');
    b.className = 'link-badge' + (state ? ' ' + state : '');
    b.querySelector('span').textContent = text;
  }

  function checkOnline() {
    const ok = isOnline();
    setLink(ok ? 'online' : 'offline', ok ? 'Perangkat Online' : 'Perangkat Offline');
    syncScene();
  }
  setInterval(checkOnline, 5000);

  db.ref('/sensor/heartbeat').on('value', (snap) => {
    const hb = snap.val();
    if (typeof hb === 'number' && hb > 1577836800) {
      lastMcuUpdate = hb * 1000;
      checkOnline();
    }
  });

  /* ---------- Suhu, kelembapan, status pintu ---------- */
  db.ref('/sensor').on('value', (snap) => {
    try {
      const data = snap.val() || {};
      lastMcuUpdate = Date.now();

      const t = Number(data.temperature || 0);
      const h = Number(data.humidity || 0);
      currentTemp = t;
      $('temperature').innerHTML = t.toFixed(1) + '<small>°C</small>';
      $('humidity').innerHTML = Math.round(h) + '<small>%</small>';

      const raw = String(data.status || '').toUpperCase();
      doorOpen = (raw === 'OPEN' || raw === 'OPENED');

      $('door-status').textContent = doorOpen ? 'TERBUKA' : 'TERTUTUP';
      $('door-desc').textContent = doorOpen
        ? 'Pintu sedang terbuka'
        : 'Pintu dalam keadaan aman';
      $('door-panel').classList.toggle('is-open', doorOpen);
      $('door-dot').className = 'dot ' + (doorOpen ? 'red' : 'green');

      checkOnline();
    } catch (err) {
      console.warn('Gagal membaca data sensor:', err);
    }
  });

  /* ---------- Sinkron ke scene 3D ---------- */
  function syncScene() {
    if (!window.Room3D || !Room3D.ready) return;
    Room3D.setDoorOpen(doorOpen);
    Room3D.setOnline(isOnline());
    Room3D.setTemperature(currentTemp);
  }
  window.addEventListener('room3d-ready', syncScene);
  syncScene();

  /* ---------- Minimize panel data ---------- */
  // Di layar HP default-nya minimized supaya scene 3D seluas mungkin.
  // Pilihan pengguna disimpan di localStorage.
  const hudToggle = $('hud-toggle');
  function setHudMinimized(min, save) {
    document.body.classList.toggle('hud-minimized', min);
    hudToggle.classList.toggle('is-min', min);
    const label = min ? 'Tampilkan data' : 'Sembunyikan data';
    hudToggle.title = label;
    hudToggle.setAttribute('aria-label', label);
    if (save !== false) {
      try { localStorage.setItem('kost3d-hud-min', min ? '1' : '0'); } catch (e) {}
    }
  }
  hudToggle.addEventListener('click', () => {
    setHudMinimized(!document.body.classList.contains('hud-minimized'));
  });
  let savedMin = null;
  try { savedMin = localStorage.getItem('kost3d-hud-min'); } catch (e) {}
  setHudMinimized(
    savedMin !== null ? savedMin === '1' : window.matchMedia('(max-width: 820px)').matches,
    false
  );

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show' + (kind ? ' ' + kind : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  /* ---------- Tombol unlock (konfirmasi + ACK) ---------- */
  const modal = $('modal');
  const btn = $('unlock-btn');
  const sub = $('unlock-sub');

  function openModal() { modal.classList.add('show'); }
  function closeModal() { modal.classList.remove('show'); }

  $('modal-cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  btn.addEventListener('click', () => { if (!btn.disabled) openModal(); });
  $('modal-confirm').addEventListener('click', () => { closeModal(); sendUnlock(); });

  function resetPending(msg) {
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
    pending = null;
    btn.disabled = false;
    sub.textContent = msg || 'Ketuk untuk membuka kunci';
  }

  function sendUnlock() {
    btn.disabled = true;
    sub.textContent = 'Mengirim perintah…';
    pending = { cmd: 1, at: Date.now() };

    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      resetPending('Perangkat tidak merespon');
      toast('Perintah terkirim, tapi perangkat belum merespon', 'error');
    }, 15000);

    if (window.Room3D && Room3D.ready) Room3D.pulseUnlock();

    db.ref('/control/command').set(1).catch(() => {
      resetPending('Gagal mengirim perintah');
      toast('Gagal mengirim perintah ke perangkat', 'error');
    });
  }

  db.ref('/control/command_result').on('value', (snap) => {
    const r = snap.val();
    if (!r || pending === null) return;
    if (Number(r.cmd) === 1 && r.status === 'success') {
      resetPending('Pintu terbuka · ketuk lagi');
      toast('Perangkat menerima perintah — pintu terbuka', 'success');
    }
  });
})();
