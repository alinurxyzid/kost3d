# KOST 3D — Room Tour Live

Clone ringan dari `web-pintuiot` dengan **hanya 5 fitur**:

1. Jam & tanggal (waktu lokal browser)
2. Suhu ruangan
3. Kelembapan
4. Status pintu (**TERBUKA / TERTUTUP**), pintu 3D ikut beranimasi
5. Tombol **BUKA PINTU** (dengan konfirmasi + menunggu ACK perangkat)

Tidak ada jadwal sholat, toggle config, log, setup, voice tester, atau restart.

## Sumber data (sama persis dengan web-pintuiot)

| Path Firebase | Dipakai untuk |
|---|---|
| `/sensor/temperature` | angka suhu (°C) |
| `/sensor/humidity` | angka kelembapan (%) |
| `/sensor/status` | `OPENED` / `CLOSED` → animasi pintu |
| `/sensor/heartbeat` | badge Online/Offline (toleransi 25 detik) |
| `/control/command = 1` | perintah buka pintu |
| `/control/command_result` | ACK `{ cmd: 1, status: "success" }` |

Konfigurasi Firebase ada di `app.js` (proyek `pintuiot`).

## Isi folder

- `index.html` — HUD + kontainer scene
- `style.css` — gaya glass HUD, responsif mobile
- `room3d.js` — kamar kost Three.js (pintu polos berulir kayu bertuliskan **KOST ALI**, AC di atas pintu dengan display suhu yang mengikuti sensor, bingkai `foto-alii.jpg` di tembok samping pintu, lampu, jendela, tempat tidur, meja, karpet, tanaman, debu halus)
- `foto-alii-data.js` — foto dinding dalam bentuk data URL (anti-CORS)
- `app.js` — Firebase realtime, jam, dan logika unlock
- `README.md` — ini

## Cara pakai

- **Online / Firebase Hosting:** upload seluruh isi folder ke hosting, lalu buka `index.html` (atau di-stage misal ke `/room`).
- **Lokal untuk preview:** buka `index.html` langsung di browser. Firebase & Three.js dimuat dari CDN, jadi tetap butuh internet.
- **Interaksi 3D:** geser satu jari/mouse untuk berputar **360° bebas** (horizontal & vertikal, dengan damping halus), **pinch dua jari** atau scroll untuk zoom in/out (jarak 1.6–9). Dinding & plafon otomatis hilang kalau kamera berada di luar ruangan. Setelah 9 detik tidak disentuh, kamera berputar pelan otomatis.
- **Tombol panah** di kiri atas menyembunyikan/menampilkan panel jam, suhu, kelembapan, dan status pintu. Saat diminimalkan, tombol unlock berubah jadi tombol kecil (FAB) sehingga scene 3D lebih luas. Di layar HP (`≤ 820px`) mode minimized menjadi default; pilihan tersimpan di `localStorage`.

## Catatan

- Pintu terbuka = rotasi halus ≈ 102°, disertai cahaya koridor yang menyala dan LED status merah; tertutup = LED hijau.
- Tombol unlock menunggu balasan perangkat maksimal 15 detik, lalu menampilkan pesan error bila tidak ada ACK.
- Jika Three.js gagal dimuat, HUD sensor & tombol tetap berfungsi dengan pesan fallback di area scene.
- `foto-alii.jpg` sudah dikonversi ke **data URL** di `foto-alii-data.js`, jadi foto tampil baik saat dibuka langsung lewat `file://` maupun di Firebase Hosting (tidak terkenal masalah CORS WebGL). Berkas JPG asli tetap disimpan sebagai cadangan. Kalau foto diganti, perbarui juga `foto-alii-data.js`.
- Tidak mengubah firmware ESP8266/Arduino; clone ini murni front-end.
