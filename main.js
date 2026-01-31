const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

const GLOBAL_CONFIG = {
  host: '185.207.166.12',
  port: 25565,
  version: '1.20.1',
  password: 'woylah12',
  targetPlayer: 'ditnshyky'
};

const ACCOUNTS = ['ws_lv', 'dawg'];
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
    
    setTimeout(() => this.connect(), index * 10000);
  }

  connect() {
    this.status = 'Connecting...';
    this.bot = mineflayer.createBot({
      host: GLOBAL_CONFIG.host,
      port: GLOBAL_CONFIG.port,
      username: this.username,
      version: GLOBAL_CONFIG.version,
      auth: 'offline'
    });

    this.bot.once('spawn', async () => {
      this.status = 'In Lobby';
      addWebLog(this.username, "Spawned. Authenticating...");
      
      await new Promise(r => setTimeout(r, 2000));
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await new Promise(r => setTimeout(r, 1000));
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      // Anti-AFK jump
      this.bot.setControlState('jump', true);
      setTimeout(() => this.bot.setControlState('jump', false), 500);

      // Start the join loop
      this.startJoinLoop();
    });

    this.bot.on('messagestr', (msg) => {
      if (msg.includes('❤') || msg.includes('★')) return;
      addWebLog(this.username, `MSG: ${msg.trim()}`);
      
      if (msg.toLowerCase().includes('position')) {
        this.status = 'In Queue';
        this.isQueued = true;
      }
      if (msg.toLowerCase().includes('welcome')) {
        this.status = 'In-Game';
        this.isQueued = false;
      }
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isQueued = false;
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 30000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `Error: ${err.code}`));
  }

  async startJoinLoop() {
    if (this.status === 'In-Game' || this.isQueued) return;

    const tryClick = async () => {
      if (this.status === 'In-Game' || this.isQueued || !this.bot) return;
      
      addWebLog(this.username, "Trying to join Realm...");
      this.bot.setQuickBarSlot(0); 
      await new Promise(r => setTimeout(r, 500));
      this.bot.activateItem(); 
    };

    // Listen for window
    this.bot.on('windowOpen', async (window) => {
      addWebLog(this.username, "Menu opened! Clicking slot 19...");
      await this.bot.clickWindow(19, 0, 0);
    });

    // Try every 15 seconds until we are in-game or queued
    this.joinInterval = setInterval(() => {
      if (this.status === 'In-Game' || this.isQueued) {
        clearInterval(this.joinInterval);
      } else {
        tryClick();
      }
    }, 15000);
  }

  tpa() {
    if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`);
  }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD ---
app.get('/', (req, res) => {
  let botRows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td><strong>${bots[name].status}</strong></td>
      <td><button onclick="fetch('/tpa/${name}')">TPA</button></td>
    </tr>`).join('');

  res.send(`
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; background: #1a1a1a; color: #eee; padding: 20px; }
          table { width: 100%; border: 1px solid #444; margin-bottom: 20px; }
          td, th { padding: 10px; border: 1px solid #444; }
          .logs { background: #000; padding: 10px; height: 200px; overflow-y: scroll; font-family: monospace; font-size: 12px; border: 2px solid #333; }
          button { background: #007bff; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Bot Dashboard</h2>
        <table>
          <tr><th>Bot</th><th>Status</th><th>Action</th></tr>
          ${botRows}
        </table>
        <button onclick="fetch('/tpa-all')" style="background:#28a745">TPA ALL</button>
        <h3>Live Logs</h3>
        <div class="logs">${webLogs.join('<br>')}</div>
        <script>setTimeout(() => location.reload(), 5000);</script>
      </body>
    </html>
  `);
});

app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.send('ok'); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.send('ok'); });

app.listen(port, () => console.log(`Dashboard on port ${port}`));

