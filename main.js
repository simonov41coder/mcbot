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
let safetyCheck = null;
let reconnectTimeout = null;
let retryDelay = 5000;

// --- HELPER: GET CURRENT TIME ---
function getT() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  return `[${h}:${m}:${s}]`;
}

function createBot() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  
  console.log(`${getT()} [SYSTEM] >>> Attempting Connection (Retry Delay: ${retryDelay/1000}s)...`);
  
  bot = mineflayer.createBot(BOT_CONFIG);

  // --- RECONNECT LOGIC ---
  bot.on('end', (reason) => {
    console.log(`${getT()} [SYSTEM] !!! CONNECTION LOST: ${reason}`);
    cleanup();
    retryDelay = Math.min(retryDelay + 5000, 60000); 
    reconnectTimeout = setTimeout(createBot, retryDelay);
  });

  bot.on('kicked', (reason) => {
    const reasonText = JSON.stringify(reason);
    console.log(`${getT()} [SYSTEM] !!! KICKED: ${reasonText}`);
    if (reasonText.includes("Proxy")) retryDelay = 30000;
  });

  bot.on('error', (err) => {
    console.log(`${getT()} [DEBUG] Error [${err.code}]: ${err.message}`);
  });

  // --- PERSISTENT JOIN LOGIC ---
  bot.once('spawn', async () => {
    console.log(`${getT()} [BOT] >>> Spawned successfully.`);
    retryDelay = 5000; 
    
    await new Promise(r => setTimeout(r, 3000));
    bot.chat('/login woylah12');
    console.log(`${getT()} [AUTH] >>> Login command sent.`);

    await new Promise(r => setTimeout(r, 7000));
    if (!isJoining) joinRealm();
    
    startSafetyLoop();
  });

  bot.on('messagestr', (message) => {
    if (message.trim()) console.log(`${getT()} [SERVER] ${message}`);
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

    const clock = bot.inventory.slots[36];
    if (clock && clock.name === 'clock' && !isJoining) {
        console.log(`${getT()} [SAFETY] >>> Found Clock in hotbar. Still in Lobby. Re-joining...`);
        joinRealm();
    }
  }, 30000);
}

async function joinRealm() {
  if (isJoining) return;
  isJoining = true;

  try {
    console.log(`${getT()} [JOIN] >>> Selecting Hotbar 1...`);
    bot.setQuickBarSlot(0); 
    await new Promise(r => setTimeout(r, 2500));

    let windowOpened = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      if (windowOpened || !bot) break;

      console.log(`${getT()} [JOIN] >>> Attempt ${attempt}: Right-clicking clock...`);
      
      const windowPromise = new Promise((resolve) => {
        const listener = (window) => {
          bot.removeListener('windowOpen', listener);
          windowOpened = true;
          resolve(window);
        };
        bot.once('windowOpen', listener);
        setTimeout(() => { bot.removeListener('windowOpen', listener); resolve(null); }, 5000);
      });

      bot.activateItem(); 
      const window = await windowPromise;

      if (window) {
        console.log(`${getT()} [JOIN] >>> Menu "${window.title}" opened. Clicking Slot 19...`);
        await new Promise(r => setTimeout(r, 2000));
        await bot.clickWindow(19, 0, 0);
        console.log(`${getT()} [JOIN] >>> Click sent.`);
        
        await new Promise(r => setTimeout(r, 10000)); 
        isJoining = false;
        return;
      }
    }
    isJoining = false;
  } catch (err) {
    console.log(`${getT()} [JOIN-ERROR] ${err.message}`);
    isJoining = false;
  }
}

// --- JUMP LOGIC ---
function toggleJump() {
  if (jumpInterval) {
    clearInterval(jumpInterval);
    jumpInterval = null;
    bot.setControlState('jump', false);
    console.log(`${getT()} [BOT] >>> Jump: OFF`);
  } else {
    console.log(`${getT()} [BOT] >>> Jump: ON`);
    jumpInterval = setInterval(() => {
      if (!bot) return;
      bot.setControlState('jump', true);
      setTimeout(() => { if (bot) bot.setControlState('jump', false); }, 100);
    }, 1000);
  }
}

createBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const input = line.trim().toLowerCase();
  if (input === 'join') joinRealm();
  else if (input === 'jump') toggleJump();
  else if (input === 'inv') console.log(`${getT()} [INV] ` + bot.inventory.items().map(i => `${i.name}`).join(', '));
  else bot.chat(line);
});

