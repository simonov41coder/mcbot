const mineflayer = require('mineflayer');
const readline = require('readline');

const BOT_CONFIG = {
  host: 'minegens.id',
  port: 25565,
  username: 'ws_lv',
  version: '1.20.1',
  auth: 'offline'
};

let bot;
let isJoining = false;
let jumpInterval = null;

function createBot() {
  console.log('[SYSTEM] >>> Initializing Mineflayer Instance...');
  bot = mineflayer.createBot(BOT_CONFIG);

  // --- RECONNECT LOGIC ---
  bot.on('end', (reason) => {
    console.log(`[SYSTEM] !!! CONNECTION LOST: ${reason}. Reconnecting in 5s...`);
    isJoining = false;
    if (jumpInterval) clearInterval(jumpInterval); 
    setTimeout(createBot, 5000);
  });

  bot.on('kicked', (reason) => console.log('[SYSTEM] !!! KICKED:', reason));
  bot.on('error', (err) => console.log('[DEBUG] Error:', err.code || err.message));

  // --- HARD-CODED SPAWN LOGIC ---
  bot.once('spawn', async () => {
    console.log(`[BOT] >>> Spawned. Executing Hard-Coded Login...`);
    
    // Wait 2s then Login
    await new Promise(r => setTimeout(r, 2000));
    console.log('[AUTH] >>> Sending Command: /login woylah12');
    bot.chat('/login woylah12');

    // Wait 6s for login to settle
    console.log('[LOBBY] >>> Waiting 6s for login processing...');
    await new Promise(r => setTimeout(r, 6000));

    if (!isJoining) joinRealm();
  });

  bot.on('messagestr', (message) => {
    if (message.trim()) console.log(`[SERVER] ${message}`);
  });
}

// --- JUMP LOGIC ---
function toggleJump() {
  if (jumpInterval) {
    clearInterval(jumpInterval);
    jumpInterval = null;
    bot.setControlState('jump', false);
    console.log('[BOT] >>> Jump loop: DISABLED');
  } else {
    console.log('[BOT] >>> Jump loop: ENABLED');
    jumpInterval = setInterval(() => {
      if (!bot) return;
      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 100);
    }, 1000);
  }
}

// --- JOIN SEQUENCE ---
async function joinRealm() {
  if (isJoining) return;
  isJoining = true;

  try {
    console.log('[JOIN] >>> Phase 1: Selecting Slot 1...');
    bot.setQuickBarSlot(0); 
    await new Promise(r => setTimeout(r, 2000));

    let windowOpened = false;
    
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (windowOpened) break;

      console.log(`[JOIN] >>> Phase 2: Right-Click Attempt ${attempt}/3...`);
      const windowPromise = new Promise((resolve) => {
        const listener = (window) => {
          bot.removeListener('windowOpen', listener);
          windowOpened = true;
          resolve(window);
        };
        bot.once('windowOpen', listener);
        setTimeout(() => { bot.removeListener('windowOpen', listener); resolve(null); }, 4000);
      });

      bot.activateItem(); 
      const window = await windowPromise;

      if (window) {
        console.log(`[JOIN] >>> Phase 3: UI Opened. Clicking Slot 19...`);
        await new Promise(r => setTimeout(r, 1500));
        await bot.clickWindow(19, 0, 0);
        console.log('[JOIN] >>> Click Sent. Process Complete.');
        
        // Lock join state for 10s to prevent spamming during teleport
        setTimeout(() => { isJoining = false; }, 10000);
        break;
      }
    }

    if (!windowOpened) {
      console.log('[JOIN] !!! Menu timeout. Retrying in 10s...');
      isJoining = false;
      setTimeout(joinRealm, 10000);
    }

  } catch (err) {
    console.log(`[JOIN-ERROR] ${err.message}`);
    isJoining = false;
  }
}

createBot();

// Console Interface
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const input = line.trim().toLowerCase();
  if (input === 'join') {
    joinRealm();
  } else if (input === 'jump') {
    toggleJump();
  } else if (input === 'pos') {
    const p = bot.entity.position;
    console.log(`[DEBUG] Position: X:${p.x.toFixed(1)} Y:${p.y.toFixed(1)} Z:${p.z.toFixed(1)}`);
  } else {
    bot.chat(line);
  }
});

