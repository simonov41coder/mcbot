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

const ACCOUNTS = ['ws_lv', 'sr41', 'penguras_money']; 
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
      auth: 'offline'
    });

    this.bot.once('spawn', async () => {
      this.status = 'Lobby (Auth)';
      this.startAfkMovements();

      await this.wait(2000);
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await this.wait(1500);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      this.status = 'Lobby (Joining)';
      setTimeout(() => this.forceJoinRealm(), 3000);
    });

    this.bot.on('messagestr', (msg) => {
      if (msg.includes('❤') || msg.includes('★')) return;
      
      const queueMatch = msg.match(/position (\d+) of/);
      if (queueMatch) {
        this.isQueued = true;
        this.status = `Queued (${queueMatch[1]})`;
        if (this.joinInterval) clearInterval(this.joinInterval);
      }
      
      if (msg.toLowerCase().includes('welcome') || msg.toLowerCase().includes('teleport')) {
        this.status = 'In-Game';
        this.isQueued = false;
        if (this.joinInterval) clearInterval(this.joinInterval);
      }
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 20000);
    });
  }

  // --- RAW INPUT FUNCTION ---
  sendRawChat(msg) {
    if (this.bot) {
      this.bot.chat(msg);
      addWebLog(this.username, `Sent: ${msg}`);
    }
  }

  forceJoinRealm() {
    if (this.joinInterval) clearInterval(this.joinInterval);
    this.joinInterval = setInterval(async () => {
      if (this.status === 'In-Game' || this.isQueued || !this.bot) return;

      const clock = this.bot.inventory.items().find(item => item.name.includes('clock'));
      if (!clock) return;

      try {
        await this.bot.equip(clock, 'hand');
        this.bot.activateItem(); 
        const window = await this.bot.waitForTicks(20).then(() => this.bot.currentWindow);
        if (window) {
             await this.bot.clickWindow(19, 0, 0);
             await this.wait(1000);
             this.bot.closeWindow(window);
        }
      } catch (e) {}
    }, 8000);
  }

  startAfkMovements() {
    this.afkInterval = setInterval(() => {
      if (this.bot?.entity) {
        this.bot.look(Math.random() * 3, Math.random() * 3);
      }
    }, 5000);
  }

  tpa() { if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- WEB DASHBOARD ---
app.get('/', (req, res) => {
  let rows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td style="color:${bots[name].status === 'In-Game' ? '#28a745' : '#ffc107'}"><b>${bots[name].status}</b></td>
      <td>
        <button onclick="fetch('/tpa/${name}')">TPA</button>
        <button onclick="sendChat('${name}')" style="background:#6c757d">Chat</button>
      </td>
    </tr>`).join('');

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 15px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td, th { padding: 10px; border: 1px solid #333; text-align: left; }
        button { padding: 8px 12px; border-radius: 4px; border: none; background: #007bff; color: white; cursor: pointer; margin-right:5px; }
        .logs { background: #000; height: 300px; overflow-y: scroll; padding: 10px; font-family: monospace; font-size: 11px; border: 1px solid #444; }
      </style></head>
      <body>
        <h3>Bot Commander</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${rows}</table>
        <button onclick="fetch('/tpa-all')" style="background:#28a745; width:100%; padding: 15px; margin-bottom:10px;">TPA ALL BOTS</button>
        <button onclick="sendChatAll()" style="background:#dc3545; width:100%; padding: 15px;">CHAT ALL BOTS</button>
        <br><br><strong>Logs:</strong><div class="logs">${webLogs.join('<br>')}</div>
        <script>
            function sendChat(name) {
                let msg = prompt('Enter message or command for ' + name + ':');
                if(msg) fetch('/chat/' + name + '?msg=' + encodeURIComponent(msg));
            }
            function sendChatAll() {
                let msg = prompt('Enter message for ALL bots:');
                if(msg) fetch('/chat-all?msg=' + encodeURIComponent(msg));
            }
            setInterval(() => window.location.reload(), 8000);
        </script>
      </body>
    </html>
  `);
});

app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.sendStatus(200); });

// Raw Chat Routes
app.get('/chat/:name', (req, res) => {
    bots[req.params.name]?.sendRawChat(req.query.msg);
    res.sendStatus(200);
});
app.get('/chat-all', (req, res) => {
    Object.values(bots).forEach(b => b.sendRawChat(req.query.msg));
    res.sendStatus(200);
});

app.listen(port, () => console.log(`Worker live on ${port}`));

