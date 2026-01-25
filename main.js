const mineflayer = require('mineflayer');
const readline = require('readline');
const net = require('net'); // Used to ping the server

const BOT_CONFIG = {
  host: '185.207.166.12', // DIRECT IP (More reliable than minegens.id)
  port: 25565,
  username: 'ws_lv',
  version: '1.20.1',
  auth: 'offline',
  viewDistance: 'tiny',
  // --- ANTI-LAG SETTINGS ---
  checkTimeoutInterval: 90 * 1000, // Wait 90s before giving up on a frozen connection
};

let bot;
let isJoining = false;
let jumpInterval = null;
let safetyCheck = null;
let reconnectTimeout = null;
let retryDelay = 5000;

function getT() {
  const now = new Date();
  return `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
}

// --- NEW: CHECK CONNECTION BEFORE STARTING ---
function checkServerStatus(cb) {
  console.log(`${getT()} [NETWORK] >>> Pinging server IP...`);
  const sock = new net.Socket();
  sock.setTimeout(5000); // 5 second timeout for ping
  
  sock.on('connect', () => {
    console.log(`${getT()} [NETWORK] >>> Server is REACHABLE. Starting bot...`);
    sock.destroy();
    cb(true);
  });
  
  sock.on('error', (err) => {
    console.log(`${getT()} [NETWORK] !!! Ping Failed: ${err.code}`);
    sock.destroy();
    cb(false);
  });
  
  sock.on('timeout', () => {
    console.log(`${getT()} [NETWORK] !!! Ping Timed Out (No Internet?)`);
    sock.destroy();
    cb(false);
  });

  sock.connect(25565, '185.207.166.12');
}

function createBot() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  
  // Step 1: Check if we can even reach the server
  checkServerStatus((isOnline) => {
    if (!isOnline) {
      // If ping fails, wait 30s and try again (Don't crash the bot)
      console.log(`${getT()} [SYSTEM] >>> Waiting for better signal (30s)...`);
      retryDelay = 30000;
      reconnectTimeout = setTimeout(createBot, retryDelay);
      return;
    }

    // Step 2: Start the bot
    console.log(`${getT()} [SYSTEM] >>> Signal found. Connecting...`);
    
    bot = mineflayer.createBot(BOT_CONFIG);

    bot.on('end', (reason) => {
      console.log(`${getT()} [SYSTEM] !!! DISCONNECTED: ${reason}`);
      cleanup();
      retryDelay = Math.min(retryDelay + 10000, 120000); // Max wait 2 minutes
      reconnectTimeout = setTimeout(createBot, retryDelay);
    });

    bot.on('error', (err) => {
      if (['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(err.code)) {
        // Quietly handle network errors
      } else {
        console.log(`${getT()} [DEBUG] Error: ${err.message}`);
      }
    });

    bot.once('spawn', async () => {
      console.log(`${getT()} [BOT] >>> Connected & Spawned!`);
      retryDelay = 5000; 
      
      await new Promise(r => setTimeout(r, 2000));
      bot.chat('/login woylah12');
      
      // Stop the server from spamming your data with Action Bar updates
      bot.chat('/actionhealth toggle'); 

      await new Promise(r => setTimeout(r, 6000));
      if (!isJoining) joinRealm();
      
      startSafetyLoop();
    });

    bot.on('messagestr', (message) => {
      // Filter out the "Heart/Star" spam from logs
      if (message.includes('❤') || message.includes('★')) return;
      if (message.trim()) console.log(`${getT()} [SERVER] ${message}`);
    });
  });
}

function cleanup() {
  isJoining = false;
  if (jumpInterval) clearInterval(jumpInterval);
  if (safetyCheck) clearInterval(safetyCheck);
  jumpInterval = null;
  safetyCheck = null;
}

function startSafetyLoop() {
  if (safetyCheck) clearInterval(safetyCheck);
  safetyCheck = setInterval(() => {
    if (!bot || !bot.inventory) return;
    const item = bot.inventory.slots[36];
    if (item && item.name === 'clock' && !isJoining) {
        console.log(`${getT()} [SAFETY] >>> Detected Lobby. Re-joining...`);
        joinRealm();
    }
  }, 60000);
}

async function joinRealm() {
  if (isJoining || !bot) return;
  isJoining = true;

  try {
    bot.setQuickBarSlot(0); 
    await new Promise(r => setTimeout(r, 2000));

    let windowOpened = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (windowOpened || !bot) break;

      console.log(`${getT()} [JOIN] >>> Attempt ${attempt}: Opening Menu...`);
      const windowPromise = new Promise((resolve) => {
        const listener = (window) => {
          bot.removeListener('windowOpen', listener);
          windowOpened = true; resolve(window);
        };
        bot.once('windowOpen', listener);
        setTimeout(() => { bot.removeListener('windowOpen', listener); resolve(null); }, 5000);
      });

      if (bot.activateItem) bot.activateItem(); 
      const window = await windowPromise;

      if (window) {
        console.log(`${getT()} [JOIN] >>> Clicking Slot 19...`);
        await new Promise(r => setTimeout(r, 1500));
        await bot.clickWindow(19, 0, 0);
        await new Promise(r => setTimeout(r, 10000));
        isJoining = false;
        return;
      }
    }
    isJoining = false;
  } catch (err) {
    isJoining = false;
  }
}

function toggleJump() {
  if (jumpInterval) {
    clearInterval(jumpInterval); jumpInterval = null;
    if (bot) bot.setControlState('jump', false);
    console.log(`${getT()} [BOT] >>> Jump: OFF`);
  } else {
    console.log(`${getT()} [BOT] >>> Jump: ON`);
    jumpInterval = setInterval(() => {
      if (!bot || !bot.entity) return;
      bot.setControlState('jump', true);
      setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 100);
    }, 2000);
  }
}

createBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const input = line.trim();
  if (input === 'join') joinRealm();
  else if (input === 'jump') toggleJump();
  else if (bot && bot.entity) bot.chat(input);
});

