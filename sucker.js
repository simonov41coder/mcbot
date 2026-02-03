const mineflayer = require('mineflayer');

const CONFIG = {
  host: '185.207.166.12',
  port: 25565,
  version: '1.20.1',
  username: 'dogyy',
  password: 'woylah12',
  joinSlot: 20 // Updated to 20 as requested
};

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  version: CONFIG.version,
  auth: 'offline'
});

console.log(`[Status] Connecting to ${CONFIG.host}...`);

bot.once('spawn', async () => {
  console.log('[Status] Spawned in lobby. Authenticating...');
  
  // Auth Sequence
  await wait(2000);
  bot.chat(`/register ${CONFIG.password}`);
  await wait(1000);
  bot.chat(`/login ${CONFIG.password}`);
  
  // Start the join attempts
  const joinAttempt = setInterval(async () => {
    // 1. Check if we are still in the lobby (look for clock in hotbar)
    const hotbar = bot.inventory.slots.slice(36, 45);
    const clock = hotbar.find(i => i && i.name.includes('clock'));

    if (!clock) {
      // If no clock is found, we might have successfully joined.
      // We check for a grass block or a change in surroundings.
      const pos = bot.entity.position;
      if (pos.y !== 0) { // Simple check to see if we've spawned in a world
        console.log(`[SUCCESS] Joined Realm!`);
        console.log(`[LOCATION] X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}, Z: ${pos.z.toFixed(1)}`);
        
        clearInterval(joinAttempt);
        console.log('[Status] Mission complete. Quitting...');
        bot.quit();
        process.exit();
      }
      return;
    }

    // 2. Interaction Logic
    if (bot.currentWindow) {
      console.log(`[Status] Menu open. Clicking slot ${CONFIG.joinSlot}...`);
      bot.clickWindow(CONFIG.joinSlot, 0, 0);
    } else {
      // Select the clock and right-click
      const slotIndex = bot.inventory.slots.indexOf(clock) - 36;
      bot.setQuickBarSlot(slotIndex);
      bot.activateItem();
      console.log('[Status] Opening Realm Selector...');
    }
  }, 5000);
});

bot.on('messagestr', (msg) => {
    if (msg.trim().length > 0) console.log(`[Chat] ${msg}`);
});

bot.on('error', (err) => console.log(`[Error] ${err.message}`));
bot.on('end', (reason) => console.log(`[Status] Disconnected: ${reason}`));

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

