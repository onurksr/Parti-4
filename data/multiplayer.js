// Gerçek Socket.IO ile çok oyunculu test. Çalıştırma: npm install && npm test
// (8 gerçek istemci; internet gerekmez. Pikseli Aç/şarkı/film testleri internet ister, burada yoktur.)
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const PORT = 3100 + Math.floor(Math.random() * 500), URL = 'http://localhost:' + PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fails++; };
const emit = (s, ev, ...a) => new Promise(r => s.emit(ev, ...a, r));
(async () => {
  const srv = spawn('node', ['server.js'], { env: { ...process.env, PORT }, stdio: 'ignore' });
  await sleep(1500);
  const N = 8, cl = [], st = [], keys = [];
  for (let i = 0; i < N; i++) { const s = io(URL, { transports: ['websocket'] }); s.on('s', v => { st[i] = v; }); cl.push(s); }
  await sleep(500);
  const room = await emit(cl[0], 'create', 'Oyuncu1'); keys[0] = room.key;
  ok(!!room.code, 'oda kuruldu: ' + room.code);
  for (let i = 1; i < N; i++) { const r = await emit(cl[i], 'join', room.code, 'Oyuncu' + (i + 1)); keys[i] = r.key; ok(!!r.key, 'oyuncu ' + (i + 1) + ' katıldı'); }
  await sleep(300);
  ok(st.every(v => v && v.players.length === N), 'herkes 8 oyuncuyu görüyor');
  for (const game of ['tf', 'quiz', 'closest', 'emoji', 'wyr']) {
    cl[0].emit('start', { game, mode: 'solo', rounds: 5, time: 15, difficulty: 'medium' });
    await sleep(400);
    ok(st.every(v => v.phase === 'question'), game + ': tur 8 cihazda aynı anda başladı');
    cl.forEach((s, i) => setTimeout(() => s.emit('answer', game === 'closest' ? 100 + i : game === 'emoji' ? 'x' : i % 2), Math.random() * 300));
    await sleep(900);
    ok(st.every(v => v.phase === 'reveal'), game + ': herkes cevaplayınca tur otomatik bitti');
    ok(new Set(st.map(v => JSON.stringify(v.players.map(p => p.score)))).size === 1, game + ': puanlar tüm cihazlarda aynı');
    cl[0].emit('stop'); await sleep(200); cl[0].emit('stop'); await sleep(300);
  }
  cl[3].disconnect(); await sleep(300);
  const back = io(URL, { transports: ['websocket'] });
  const rj = await emit(back, 'rejoin', room.code, keys[3]);
  ok(rj && rj.ok === 1, 'kopan oyuncu aynı kimlikle geri döndü');
  cl.forEach(s => s.close()); back.close(); srv.kill();
  console.log(fails ? fails + ' test BAŞARISIZ' : 'Tüm testler geçti');
  process.exit(fails ? 1 : 0);
})();
