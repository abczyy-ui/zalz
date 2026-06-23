const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── Database sederhana berbasis JSON ────────────────────────────────────────
const DB_FILE = './data/players.json';
const GAME_FILE = './data/gamestate.json';

function loadDB() {
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');
  if (!fs.existsSync(GAME_FILE)) fs.writeFileSync(GAME_FILE, '{}');
  return {
    players: JSON.parse(fs.readFileSync(DB_FILE)),
    gamestate: JSON.parse(fs.readFileSync(GAME_FILE))
  };
}

function saveDB(players, gamestate) {
  fs.writeFileSync(DB_FILE, JSON.stringify(players, null, 2));
  fs.writeFileSync(GAME_FILE, JSON.stringify(gamestate, null, 2));
}

// ─── Data Karakter ONE PIECE ──────────────────────────────────────────────────
const CHARACTERS = {
  luffy: {
    name: 'Monkey D. Luffy',
    title: 'Kapten Bajak Laut Topi Jerami',
    emoji: '🎩',
    hp: 500,
    atk: 95,
    def: 40,
    power: 'Gomu Gomu no Mi',
    skills: ['Gomu Gomu no Pistol', 'Gear Second', 'Gear Third', 'Haki Conqueror'],
    desc: 'Calon Raja Bajak Laut! Pengguna buah Gomu Gomu no Mi.'
  },
  zoro: {
    name: 'Roronoa Zoro',
    title: 'Pendekar Pedang Tiga Gaya',
    emoji: '⚔️',
    hp: 450,
    atk: 100,
    def: 55,
    power: 'Santoryu',
    skills: ['Oni Giri', 'Tiger Hunt', '360 Pound Cannon', 'Asura'],
    desc: 'Wakil kapten & pendekar pedang terkuat. Ingin menjadi pendekar No.1 dunia.'
  },
  nami: {
    name: 'Nami',
    title: 'Navigator Topi Jerami',
    emoji: '🌩️',
    hp: 300,
    atk: 70,
    def: 35,
    power: 'Clima-Tact',
    skills: ['Thunder Bolt Tempo', 'Thunderstorm Tempo', 'Mirage Tempo', 'Dark Cloud'],
    desc: 'Navigator jenius pencuri peta. Menguasai cuaca dengan Clima-Tact.'
  },
  usopp: {
    name: 'Usopp',
    title: 'Sniper Topi Jerami',
    emoji: '🎯',
    hp: 320,
    atk: 75,
    def: 30,
    power: 'Kabuto Pachinko',
    skills: ['Green Star Trampolia', 'Pop Green Sunflower', 'Hissatsu Usopp', 'Impact Wolf'],
    desc: 'Sniper berbohong tapi jago. Pewaris semangat Sogeking!'
  },
  sanji: {
    name: 'Vinsmoke Sanji',
    title: 'Koki & Penendang Neraka',
    emoji: '🦵',
    hp: 420,
    atk: 90,
    def: 50,
    power: 'Black Leg Style',
    skills: ['Diable Jambe', 'Hell Memories', 'Ifrit Jambe', 'Sky Walk'],
    desc: 'Koki kelas dunia dengan tendangan berapi. Putra Keluarga Vinsmoke.'
  },
  chopper: {
    name: 'Tony Tony Chopper',
    title: 'Dokter Topi Jerami',
    emoji: '🦌',
    hp: 350,
    atk: 65,
    def: 45,
    power: 'Hito Hito no Mi',
    skills: ['Kung Fu Point', 'Monster Point', 'Arm Point', 'Guard Point'],
    desc: 'Rusa manusia dokter bajak laut. Pengguna Rumble Ball!'
  },
  robin: {
    name: 'Nico Robin',
    title: 'Arkeolog Topi Jerami',
    emoji: '🌸',
    hp: 380,
    atk: 80,
    def: 40,
    power: 'Hana Hana no Mi',
    skills: ['Cien Fleur Wing', 'Gigante Fleur', 'Clutch', 'Mil Fleur'],
    desc: 'Wanita iblis yang bisa membaca Poneglyph. Pengguna Hana Hana no Mi.'
  },
  franky: {
    name: 'Franky',
    title: 'Ahli Mesin Topi Jerami',
    emoji: '🤖',
    hp: 480,
    atk: 85,
    def: 70,
    power: 'Cyborg Body',
    skills: ['Franky Radical Beam', 'Franky Shogun', 'Strong Right', 'Coup de Boo'],
    desc: 'Cyborg super yang membangun kapal Thousand Sunny. SUPER!'
  },
  brook: {
    name: 'Brook',
    title: 'Musisi Topi Jerami',
    emoji: '💀',
    hp: 360,
    atk: 78,
    def: 38,
    power: 'Yomi Yomi no Mi',
    skills: ['Hanauta Sancho', 'Phrase d\'Armes', 'Soul Solid', 'Ice Soul'],
    desc: 'Kerangka hidup musisi bajak laut. Pengguna Yomi Yomi no Mi. Yohohoho!'
  },
  jinbe: {
    name: 'Jinbe',
    title: 'Ksatria Laut Topi Jerami',
    emoji: '🐋',
    hp: 550,
    atk: 88,
    def: 80,
    power: 'Fish-Man Karate',
    skills: ['Vagabond Drill', 'Samehada Shotgun', 'Fish-Man Judo', 'Oni Backhand'],
    desc: 'Mantan Shichibukai & kapten bajak laut Ikan. Juru mudi terkuat!'
  }
};

// ─── Data Musuh di Grand Line ─────────────────────────────────────────────────
const ENEMIES = [
  { name: '🐊 Crocodile', hp: 300, atk: 80, reward: 5000, loot: 'Log Pose Fragment' },
  { name: '🧊 Aokiji', hp: 500, atk: 120, reward: 12000, loot: 'Ancient Weapon Clue' },
  { name: '👁️ Charlotte Katakuri', hp: 600, atk: 130, reward: 15000, loot: 'Poneglyph Copy' },
  { name: '🔥 Admiral Akainu', hp: 700, atk: 150, reward: 20000, loot: 'Road Poneglyph Shard' },
  { name: '🐉 Kaido', hp: 1000, atk: 180, reward: 30000, loot: 'One Piece Map Fragment' },
  { name: '🤡 Buggy', hp: 150, atk: 40, reward: 1500, loot: 'Rusty Compass' },
  { name: '🦈 Arlong', hp: 250, atk: 65, reward: 3500, loot: 'Sea Chart' },
  { name: '🐍 Hancock', hp: 450, atk: 110, reward: 10000, loot: 'Vivre Card' },
  { name: '👻 Perona', hp: 200, atk: 55, reward: 2500, loot: 'Ghost Map' },
  { name: '🐻 Whitebeard', hp: 900, atk: 170, reward: 25000, loot: 'Yonko Territory Map' }
];

// ─── Lokasi Grand Line ────────────────────────────────────────────────────────
const LOCATIONS = [
  '🏝️ Reverse Mountain', '🌊 Calm Belt', '🏔️ Alabasta', '🌿 Skypiea',
  '❄️ Drum Island', '🌺 Water 7', '🌙 Thriller Bark', '⚡ Sabaody Archipelago',
  '🐟 Fish-Man Island', '🌊 New World', '🔥 Punk Hazard', '🌸 Dressrosa',
  '🍭 Whole Cake Island', '🐉 Wano Country', '🏴‍☠️ Raftel (Laugh Tale)'
];

// ─── Helper Functions ─────────────────────────────────────────────────────────
function getRandomChar() {
  const keys = Object.keys(CHARACTERS);
  return keys[Math.floor(Math.random() * keys.length)];
}

function getRandomEnemy() {
  return ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
}

function getRandomLocation() {
  return LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

function isGroupJid(jid) {
  return jid.endsWith('@g.us');
}

function getSenderNumber(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

// ─── Handler Command ──────────────────────────────────────────────────────────
async function handleRegist(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const senderNum = senderJid.split('@')[0];

  if (players[senderNum]) {
    const char = CHARACTERS[players[senderNum].character];
    return await sock.sendMessage(jid, {
      text: `⚠️ Kau sudah terdaftar!\n\n` +
        `${char.emoji} *${char.name}*\n` +
        `└ ${char.title}\n\n` +
        `Gunakan *.start* untuk memulai petualangan!`
    });
  }

  // Cek karakter yang sudah dipakai
  const usedChars = Object.values(players).map(p => p.character);
  const availableChars = Object.keys(CHARACTERS).filter(c => !usedChars.includes(c));

  if (availableChars.length === 0) {
    return await sock.sendMessage(jid, {
      text: `❌ Maaf, semua karakter sudah terpakai!\n` +
        `Slot pemain sudah penuh (10/10).\n\n` +
        `Tunggu ada pemain yang keluar.`
    });
  }

  const chosenKey = availableChars[Math.floor(Math.random() * availableChars.length)];
  const char = CHARACTERS[chosenKey];

  players[senderNum] = {
    character: chosenKey,
    hp: char.hp,
    maxHp: char.hp,
    beli: 0,
    treasures: [],
    kills: 0,
    location: LOCATIONS[0],
    adventure: false,
    currentEnemy: null,
    joinedAt: Date.now()
  };

  saveDB(players, gamestate);

  await sock.sendMessage(jid, {
    text:
      `🏴‍☠️ *SELAMAT BERGABUNG DI BAJAK LAUT TOPI JERAMI!* 🏴‍☠️\n\n` +
      `Hei bajak laut baru! Bot telah memilih karaktermu secara acak:\n\n` +
      `╔══════════════════════╗\n` +
      `║  ${char.emoji} *${char.name}*\n` +
      `║  _${char.title}_\n` +
      `╠══════════════════════╣\n` +
      `║ ❤️ HP    : ${char.hp}\n` +
      `║ ⚔️ ATK   : ${char.atk}\n` +
      `║ 🛡️ DEF   : ${char.def}\n` +
      `║ 💥 Power : ${char.power}\n` +
      `╠══════════════════════╣\n` +
      `║ 📖 ${char.desc}\n` +
      `╚══════════════════════╝\n\n` +
      `🎯 Skill: ${char.skills.join(', ')}\n\n` +
      `Gunakan *.start* untuk memulai petualangan mencari *ONE PIECE* di Grand Line! ⚓`
  });
}

async function handleStart(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const senderNum = senderJid.split('@')[0];

  if (!players[senderNum]) {
    return await sock.sendMessage(jid, {
      text: `❌ Kamu belum terdaftar!\nGunakan *.regist* untuk mendaftar dulu.`
    });
  }

  const player = players[senderNum];

  if (player.hp <= 0) {
    player.hp = CHARACTERS[player.character].hp;
    player.currentEnemy = null;
    player.adventure = false;
  }

  const char = CHARACTERS[player.character];
  const enemy = getRandomEnemy();
  const location = getRandomLocation();

  player.adventure = true;
  player.currentEnemy = { ...enemy, currentHp: enemy.hp };
  player.location = location;
  saveDB(players, gamestate);

  await sock.sendMessage(jid, {
    text:
      `⚓ *PETUALANGAN DIMULAI!* ⚓\n\n` +
      `${char.emoji} *${char.name}* berlayar ke ${location}!\n\n` +
      `🗺️ *Misi:* Cari harta karun tersembunyi ONE PIECE!\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💀 *MUSUH MUNCUL!*\n` +
      `${enemy.name}\n` +
      `└ ❤️ HP    : ${enemy.hp}\n` +
      `└ ⚔️ ATK   : ${enemy.atk}\n` +
      `└ 💰 Reward: ${enemy.reward.toLocaleString()} Beli\n` +
      `└ 🏆 Loot  : ${enemy.loot}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Gunakan *.attack* untuk menyerang!\n` +
      `Status: ❤️ ${player.hp}/${char.hp} HP`
  });
}

async function handleAttack(sock, jid, senderJid, db) {
  const { players, gamestate } = db;
  const senderNum = senderJid.split('@')[0];

  if (!players[senderNum]) {
    return await sock.sendMessage(jid, {
      text: `❌ Kamu belum terdaftar!\nGunakan *.regist* untuk mendaftar dulu.`
    });
  }

  const player = players[senderNum];

  if (!player.adventure || !player.currentEnemy) {
    return await sock.sendMessage(jid, {
      text: `⚠️ Kamu tidak sedang dalam petualangan!\nGunakan *.start* untuk memulai dulu.`
    });
  }

  if (player.hp <= 0) {
    return await sock.sendMessage(jid, {
      text: `💀 HP kamu 0! Gunakan *.start* untuk memulai ulang petualangan.`
    });
  }

  const char = CHARACTERS[player.character];
  const enemy = player.currentEnemy;

  // Hitung damage dengan sedikit randomness
  const playerDmg = Math.floor(char.atk * (0.8 + Math.random() * 0.4));
  const enemyDmg = Math.max(0, Math.floor(enemy.atk * (0.8 + Math.random() * 0.4) - char.def * 0.3));
  const skill = char.skills[Math.floor(Math.random() * char.skills.length)];

  enemy.currentHp -= playerDmg;
  player.hp -= enemyDmg;
  if (player.hp < 0) player.hp = 0;

  let battleLog =
    `⚔️ *PERTARUNGAN!*\n\n` +
    `${char.emoji} ${char.name} menggunakan *${skill}*!\n` +
    `💥 Damage ke ${enemy.name}: *-${playerDmg} HP*\n` +
    `🩸 ${enemy.name} menyerang balik: *-${enemyDmg} HP*\n\n`;

  if (enemy.currentHp <= 0) {
    // Musuh kalah
    player.beli += enemy.reward;
    player.kills += 1;
    player.treasures.push(enemy.loot);
    player.adventure = false;
    player.currentEnemy = null;

    // Cek apakah sudah kumpulkan One Piece
    const hasOnePiece = player.treasures.includes('One Piece Map Fragment') &&
      player.treasures.length >= 5;

    saveDB(players, gamestate);

    if (hasOnePiece) {
      battleLog +=
        `🎉 *${enemy.name} DIKALAHKAN!*\n\n` +
        `╔══════════════════════╗\n` +
        `║  🏆 REWARD DIDAPAT!\n` +
        `║  💰 +${enemy.reward.toLocaleString()} Beli\n` +
        `║  📜 Loot: ${enemy.loot}\n` +
        `╚══════════════════════╝\n\n` +
        `🌟✨🏴‍☠️ *ONE PIECE DITEMUKAN!!!* 🏴‍☠️✨🌟\n\n` +
        `${char.emoji} *${char.name}* telah menemukan harta karun\n` +
        `legendaris ONE PIECE di ujung Grand Line!\n\n` +
        `👑 *${char.name} adalah RAJA BAJAK LAUT!* 👑\n\n` +
        `Total Beli: ${player.beli.toLocaleString()}\n` +
        `Total Kill: ${player.kills}\n` +
        `Harta: ${player.treasures.length} item`;
    } else {
      battleLog +=
        `💀 *${enemy.name} DIKALAHKAN!*\n\n` +
        `╔══════════════════════╗\n` +
        `║  🏆 REWARD DIDAPAT!\n` +
        `║  💰 +${enemy.reward.toLocaleString()} Beli\n` +
        `║  📜 Loot: ${enemy.loot}\n` +
        `╚══════════════════════╝\n\n` +
        `Status ${char.name}:\n` +
        `└ ❤️ HP: ${player.hp}/${char.hp}\n` +
        `└ 💰 Beli: ${player.beli.toLocaleString()}\n` +
        `└ 🎒 Harta: ${player.treasures.length} item\n\n` +
        `Gunakan *.start* untuk mencari musuh berikutnya! 🗺️`;
    }
  } else if (player.hp <= 0) {
    // Player kalah
    player.adventure = false;
    player.currentEnemy = null;
    saveDB(players, gamestate);

    battleLog +=
      `💀 *KAMU PINGSAN!*\n\n` +
      `${enemy.name} masih memiliki *${enemy.currentHp} HP*.\n\n` +
      `${char.name} jatuh pingsan di ${player.location}...\n` +
      `HP dipulihkan ke penuh. Gunakan *.start* untuk coba lagi!`;
  } else {
    // Pertarungan lanjut
    saveDB(players, gamestate);

    battleLog +=
      `Status Pertarungan:\n` +
      `${char.emoji} ${char.name}: ❤️ ${player.hp}/${char.hp} HP\n` +
      `${enemy.name}: ❤️ ${enemy.currentHp}/${enemy.hp} HP\n\n` +
      `Gunakan *.attack* lagi untuk melanjutkan!`;
  }

  await sock.sendMessage(jid, { text: battleLog });
}

// ─── Main Bot Function ────────────────────────────────────────────────────────
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['OnePieceRPG-Bot', 'Chrome', '1.0.0']
  });

  // ─── Pairing Code ───────────────────────────────────────────────────────────
  if (!sock.authState.creds.registered) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('📱 Masukkan nomor WhatsApp (format: 628xxx): ', async (number) => {
      rl.close();
      try {
        const code = await sock.requestPairingCode(number.trim());
        console.log(`\n🔑 Pairing Code kamu: \x1b[32m\x1b[1m${code}\x1b[0m`);
        console.log('📲 Buka WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Masukkan kode\n');
      } catch (e) {
        console.error('❌ Gagal mendapatkan pairing code:', e.message);
        process.exit(1);
      }
    });
  }

  // ─── Connection Update ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('\n✅ \x1b[32mBot ONE PIECE RPG berhasil terhubung!\x1b[0m');
      console.log('🏴‍☠️ Siap berlayar di Grand Line!\n');
    } else if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error instanceof Boom &&
        lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('🔄 Mencoba reconnect...');
        startBot();
      } else {
        console.log('❌ Bot terputus. Jalankan ulang.');
        process.exit(0);
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ─── Message Handler ─────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      const isGroup = isGroupJid(jid);

      // Kalau private chat → cukup read, tidak merespons
      if (!isGroup) {
        await sock.readMessages([msg.key]);
        continue;
      }

      const senderJid = getSenderNumber(msg);
      const body =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      const text = body.trim().toLowerCase();
      if (!text.startsWith('.')) continue;

      const db = loadDB();

      try {
        if (text === '.regist') {
          await handleRegist(sock, jid, senderJid, db);
        } else if (text === '.start') {
          await handleStart(sock, jid, senderJid, db);
        } else if (text === '.attack') {
          await handleAttack(sock, jid, senderJid, db);
        }
      } catch (err) {
        console.error('❌ Error handler:', err.message);
      }
    }
  });
}

// ─── Start ────────────────────────────────────────────────────────────────────
console.log('\n🏴‍☠️ ===================================== 🏴‍☠️');
console.log('      ONE PIECE RPG WhatsApp Bot');
console.log('      Mencari Harta Karun di Grand Line');
console.log('🏴‍☠️ ===================================== 🏴‍☠️\n');
startBot().catch(console.error);
