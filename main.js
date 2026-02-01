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

const ACCOUNTS = ['ws_lv', 'sr41', 'penguras_money']; 
const bots = {};
let webLogs = [];

function addWebLog(name, msg) {
  const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, ''); // Remove color codes for clean logs
  const entry = `[${new Date().toLocaleTimeString()}] [${name}] ${cleanMsg}`;
  console.log(entry);
  webLogs.unshift(entry);
  if (webLogs.length > 100) webLogs.pop(); // Keep last 100 messages
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

    // LOG ALL CHAT (Server & Players)
    this.bot.on('message', (jsonMsg) => {
        addWebLog(this.username, jsonMsg.toString());
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
      const queueMatch = msg.match(/position (\d+) of/);
      if (queueMatch) {
        this.isQueued = true;
        this.status = `Queued (${queueMatch[1]})`;
      }
      if (msg.toLowerCase().includes('welcome') || msg.toLowerCase().includes('joined the game')) {
        this.status = 'In-Game';
        this.isQueued = false;
      }
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 20000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `ERROR: ${err.message}`));
  }

  async forceJoinRealm() {
    if (this.joinInterval) clearInterval(this.joinInterval);
    this.joinInterval = setInterval(async () => {
      if (this.status === 'In-Game' || this.isQueued || !this.bot) return;

      const clock = this.bot.inventory.items().find(item => item.name.includes('clock') || item.name.includes('compass'));
      if (!clock) return;

      try {
        await this.bot.equip(clock, 'hand');
        this.bot.activateItem(); 
        const window = await this.bot.waitForTicks(20).then(() => this.bot.currentWindow);
        if (window) {
             addWebLog(this.username, `Menu open: ${window.title}. Clicking slot 21...`);
             await this.bot.clickWindow(21, 0, 0);
             await this.wait(1000);
        }
      } catch (e) {}
    }, 10000);
  }

  manualClick(slot) {
    if (this.bot && this.bot.currentWindow) {
        this.bot.clickWindow(slot, 0, 0);
        addWebLog(this.username, `Manual Clicked Slot ${slot}`);
    } else if (this.bot) {
        this.bot.activateItem(); // Try opening the menu first
        addWebLog(this.username, "No window open. Right-clicking held item...");
    }
  }

  startAfkMovements() {
    this.afkInterval = setInterval(() => {
      if (this.bot?.entity) this.bot.look(Math.random() * 3, Math.random() * 3);
    }, 5000);
  }

  tpa() { if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD ---
app.get('/', (req, res) => {
  let rows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td style="color:${bots[name].status === 'In-Game' ? '#28a745' : '#ffc107'}"><b>${bots[name].status}</b></td>
      <td>
        <button onclick="fetch('/tpa/${name}')">TPA</button>
        <button onclick="sendChat('${name}')">Chat</button>
        <button onclick="manualClick('${name}')" style="background:#fd7e14">Click</button>
        <button onclick="fetch('/reconnect/${name}')" style="background:#dc3545">RST</button>
      </td>
    </tr>`).join('');

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 14px; }
        td, th { padding: 8px; border: 1px solid #333; text-align: left; }
        button { padding: 6px 10px; border-radius: 4px; border: none; background: #007bff; color: white; cursor: pointer; margin-bottom: 2px; }
        .logs { background: #000; height: 350px; overflow-y: scroll; padding: 10px; font-family: monospace; font-size: 11px; border: 1px solid #444; color: #0f0; }
      </style></head>
      <body>
        <h3>Bot Dashboard</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${rows}</table>
        <button onclick="fetch('/tpa-all')" style="background:#28a745; width:48%;">TPA ALL</button>
        <button onclick="sendChatAll()" style="background:#6c757d; width:48%;">CHAT ALL</button>
        <div style="margin-top:10px;"><strong>Server Logs:</strong></div>
        <div class="logs" id="logBox">${webLogs.join('<br>')}</div>
        <script>
            function sendChat(name) {
                let msg = prompt('Message/Command for ' + name);
                if(msg) fetch('/chat/' + name + '?msg=' + encodeURIComponent(msg));
            }
            function manualClick(name) {
                let slot = prompt('Enter Slot Number to click (usually 19-21):', '19');
                if(slot) fetch('/click/' + name + '/' + slot);
            }
            function sendChatAll() {
                let msg = prompt('Message for ALL bots');
                if(msg) fetch('/chat-all?msg=' + encodeURIComponent(msg));
            }
            setInterval(() => {
                fetch('/get-logs').then(r => r.text()).then(html => {
                    document.getElementById('logBox').innerHTML = html;
                });
            }, 3000);
        </script>
      </body>
    </html>
  `);
});

app.get('/get-logs', (req, res) => res.send(webLogs.join('<br>')));
app.get('/reconnect/:name', (req, res) => { bots[req.params.name]?.bot.quit(); res.sendStatus(200); });
app.get('/click/:name/:slot', (req, res) => { bots[req.params.name]?.manualClick(parseInt(req.params.slot)); res.sendStatus(200); });
app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.sendStatus(200); });
app.get('/chat/:name', (req, res) => { bots[req.params.name]?.sendRawChat(req.query.msg); res.sendStatus(200); });
app.get('/chat-all', (req, res) => { Object.values(bots).forEach(b => b.sendRawChat(req.query.msg)); res.sendStatus(200); });

app.listen(port, () => console.log(`Dashboard live on ${port}`));

