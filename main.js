const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// --- CONFIGURATION ---
const GLOBAL_CONFIG = {
  host: '185.207.166.12',
  port: 25565,
  version: '1.20.1',
  password: 'woylah12',
  targetPlayer: 'ditnshyky'
};

const ACCOUNTS = ['ws_lv', 'dawg', 'yakk1k']; 
const bots = {};
let webLogs = [];

function addWebLog(name, msg) {
  const entry = `[${new Date().toLocaleTimeString()}] [${name}] ${msg}`;
  console.log(entry);
  webLogs.unshift(entry);
  if (webLogs.length > 50) webLogs.pop();
}

class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    this.isQueued = false;
    this.joinInterval = null;
    this.afkInterval = null;
    
    // Stagger start to prevent crash
    setTimeout(() => this.connect(), index * 8000);
  }

  connect() {
    if (this.joinInterval) clearInterval(this.joinInterval);
    if (this.afkInterval) clearInterval(this.afkInterval);

    this.status = 'Connecting...';
    this.bot = mineflayer.createBot({
      host: GLOBAL_CONFIG.host,
      port: GLOBAL_CONFIG.port,
      username: this.username,
      version: GLOBAL_CONFIG.version,
      auth: 'offline',
      checkTimeoutInterval: 90000
    });

    this.bot.once('spawn', async () => {
      this.status = 'Lobby (Auth)';
      addWebLog(this.username, "Spawned. Running Auth...");

      // 1. Anti-AFK (Look around randomly)
      this.startAfkMovements();

      // 2. Auth Sequence
      await this.wait(2000);
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await this.wait(1500);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      // 3. Start the "Escaping Lobby" Logic
      this.status = 'Lobby (Joining)';
      setTimeout(() => this.forceJoinRealm(), 3000);
    });

    this.bot.on('messagestr', (msg) => {
      if (msg.includes('❤') || msg.includes('★')) return;
      
      // Detection: Queue
      const queueMatch = msg.match(/position (\d+) of/);
      if (queueMatch) {
        this.isQueued = true;
        const pos = parseInt(queueMatch[1]);
        this.status = `Queued (${pos})`;
        
        // If we are in queue, STOP clicking the clock!
        if (this.joinInterval) clearInterval(this.joinInterval);

        if (pos > 10) {
            addWebLog(this.username, `Queue high (${pos}). Disconnecting temporarily.`);
            this.bot.quit(); // Save resources
            setTimeout(() => this.connect(), pos * 15000);
        }
      }
      
      // Detection: In Game
      if (msg.toLowerCase().includes('welcome') || msg.toLowerCase().includes('teleport')) {
        this.status = 'In-Game';
        this.isQueued = false;
        if (this.joinInterval) clearInterval(this.joinInterval);
        addWebLog(this.username, "SUCCESS: Entered Realm!");
      }
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isQueued = false;
      addWebLog(this.username, `Disconnected: ${reason}`);
      if (this.joinInterval) clearInterval(this.joinInterval);
      if (this.afkInterval) clearInterval(this.afkInterval);
      
      // Reconnect faster if it was a kick
      setTimeout(() => this.connect(), 20000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `Error: ${err.message}`));
  }

  // --- THE NEW LOGIC FOR STUCK BOTS ---
  forceJoinRealm() {
    if (this.joinInterval) clearInterval(this.joinInterval);

    // Try to join every 6 seconds until successful
    this.joinInterval = setInterval(async () => {
      if (this.status === 'In-Game' || this.isQueued || !this.bot) {
        clearInterval(this.joinInterval);
        return;
      }

      addWebLog(this.username, "Attempting to open Server Menu...");

      // Step 1: Search for Clock
      const clock = this.bot.inventory.items().find(item => item.name.includes('clock'));
      
      if (!clock) {
        addWebLog(this.username, "Warning: No Clock found yet. Waiting for inventory...");
        return;
      }

      // Step 2: Equip and Activate
      try {
        await this.bot.equip(clock, 'hand');
        this.bot.activateItem(); // Right click
      } catch (e) {
        // Ignore equip errors
      }

      // Step 3: Wait specifically for window
      try {
        const window = await this.bot.waitForTicks(20).then(() => this.bot.currentWindow);
        if (window) {
             addWebLog(this.username, "Menu Detected! Clicking Slot 19...");
             await this.bot.clickWindow(19, 0, 0);
             // Verify click
             await this.wait(1000);
             this.bot.closeWindow(window);
        }
      } catch (err) {
        addWebLog(this.username, "Menu didn't open. Retrying...");
      }

    }, 6000); // Repeat every 6 seconds
  }

  startAfkMovements() {
    this.afkInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) return;
      // Randomly look around to prevent "Anti-AFK" kick
      const yaw = Math.random() * Math.PI - (0.5 * Math.PI);
      const pitch = Math.random() * Math.PI - (0.5 * Math.PI);
      this.bot.look(yaw, pitch);
    }, 3000);
  }

  tpa() {
    if (this.bot) {
        this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`);
        return "Sent TPA";
    }
    return "Bot offline";
  }

  wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

// Start Bots
ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- WEB DASHBOARD ---
app.get('/', (req, res) => {
  let rows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td style="color:${bots[name].status === 'In-Game' ? '#28a745' : '#ffc107'}">
        <strong>${bots[name].status}</strong>
      </td>
      <td><button onclick="fetch('/tpa/${name}')">TPA</button></td>
    </tr>`).join('');

  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; background: #121212; color: #fff; padding: 15px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { padding: 10px; border: 1px solid #333; text-align: left; }
          button { padding: 8px 12px; border-radius: 4px; border: none; background: #007bff; color: white; cursor: pointer; }
          .logs { background: #000; height: 300px; overflow-y: scroll; padding: 10px; font-family: monospace; font-size: 11px; border: 1px solid #444; }
        </style>
      </head>
      <body>
        <h3>Bot Commander</h3>
        <table>
          <tr><th>Bot</th><th>Status</th><th>Action</th></tr>
          ${rows}
        </table>
        <button onclick="fetch('/tpa-all')" style="background:#28a745; width:100%; padding: 15px;">TPA ALL BOTS</button>
        <br><br>
        <strong>Live Logs:</strong>
        <div class="logs">${webLogs.join('<br>')}</div>
        <script>
            setInterval(() => window.location.reload(), 5000);
        </script>
      </body>
    </html>
  `);
});

app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.sendStatus(200); });

app.listen(port, () => console.log(`Worker running on ${port}`));

