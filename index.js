const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');

process.setMaxListeners(50);

// ─── DB ───────────────────────────────────────────────────────────────────────
const DB_FILE   = './data/players.json';
const GAME_FILE = './data/gamestate.json';

function loadDB() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');
  if (!fs.existsSync(DB_FILE))   fs.writeFileSync(DB_FILE, '{}');
  if (!fs.existsSync(GAME_FILE)) fs.writeFileSync(GAME_FILE, '{}');
  return {
    players:   JSON.parse(fs.readFileSync(DB_FILE)),
    gamestate: JSON.parse(fs.readFileSync(GAME_FILE))
  };
}
function saveDB(players, gamestate) {
  fs.writeFileSync(DB_FILE,   JSON.stringify(players,   null, 2));
  fs.writeFileSync(GAME_FILE, JSON.stringify(gamestate, null, 2));
}

// ─── Karakter ─────────────────────────────────────────────────────────────────
const CHARACTERS = {
  luffy:   { name:'Monkey D. Luffy',    title:'Kapten Topi Jerami',      emoji:'🎩', hp:500, atk:95,  def:40, power:'Gomu Gomu no Mi',    skills:['Gomu Gomu no Pistol','Gear Second','Gear Third','Haki Conqueror'],        desc:'Calon Raja Bajak Laut!' },
  zoro:    { name:'Roronoa Zoro',        title:'Pendekar Tiga Pedang',    emoji:'⚔️', hp:450, atk:100, def:55, power:'Santoryu',           skills:['Oni Giri','Tiger Hunt','360 Pound Cannon','Asura'],                       desc:'Ingin jadi pendekar No.1 dunia.' },
  nami:    { name:'Nami',                title:'Navigator Topi Jerami',   emoji:'🌩️', hp:300, atk:70,  def:35, power:'Clima-Tact',         skills:['Thunder Bolt Tempo','Thunderstorm','Mirage Tempo','Dark Cloud'],          desc:'Navigator jenius penguasa cuaca.' },
  usopp:   { name:'Usopp',               title:'Sniper Topi Jerami',      emoji:'🎯', hp:320, atk:75,  def:30, power:'Kabuto Pachinko',    skills:['Green Star','Pop Green','Hissatsu Usopp','Impact Wolf'],                  desc:'Sniper jago walau suka bohong.' },
  sanji:   { name:'Vinsmoke Sanji',      title:'Koki & Penendang Neraka', emoji:'🦵', hp:420, atk:90,  def:50, power:'Black Leg Style',    skills:['Diable Jambe','Hell Memories','Ifrit Jambe','Sky Walk'],                  desc:'Koki dunia dengan tendangan berapi.' },
  chopper: { name:'Tony Tony Chopper',   title:'Dokter Topi Jerami',      emoji:'🦌', hp:350, atk:65,  def:45, power:'Hito Hito no Mi',    skills:['Kung Fu Point','Monster Point','Arm Point','Guard Point'],               desc:'Rusa manusia dokter bajak laut.' },
  robin:   { name:'Nico Robin',          title:'Arkeolog Topi Jerami',    emoji:'🌸', hp:380, atk:80,  def:40, power:'Hana Hana no Mi',    skills:['Cien Fleur','Gigante Fleur','Clutch','Mil Fleur'],                        desc:'Pembaca Poneglyph satu-satunya.' },
  franky:  { name:'Franky',              title:'Ahli Mesin Topi Jerami',  emoji:'🤖', hp:480, atk:85,  def:70, power:'Cyborg Body',        skills:['Radical Beam','Franky Shogun','Strong Right','Coup de Boo'],             desc:'Cyborg super builder Thousand Sunny.' },
  brook:   { name:'Brook',               title:'Musisi Topi Jerami',      emoji:'💀', hp:360, atk:78,  def:38, power:'Yomi Yomi no Mi',    skills:['Hanauta Sancho','Soul Solid','Ice Soul','Phrase dArmes'],               desc:'Kerangka hidup musisi bajak laut.' },
  jinbe:   { name:'Jinbe',               title:'Ksatria Laut Topi Jerami',emoji:'🐋', hp:550, atk:88,  def:80, power:'Fish-Man Karate',    skills:['Vagabond Drill','Samehada Shotgun','Fish-Man Judo','Oni Backhand'],      desc:'Juru mudi terkuat Grand Line.' }
};

const ENEMIES = [
  { name:'🤡 Buggy',               hp:150,  atk:40,  reward:1500,  loot:'Rusty Compass' },
  { name:'🦈 Arlong',              hp:250,  atk:65,  reward:3500,  loot:'Sea Chart' },
  { name:'🐊 Crocodile',           hp:300,  atk:80,  reward:5000,  loot:'Log Pose Fragment' },
  { name:'👻 Perona',              hp:200,  atk:55,  reward:2500,  loot:'Ghost Map' },
  { name:'🐍 Hancock',             hp:450,  atk:110, reward:10000, loot:'Vivre Card' },
  { name:'🧊 Aokiji',              hp:500,  atk:120, reward:12000, loot:'Ancient Weapon Clue' },
  { name:'👁️ Charlotte Katakuri', hp:600,  atk:130, reward:15000, loot:'Poneglyph Copy' },
  { name:'🔥 Admiral Akainu',      hp:700,  atk:150, reward:20000, loot:'Road Poneglyph Shard' },
  { name:'🐻 Whitebeard',          hp:900,  atk:170, reward:25000, loot:'Yonko Territory Map' },
  { name:'🐉 Kaido',               hp:1000, atk:180, reward:30000, loot:'One Piece Map Fragment' }
];

const LOCATIONS = [
  '🏝️ Reverse Mountain','🌊 Calm Belt','🏔️ Alabasta','🌿 Skypiea',
  '❄️ Drum Island','🌺 Water 7','🌙 Thriller Bark','⚡ Sabaody Archipelago',
  '🐟 Fish-Man Island','🌊 New World','🔥 Punk Hazard','🌸 Dressrosa',
  '🍭 Whole Cake Island','🐉 Wano Country','🏴‍☠️ Raftel (Laugh Tale)'
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function isGroup(jid) { return jid.endsWith('@g.us'); }
function sender(msg) { return msg.key.participant || msg.key.remoteJid; }

// ─── Commands ─────────────────────────────────────────────────────────────────
async function cmdRegist(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const num = senderJid.split('@')[0];
  if (players[num]) {
    const c = CHARACTERS[players[num].character];
    return sock.sendMessage(jid, { text: `⚠️ Sudah terdaftar!\n${c.emoji} *${c.name}*\nGunakan *.start* untuk mulai.` });
  }
  const used = Object.values(players).map(p => p.character);
  const avail = Object.keys(CHARACTERS).filter(k => !used.includes(k));
  if (!avail.length) return sock.sendMessage(jid, { text: '❌ Semua slot karakter penuh (10/10)!' });
  const key = rand(avail);
  const c = CHARACTERS[key];
  players[num] = { character:key, hp:c.hp, maxHp:c.hp, beli:0, treasures:[], kills:0, location:'', adventure:false, currentEnemy:null };
  saveDB(players, gamestate);
  return sock.sendMessage(jid, {
    text:
      `🏴‍☠️ *SELAMAT BERGABUNG!* 🏴‍☠️\n\n` +
      `╔══════════════════════╗\n` +
      `║ ${c.emoji} *${c.name}*\n║ _${c.title}_\n` +
      `╠══════════════════════╣\n` +
      `║ ❤️ HP  : ${c.hp}\n║ ⚔️ ATK : ${c.atk}\n║ 🛡️ DEF : ${c.def}\n║ 💥    : ${c.power}\n` +
      `╠══════════════════════╣\n║ 📖 ${c.desc}\n` +
      `╚══════════════════════╝\n\n🎯 Skill: ${c.skills.join(', ')}\n\nGunakan *.start* untuk berlayar! ⚓`
  });
}

async function cmdStart(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const num = senderJid.split('@')[0];
  if (!players[num]) return sock.sendMessage(jid, { text: '❌ Belum daftar! Gunakan *.regist* dulu.' });
  const p = players[num];
  if (p.hp <= 0) { p.hp = CHARACTERS[p.character].hp; p.adventure = false; p.currentEnemy = null; }
  const c = CHARACTERS[p.character];
  const e = rand(ENEMIES);
  const loc = rand(LOCATIONS);
  p.adventure = true;
  p.location = loc;
  p.currentEnemy = { ...e, currentHp: e.hp };
  saveDB(players, gamestate);
  return sock.sendMessage(jid, {
    text:
      `⚓ *PETUALANGAN DIMULAI!*\n\n${c.emoji} *${c.name}* berlayar ke ${loc}!\n\n` +
      `━━━━━━━━━━━━━━━━\n💀 *MUSUH MUNCUL!*\n${e.name}\n` +
      `└ ❤️ HP    : ${e.hp}\n└ ⚔️ ATK   : ${e.atk}\n` +
      `└ 💰 Reward: ${e.reward.toLocaleString()} Beli\n└ 🏆 Loot  : ${e.loot}\n━━━━━━━━━━━━━━━━\n\n` +
      `Gunakan *.attack* untuk menyerang!\nHP kamu: ❤️ ${p.hp}/${c.hp}`
  });
}

async function cmdAttack(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const num = senderJid.split('@')[0];
  if (!players[num]) return sock.sendMessage(jid, { text: '❌ Belum daftar! Gunakan *.regist* dulu.' });
  const p = players[num];
  if (!p.adventure || !p.currentEnemy) return sock.sendMessage(jid, { text: '⚠️ Belum mulai! Gunakan *.start* dulu.' });
  if (p.hp <= 0) return sock.sendMessage(jid, { text: '💀 HP 0! Gunakan *.start* untuk lanjut.' });
  const c = CHARACTERS[p.character];
  const e = p.currentEnemy;
  const pdmg = Math.floor(c.atk * (0.8 + Math.random() * 0.4));
  const edmg = Math.max(0, Math.floor(e.atk * (0.8 + Math.random() * 0.4) - c.def * 0.3));
  const skill = rand(c.skills);
  e.currentHp -= pdmg;
  p.hp = Math.max(0, p.hp - edmg);

  let txt = `⚔️ *PERTARUNGAN!*\n\n${c.emoji} *${skill}*!\n💥 -${pdmg} HP ke ${e.name}\n🩸 ${e.name} balik -${edmg} HP\n\n`;

  if (e.currentHp <= 0) {
    p.beli += e.reward; p.kills++; p.treasures.push(e.loot);
    p.adventure = false; p.currentEnemy = null;
    saveDB(players, gamestate);
    const win = p.treasures.includes('One Piece Map Fragment') && p.treasures.length >= 5;
    if (win) {
      txt += `🌟🏴‍☠️ *ONE PIECE DITEMUKAN!!!* 🏴‍☠️🌟\n\n👑 *${c.name}* adalah RAJA BAJAK LAUT!\nBeli: ${p.beli.toLocaleString()} | Kill: ${p.kills}`;
    } else {
      txt += `💀 *${e.name} KALAH!*\n╔══════════════╗\n║ +${e.reward.toLocaleString()} Beli\n║ 📜 ${e.loot}\n╚══════════════╝\n\nHP: ❤️ ${p.hp}/${c.hp} | Beli: ${p.beli.toLocaleString()}\n\nGunakan *.start* untuk lanjut! 🗺️`;
    }
  } else if (p.hp <= 0) {
    p.adventure = false; p.currentEnemy = null;
    saveDB(players, gamestate);
    txt += `💀 *PINGSAN!* ${e.name} masih ${e.currentHp} HP.\nGunakan *.start* untuk coba lagi!`;
  } else {
    saveDB(players, gamestate);
    txt += `${c.emoji} HP: ${p.hp}/${c.hp}\n${e.name} HP: ${e.currentHp}/${e.hp}\n\nGunakan *.attack* lagi!`;
  }
  return sock.sendMessage(jid, { text: txt });
}

// ─── Bot ──────────────────────────────────────────────────────────────────────
async function startBot(phoneNumber = null) {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false,
    logger,
    browser: ['OnePieceRPG', 'Chrome', '1.0.0'],
    maxMsgRetryCount: 3
  });

  // ── Pairing code: request SEBELUM connect, langsung setelah socket dibuat ──
  if (!state.creds.registered && phoneNumber) {
    // Baileys butuh sedikit waktu inisialisasi internal sebelum bisa request
    await new Promise(r => setTimeout(r, 1500));
    try {
      const code = await sock.requestPairingCode(phoneNumber);
      console.log(`\n🔑 PAIRING CODE: \x1b[33m\x1b[1m${code}\x1b[0m`);
      console.log('📲 WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Masukkan kode\n');
    } catch (e) {
      console.error('❌ Gagal pairing:', e.message);
      process.exit(1);
    }
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('\n✅ \x1b[32mBot terhubung! Siap berlayar di Grand Line 🏴‍☠️\x1b[0m\n');
    } else if (connection === 'close') {
      const code = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode : 0;
      if (code === DisconnectReason.loggedOut) {
        console.log('❌ Logout. Hapus auth_info & jalankan ulang.');
        process.exit(0);
      } else {
        console.log(`🔄 Putus (${code}). Reconnect 5 detik...`);
        // Saat reconnect, phoneNumber sudah null (sudah pernah login)
        setTimeout(() => startBot(null), 5000);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      if (!isGroup(jid)) { await sock.readMessages([msg.key]).catch(() => {}); continue; }
      const snd = sender(msg);
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || '';
      const txt = body.trim().toLowerCase();
      if (!txt.startsWith('.')) continue;
      const db = loadDB();
      try {
        if (txt === '.regist') await cmdRegist(sock, jid, snd, db);
        else if (txt === '.start')  await cmdStart(sock, jid, snd, db);
        else if (txt === '.attack') await cmdAttack(sock, jid, snd, db);
      } catch (e) { console.error('❌ Err:', e.message); }
    }
  });
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🏴‍☠️ ================================= 🏴‍☠️');
  console.log('     ONE PIECE RPG WhatsApp Bot');
  console.log('     Mencari Harta Karun di Grand Line');
  console.log('🏴‍☠️ ================================= 🏴‍☠️\n');

  // Cek apakah sudah pernah login
  const { state } = await useMultiFileAuthState('./auth_info');

  if (!state.creds.registered) {
    // Belum login → minta nomor DULU, baru buat socket
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const phoneNumber = await new Promise(resolve => {
      rl.question('📱 Masukkan nomor WA (format 628xxx, tanpa + atau spasi): ', ans => {
        rl.close();
        resolve(ans.trim().replace(/[^0-9]/g, ''));
      });
    });
    if (!phoneNumber) { console.error('❌ Nomor kosong!'); process.exit(1); }
    console.log(`\n📡 Memproses nomor: ${phoneNumber}`);
    await startBot(phoneNumber);
  } else {
    // Sudah pernah login → langsung connect
    console.log('🔄 Sesi ditemukan, menghubungkan...');
    await startBot(null);
  }
}

main().catch(console.error);
