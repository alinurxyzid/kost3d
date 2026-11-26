/* =========================================================
   ROOM3D.JS — Kamar kost realistis (Three.js r128)
   API dipakai app.js:
     Room3D.setDoorOpen(bool)
     Room3D.setOnline(bool)
     Room3D.pulseUnlock()
   ========================================================= */

(function () {
  'use strict';

  const FALLBACK_TEXT = 'Scene 3D tidak tersedia.<br>Periksa koneksi internet (Three.js CDN) atau dukungan WebGL.<br>Data sensor & tombol tetap berfungsi.';

  function showFallback() {
    const el = document.getElementById('scene');
    if (el) el.innerHTML = '<div class="scene-fallback"><div>' + FALLBACK_TEXT + '</div></div>';
    window.Room3D = { ready: false, setDoorOpen: function () {}, setOnline: function () {}, pulseUnlock: function () {} };
  }

  function boot() {
    if (!window.THREE) {
      // Cadangan bila CDN utama gagal.
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      s.onload = init;
      s.onerror = showFallback;
      document.head.appendChild(s);
    } else {
      init();
    }
  }

  function init() {
    const host = document.getElementById('scene');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      showFallback();
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x121722);
    scene.fog = new THREE.Fog(0x121722, 9, 24);

    const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 80);

    /* ---------- Pembuat tekstur prosedural ---------- */
    function canvasTexture(w, h, draw, repeatX, repeatY) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (repeatX) t.repeat.set(repeatX, repeatY || repeatX);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return t;
    }

    const texFloor = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#6b4a31'; ctx.fillRect(0, 0, w, h);
      const rows = 8, rh = h / rows;
      const shades = ['#7c5839', '#704c32', '#83603f', '#755033'];
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = shades[r % shades.length];
        ctx.fillRect(0, r * rh, w, rh - 3);
        ctx.strokeStyle = 'rgba(35,20,10,.20)'; ctx.lineWidth = 1;
        for (let g = 0; g < 20; g++) {
          const y = r * rh + Math.random() * rh;
          ctx.beginPath(); ctx.moveTo(0, y);
          ctx.bezierCurveTo(w * .3, y + (Math.random() - .5) * 7, w * .7, y + (Math.random() - .5) * 7, w, y);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(20,12,8,.55)'; ctx.fillRect(0, r * rh + rh - 3, w, 3);
        ctx.fillRect(Math.random() * w, r * rh, 2, rh - 3);
      }
    }, 3, 2.4);

    const texWall = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#ded8ca'; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3500; i++) {
        ctx.fillStyle = 'rgba(70,58,45,' + (Math.random() * .055) + ')';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 4, 2);

    const texDoor = canvasTexture(256, 512, (ctx, w, h) => {
      ctx.fillStyle = '#6d4526'; ctx.fillRect(0, 0, w, h);
      for (let g = 0; g < 90; g++) {
        const x = Math.random() * w;
        ctx.strokeStyle = 'rgba(35,18,8,' + (.06 + Math.random() * .12) + ')';
        ctx.lineWidth = .5 + Math.random() * 2;
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 6, h * .3, x - 6, h * .7, x + 2, h);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,210,150,.05)';
      for (let g = 0; g < 40; g++) {
        const x = Math.random() * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 3, h); ctx.stroke();
      }
    });

    const texSky = canvasTexture(256, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b2a55'); g.addColorStop(.42, '#6a5a86');
      g.addColorStop(.72, '#d68668'); g.addColorStop(1, '#f6cf96');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 46; i++) {
        ctx.fillStyle = 'rgba(255,244,214,' + (.25 + Math.random() * .55) + ')';
        ctx.fillRect(Math.random() * w, Math.random() * h * .42, 1.4, 1.4);
      }
      ctx.fillStyle = 'rgba(35,30,45,.55)';
      ctx.fillRect(0, h * .74, w, 4);
    });
    texSky.wrapS = texSky.wrapT = THREE.ClampToEdgeWrapping;

    const texRug = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#3c4a5c'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#d8b98a'; ctx.lineWidth = 8;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.strokeStyle = '#7d8fa5'; ctx.lineWidth = 3;
      ctx.strokeRect(38, 38, w - 76, h - 76);
    });

    const texPlate = canvasTexture(256, 96, (ctx, w, h) => {
      ctx.fillStyle = '#e8d6ae'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#4a3a26';
      ctx.font = 'bold 46px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('KOST ALI', w / 2, h / 2 + 2);
      ctx.strokeStyle = '#8a6c43'; ctx.lineWidth = 5; ctx.strokeRect(6, 6, w - 12, h - 12);
    });
    texPlate.wrapS = texPlate.wrapT = THREE.ClampToEdgeWrapping;

    /* ---------- Material ---------- */
    const M = {
      floor: new THREE.MeshStandardMaterial({ map: texFloor, roughness: .74, metalness: .02 }),
      wall: new THREE.MeshStandardMaterial({ map: texWall, color: 0xf2eee5, roughness: .96 }),
      ceiling: new THREE.MeshStandardMaterial({ color: 0xece7dc, roughness: 1, side: THREE.DoubleSide }),
      door: new THREE.MeshStandardMaterial({ map: texDoor, roughness: .58 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x34251a, roughness: .62 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xd8bd86, metalness: .82, roughness: .26 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x22242a, metalness: .55, roughness: .42 }),
      sheet: new THREE.MeshStandardMaterial({ color: 0xb9c4d2, metalness: .5, roughness: .38 }),
      bed: new THREE.MeshStandardMaterial({ color: 0x48627f, roughness: .95 }),
      blanket: new THREE.MeshStandardMaterial({ color: 0x9c5f4c, roughness: 1 }),
      pillow: new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: 1 }),
      rug: new THREE.MeshStandardMaterial({ map: texRug, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x3f7a4e, roughness: .9, side: THREE.DoubleSide }),
      pot: new THREE.MeshStandardMaterial({ color: 0x9c6b4a, roughness: .85 }),
      curtain: new THREE.MeshStandardMaterial({ color: 0xd9c6a5, roughness: 1, side: THREE.DoubleSide }),
      sky: new THREE.MeshBasicMaterial({ map: texSky }),
      plate: new THREE.MeshBasicMaterial({ map: texPlate }),
      bulb: new THREE.MeshStandardMaterial({ color: 0xfff2d2, emissive: 0xffcc7d, emissiveIntensity: 1.35 }),
      led: new THREE.MeshStandardMaterial({ color: 0x3ddc97, emissive: 0x3ddc97, emissiveIntensity: 1.5 })
    };

    /* ---------- Helper geometri ---------- */
    function box(w, h, d, mat, x, y, z, parent, rx, ry, rz) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.castShadow = true; m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    }
    function cyl(rt, rb, h, mat, x, y, z, parent, rx, ry, rz, seg) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.castShadow = true; m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    }
    function plane(w, h, mat, x, y, z, parent, rx, ry, rz) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    }

    /* ---------- Ruangan 10 x 8 x 3.2 ---------- */
    // Dinding & plafon dikumpulkan supaya bisa disembunyikan otomatis
    // saat kamera digeser keluar ruangan (putaran 360° dari luar).
    const shell = [];
    plane(10, 8, M.floor, 0, 0, 0, scene, -Math.PI / 2); // lantai selalu tampil
    shell.push(plane(10, 8, M.ceiling, 0, 3.2, 0, scene, Math.PI / 2));
    shell.push(box(10, 3.2, .12, M.wall, 0, 1.6, -4));          // dinding belakang
    shell.push(box(.12, 3.2, 8, M.wall, -5, 1.6, 0));           // dinding kiri
    shell.push(box(.12, 3.2, 8, M.wall, 5, 1.6, 0));            // dinding kanan

    // Dinding depan dengan lubang pintu (x -3.6 .. -1.2)
    shell.push(box(1.4, 3.2, .12, M.wall, -4.3, 1.6, 4));
    shell.push(box(6.2, 3.2, .12, M.wall, 1.9, 1.6, 4));
    shell.push(box(2.4, .9, .12, M.wall, -2.4, 2.75, 4));

    // Kusen pintu
    box(.12, 2.38, .2, M.trim, -3.62, 1.19, 3.91);
    box(.12, 2.38, .2, M.trim, -1.18, 1.19, 3.91);
    box(2.52, .12, .2, M.trim, -2.4, 2.34, 3.91);
    box(2.4, .04, .3, M.brass, -2.4, .02, 3.94);

    /* ---------- Pintu (pivot di engsel kiri) ---------- */
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-3.56, 0, 3.86);
    scene.add(doorPivot);

    // Pintu sengaja POLOS: hanya ulir kayu dari tekstur, tanpa panel/kotak.
    box(2.3, 2.25, .09, M.door, 1.17, 1.13, 0, doorPivot);

    // Gagang, lubang intip, papan nama (menghadap ke dalam kamar = -z)
    cyl(.078, .078, .025, M.brass, 2.02, 1.05, -.062, doorPivot, Math.PI / 2);
    cyl(.026, .026, .25, M.brass, 1.91, 1.05, -.12, doorPivot, 0, 0, Math.PI / 2);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.045, 16, 12), M.brass);
    knob.position.set(1.78, 1.05, -.12); doorPivot.add(knob);
    cyl(.036, .036, .03, M.dark, 1.17, 1.58, -.06, doorPivot, Math.PI / 2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 8, 20), M.brass);
    ring.position.set(1.17, 1.58, -.07); doorPivot.add(ring);
    plane(.68, .25, M.plate, 1.17, 1.99, -.055, doorPivot, 0, Math.PI, 0);

    // LED status di atas pintu
    const led = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 12), M.led.clone());
    led.position.set(-2.4, 2.5, 3.82);
    scene.add(led);

    // Koridor di balik pintu + cahaya rembes saat pintu terbuka
    plane(3.4, 2.8, new THREE.MeshBasicMaterial({ color: 0x202638, side: THREE.DoubleSide }), -2.4, 1.45, 4.7);
    const corridorLight = new THREE.PointLight(0xffd7a0, .04, 6, 2);
    corridorLight.position.set(-2.4, 1.85, 4.35);
    scene.add(corridorLight);

    /* ---------- AC split di atas pintu ---------- */
    const acBodyMat = new THREE.MeshStandardMaterial({ color: 0xf1f4f7, roughness: .38, metalness: .12 });
    const acDarkMat = new THREE.MeshStandardMaterial({ color: 0x2b333c, roughness: .72 });
    box(1.12, .34, .30, acBodyMat, -2.4, 2.82, 3.78);          // badan AC
    box(1.16, .05, .34, acBodyMat, -2.4, 2.98, 3.78);          // bibir atas
    box(.80, .11, .012, acDarkMat, -2.55, 2.82, 3.626);        // area ventilasi
    for (let i = 0; i < 5; i++) {
      box(.76, .010, .014, acBodyMat, -2.55, 2.775 + i * .022, 3.618);
    }
    const acLed = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0x7de3ff }));
    acLed.position.set(-2.86, 2.74, 3.62);
    scene.add(acLed);

    // Display suhu AC (di-update dari data sensor oleh app.js)
    const acCanvas = document.createElement('canvas');
    acCanvas.width = 128; acCanvas.height = 64;
    const acCtx = acCanvas.getContext('2d');
    const acTex = new THREE.CanvasTexture(acCanvas);
    acTex.encoding = THREE.sRGBEncoding;
    function updateAcDisplay(temp) {
      acCtx.fillStyle = '#0d1b26'; acCtx.fillRect(0, 0, 128, 64);
      acCtx.fillStyle = '#7de3ff';
      acCtx.font = 'bold 34px sans-serif';
      acCtx.textAlign = 'center'; acCtx.textBaseline = 'middle';
      acCtx.fillText(Math.round(Number(temp) || 0) + '\u00B0', 64, 34);
      acTex.needsUpdate = true;
    }
    updateAcDisplay(24);
    plane(.19, .095, new THREE.MeshBasicMaterial({ map: acTex }), -1.98, 2.74, 3.62, scene, 0, Math.PI, 0);

    const acGlow = new THREE.PointLight(0xbfe8ff, .35, 3, 2);
    acGlow.position.set(-2.4, 2.35, 3.3);
    scene.add(acGlow);

    /* ---------- Perabot kost ---------- */
    // Tempat tidur
    box(2.05, .32, 2.35, M.trim, -3.4, .18, -1.35);
    box(1.94, .22, 2.2, M.bed, -3.4, .45, -1.35);
    box(1.94, .12, 1.42, M.blanket, -3.4, .60, -.95);
    box(.76, .14, .42, M.pillow, -3.88, .61, -2.24);
    box(.76, .14, .42, M.pillow, -2.92, .61, -2.24);
    box(2.1, .9, .12, M.trim, -3.4, .62, -2.56);

    // Meja belajar + laptop
    box(1.85, .08, .78, M.door, 3.25, .78, -2.4);
    [[2.42, -2.76], [4.08, -2.76], [2.42, -2.04], [4.08, -2.04]].forEach((p) => {
      box(.07, .76, .07, M.dark, p[0], .38, p[1]);
    });
    box(.58, .035, .4, M.sheet, 3.25, .84, -2.4);
    box(.58, .38, .025, M.dark, 3.25, 1.04, -2.58, scene, -.12);
    box(.5, .005, .3, new THREE.MeshBasicMaterial({ color: 0x35507a }), 3.25, 1.04, -2.555, scene, -.12);
    cyl(.06, .06, .02, M.dark, 3.25, .86, -2.22);

    // Kursi
    box(.56, .07, .56, M.bed, 3.15, .48, -1.25);
    box(.56, .6, .07, M.bed, 3.15, .82, -1.53);
    [[2.92, -1.48], [3.38, -1.48], [2.92, -1.02], [3.38, -1.02]].forEach((p) => {
      cyl(.025, .025, .45, M.dark, p[0], .23, p[1]);
    });

    // Karpet
    plane(3.1, 2.1, M.rug, .1, .014, .95, scene, -Math.PI / 2);

    // Tanaman hias
    cyl(.22, .17, .36, M.pot, 4.25, .18, -3.25);
    cyl(.19, .19, .02, M.dark, 4.25, .35, -3.25);
    [[-.12, .62, .05], [.13, .7, -.08], [.02, .84, .1], [-.16, .92, -.05], [.14, 1.0, .06]].forEach((p, i) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(.17 - i * .014, 10, 8), M.leaf);
      leaf.scale.set(1, .42, .6);
      leaf.position.set(4.25 + p[0], p[1], -3.25 + p[2]);
      leaf.rotation.z = (i % 2 ? 1 : -1) * .5;
      leaf.castShadow = true; scene.add(leaf);
    });

    // Jendela + tirai (dinding kanan)
    plane(2.2, 1.6, M.sky, 4.92, 1.9, -.5, scene, 0, -Math.PI / 2);
    box(.09, 1.75, .09, M.trim, 4.88, 1.9, -1.65);
    box(.09, 1.75, .09, M.trim, 4.88, 1.9, .65);
    box(.09, .09, 2.4, M.trim, 4.88, 2.72, -.5);
    box(.09, .09, 2.4, M.trim, 4.88, 1.08, -.5);
    box(.06, 1.6, .07, M.trim, 4.86, 1.9, -.5);
    plane(.48, 1.75, M.curtain, 4.84, 1.9, -1.42, scene, 0, -Math.PI / 2);
    plane(.48, 1.75, M.curtain, 4.84, 1.9, .42, scene, 0, -Math.PI / 2);

    // Poster & kalender dinding belakang
    const poster = canvasTexture(256, 320, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#263a5c'); g.addColorStop(1, '#7c4a63');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.86)';
      ctx.font = 'bold 30px sans-serif'; ctx.fillText('SLEEP', 22, 60);
      ctx.font = 'bold 22px sans-serif'; ctx.fillText('STUDY', 22, 94);
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.beginPath(); ctx.arc(170, 210, 62, 0, Math.PI * 2); ctx.fill();
    });
    poster.wrapS = poster.wrapT = THREE.ClampToEdgeWrapping;
    plane(.9, 1.14, new THREE.MeshStandardMaterial({ map: poster, roughness: .9 }), .2, 1.95, -3.92);
    box(.95, 1.19, .03, M.trim, .2, 1.95, -3.95);

    // Bingkai foto "foto-alii.jpg" di tembok depan, Sebelah kanan pintu.
    // Diputar 180° supaya menghadap ke dalam kamar (rasio asli 854x1280 ≈ 2:3).
    const photoFrameMat = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: .5, metalness: .18 });
    box(1.0, 1.44, .06, photoFrameMat, .1, 1.85, 3.90);
    plane(.92, 1.36, new THREE.MeshBasicMaterial({ color: 0xf3ecdd }), .1, 1.85, 3.865, scene, 0, Math.PI, 0);
    const photoMat = new THREE.MeshBasicMaterial({ color: 0x66748a });
    plane(.82, 1.23, photoMat, .1, 1.85, 3.86, scene, 0, Math.PI, 0);
    // Data URL dari foto-alii-data.js diprioritaskan supaya foto tetap tampil
    // walau halaman dibuka langsung lewat file:// (file lokal sering diblokir
    // WebGL karena CORS). Fallback ke berkas asli bila data belum tersedia.
    const fotoSrc = window.FOTO_ALII_DATA || 'foto-alii.jpg';
    new THREE.TextureLoader().load(fotoSrc, (t) => {
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      photoMat.map = t;
      photoMat.color.setHex(0xffffff);
      photoMat.needsUpdate = true;
      console.info('Foto dinding berhasil dimuat.');
    }, undefined, () => {
      console.warn('Gagal memuat foto dinding; memakai placeholder.');
    });

    // Lampu gantung
    cyl(.01, .01, .55, M.dark, 0, 2.94, .35);
    cyl(.06, .3, .28, M.trim, 0, 2.55, .35, scene, 0, 0, Math.PI);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.095, 16, 12), M.bulb.clone());
    bulb.position.set(0, 2.42, .35); scene.add(bulb);
    const lampLight = new THREE.PointLight(0xffc98a, 1.15, 9, 2);
    lampLight.position.set(0, 2.4, .35); scene.add(lampLight);

    /* ---------- Pencahayaan ---------- */
    scene.add(new THREE.HemisphereLight(0xa9c4ff, 0x4b3826, .62));
    scene.add(new THREE.AmbientLight(0xffffff, .22));

    const sun = new THREE.DirectionalLight(0xffe0b8, 1.5);
    sun.position.set(8, 5.5, -1.5);
    sun.target.position.set(0, 1, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -7; sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7;
    sun.shadow.bias = -.0005;
    scene.add(sun, sun.target);

    /* ---------- Debu halus di berkas cahaya ---------- */
    const dustPos = [];
    for (let i = 0; i < 240; i++) {
      dustPos.push((Math.random() - .5) * 8, .25 + Math.random() * 2.6, (Math.random() - .5) * 7);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffe4b8, size: .022, transparent: true, opacity: .55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    }));
    scene.add(dust);

    /* ---------- Kontrol lihat-around ----------
       - Drag 1 jari / mouse: putar bebas 360° (horizontal & vertikal).
       - Pinch 2 jari / scroll: zoom in-out.
       - Semua gerakan dihaluskan (damping) di loop animasi. */
    const target = new THREE.Vector3(-1.35, 1.34, 2.75);
    const orbit = { theta: 2.18, phi: 1.45, radius: 4.25 };
    const smooth = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius };
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const pointers = new Map();
    let pinchDist = 0, lastX = 0, lastY = 0, lastInteraction = performance.now();

    function note() { lastInteraction = performance.now(); }
    function center() {
      let x = 0, y = 0;
      pointers.forEach((p) => { x += p.x; y += p.y; });
      return { x: x / (pointers.size || 1), y: y / (pointers.size || 1) };
    }
    function spread() {
      if (pointers.size < 2) return 0;
      const p = Array.from(pointers.values());
      return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    }

    renderer.domElement.addEventListener('pointerdown', (e) => {
      renderer.domElement.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = center();
      lastX = c.x; lastY = c.y; pinchDist = spread(); note();
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const c = center(), d = spread();

      if (pointers.size >= 2) {
        // Pinch: makin jauh jari = makin dekat (zoom in).
        if (pinchDist > 0 && d > 0) {
          orbit.radius = clamp(orbit.radius * (pinchDist / d), 1.6, 9);
        }
        pinchDist = d;
      } else {
        // Putar bebas; phi dibatasi sedikit agar kamera tidak terbalik.
        orbit.theta -= (c.x - lastX) * .006;
        orbit.phi = clamp(orbit.phi - (c.y - lastY) * .005, .18, Math.PI - .18);
      }
      lastX = c.x; lastY = c.y; note();
    });

    function endPointer(e) {
      pointers.delete(e.pointerId);
      const c = center();
      lastX = c.x; lastY = c.y; pinchDist = spread(); note();
    }
    renderer.domElement.addEventListener('pointerup', endPointer);
    renderer.domElement.addEventListener('pointercancel', endPointer);

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      orbit.radius = clamp(orbit.radius + e.deltaY * .0035, 1.6, 9);
      note();
    }, { passive: false });

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    /* ---------- State pintu dari Firebase ---------- */
    let doorTarget = 0, doorAngle = 0;
    let corridorTarget = .04, corridorNow = .04, pulse = 0;

    window.Room3D = {
      ready: true,
      setDoorOpen: function (open) {
        doorTarget = open ? 1.78 : 0;
        corridorTarget = open ? 1.55 : .04;
        const c = open ? 0xff5d73 : 0x3ddc97;
        led.material.color.setHex(c);
        led.material.emissive.setHex(c);
      },
      setOnline: function (ok) {
        bulb.material.emissiveIntensity = ok ? 1.35 : .55;
        lampLight.intensity = ok ? 1.15 : .55;
      },
      setTemperature: function (t) { updateAcDisplay(t); },
      pulseUnlock: function () { pulse = 1.6; }
    };
    window.dispatchEvent(new Event('room3d-ready'));

    /* ---------- Loop animasi ---------- */
    let prev = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min((now - prev) / 1000, .05);
      prev = now;

      // Putaran pelan otomatis setelah 9 detik tidak disentuh (putaran penuh).
      if (pointers.size === 0 && now - lastInteraction > 9000) orbit.theta += .07 * dt;

      // Damping lebih lembut supaya geseran terasa smooth.
      const k = Math.min(1, dt * 4.5);
      smooth.theta += (orbit.theta - smooth.theta) * k;
      smooth.phi += (orbit.phi - smooth.phi) * k;
      smooth.radius += (orbit.radius - smooth.radius) * k;

      camera.position.set(
        target.x + smooth.radius * Math.sin(smooth.phi) * Math.sin(smooth.theta),
        target.y + smooth.radius * Math.cos(smooth.phi),
        target.z + smooth.radius * Math.sin(smooth.phi) * Math.cos(smooth.theta)
      );
      camera.lookAt(target);

      // Saat kamera berada di luar ruangan, dinding & plafon disembunyikan
      // agar tidak menghalangi pandangan (putaran 360° bebas).
      const outside = camera.position.x < -5 || camera.position.x > 5 ||
                      camera.position.z < -4 || camera.position.z > 4 ||
                      camera.position.y > 3.15;
      shell.forEach((m) => { m.visible = !outside; });

      // Pintu membuka/menutup halus.
      doorAngle += (doorTarget - doorAngle) * Math.min(1, dt * 3.4);
      doorPivot.rotation.y = doorAngle;

      corridorNow += (corridorTarget + pulse - corridorNow) * Math.min(1, dt * 4);
      corridorLight.intensity = corridorNow;
      pulse *= Math.max(0, 1 - dt * 2.4);

      // Debu melayang.
      const dp = dustGeo.attributes.position;
      for (let i = 0; i < dp.count; i++) {
        let y = dp.getY(i) + dt * (.035 + (i % 5) * .006);
        if (y > 2.9) y = .25;
        dp.setY(i, y);
      }
      dp.needsUpdate = true;

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
