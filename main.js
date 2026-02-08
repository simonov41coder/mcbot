const mineflayer = require('mineflayer');
const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 8080;

const GLOBAL_CONFIG = {
  host: '185.207.166.12',
  port: 25565,
  version: '1.20.1',
  password: 'kuyashii123',
  targetPlayer: 'ditnshyky'
};

const ACCOUNTS = ['ragat_lah', 'penguras_money', "putra_putri"];
const bots = {};
let webLogs = [];
const DEATH_LOG_FILE = path.join(__dirname, 'deaths.txt');

// --- UTILS ---

function getJakartaTime() {
  return new Date().toLocaleString('en-GB', { 
    timeZone: 'Asia/Jakarta', 
    timeZoneName: 'short' 
  });
}

function logToFile(botName, content) {
  const logEntry = `[${getJakartaTime()}] [${botName}] ${content}\n`;
  fs.appendFile(DEATH_LOG_FILE, logEntry, (err) => {
    if (err) console.error('Write Error:', err);
  });
}

function addWebLog(name, msg) {
  const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
  if (cleanMsg.includes('❤') || cleanMsg.includes('★') || cleanMsg.includes('⛨')) return;

  const entry = `<span style="color: #888">[${new Date().toLocaleTimeString()}]</span> <b style="color: #55ff55">[${name}]</b> ${cleanMsg}`;
  webLogs.unshift(entry);
  if (webLogs.length > 100) webLogs.pop();
}

class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    setTimeout(() => this.connect(), index * 5000);
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

    this.bot.on('message', (jsonMsg) => {
      const msg = jsonMsg.toString();
      logToFile(this.username, msg);
      addWebLog(this.username, msg);
    });

    this.bot.on('death', () => {
      this.status = 'Dead ☠';
      logToFile(this.username, "!!! BOT DIED !!!");
    });

    this.bot.once('spawn', async () => {
      this.status = 'Lobby (Auth)';
      await this.wait(2000);
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await this.wait(2000);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      this.startJoinCheck();
    });

    this.bot.on('spawn', () => {
      if (this.status === 'Dead ☠') this.status = 'In-Game';
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      logToFile(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 15000);
    });
  }

  startJoinCheck() {
    setInterval(async () => {
      if (!this.bot || !this.bot.inventory) return;
      const hotbar = this.bot.inventory.slots.slice(36, 45);
      const selector = hotbar.find(i => i && (i.name.includes('clock') || i.name.includes('compass')));
      if (!selector) {
         if (this.status !== 'In-Game' && this.status !== 'Dead ☠') this.status = 'In-Game';
         return;
      }
      this.status = 'Lobby (Joining)';
      try {
        if (this.bot.currentWindow) { await this.bot.clickWindow(20, 0, 0); return; }
        this.bot.setQuickBarSlot(this.bot.inventory.slots.indexOf(selector) - 36);
        this.bot.activateItem();
      } catch (e) {}
    }, 6000);
  }

  sendChat(msg) { if (this.bot) this.bot.chat(msg); }
  tpa() { if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD ---
app.get('/', (req, res) => {
  const botRows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td style="color:${bots[name].status === 'In-Game' ? '#28a745' : '#ff5555'}">${bots[name].status}</td>
      <td>
        <button onclick="fetch('/tpa/${name}')">TPA</button>
        <button onclick="individualChat('${name}')" style="background:#6c757d">Chat</button>
      </td>
    </tr>`).join('');

  res.send(`
    <html>
      <head><title>Bot Commander</title><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { background: #121212; color: #fff; font-family: sans-serif; padding:10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td, th { border: 1px solid #333; padding: 10px; text-align: left; }
        button { background: #007bff; color: white; border: none; padding: 8px; border-radius: 4px; cursor:pointer; }
        .chat-section { background: #1e1e1e; padding: 15px; border-radius: 8px; border: 1px solid #444; margin-bottom: 10px; }
        input { width: 70%; padding: 10px; border-radius: 4px; border: 1px solid #333; background: #000; color: #fff; }
        #logs { background: #000; height: 300px; overflow-y: scroll; padding: 10px; font-family: monospace; border: 1px solid #333; font-size: 13px; }
      </style></head>
      <body>
        <h3>Bot Status</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${botRows}</table>
        
        <div class="chat-section">
          <input type="text" id="chatInput" placeholder="Type message to all bots...">
          <button onclick="broadcast()" style="background:#28a745">SEND ALL</button>
          <button onclick="window.open('/view-full-log')" style="background:#dc3545">VIEW LOGS</button>
        </div>

        <div id="logs">${webLogs.join('<br>')}</div>

        <script>
            function individualChat(name) {
                const msg = prompt("Message from " + name + ":");
                if(msg) fetch('/chat/' + name + '?msg=' + encodeURIComponent(msg));
            }
            function broadcast() {
                const input = document.getElementById('chatInput');
                if(!input.value) return;
                fetch('/chat-all?msg=' + encodeURIComponent(input.value));
                input.value = '';
            }
            setInterval(() => {
                fetch('/logs').then(r => r.text()).then(h => document.getElementById('logs').innerHTML = h);
            }, 2500);
        </script>
      </body>
    </html>
  `);
});

app.get('/logs', (req, res) => res.send(webLogs.join('<br>')));
app.get('/view-full-log', (req, res) => fs.existsSync(DEATH_LOG_FILE) ? res.sendFile(DEATH_LOG_FILE) : res.send("No logs."));
app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/chat/:name', (req, res) => { bots[req.params.name]?.sendChat(req.query.msg); res.sendStatus(200); });
app.get('/chat-all', (req, res) => { Object.values(bots).forEach(b => b.sendChat(req.query.msg)); res.sendStatus(200); });

app.listen(port, () => console.log(`Dashboard active on port ${port}`));

