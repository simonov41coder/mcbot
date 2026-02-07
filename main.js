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

const ACCOUNTS = ['ws_lv', 'penguras_money', 'sr41'];
const bots = {};
let rawWebLogs = []; // This will hold the truly raw data
const RAW_LOG_FILE = path.join(__dirname, 'raw_console.txt');

// --- UTILS ---

function getJakartaTime() {
  return new Date().toLocaleString('en-GB', { 
    timeZone: 'Asia/Jakarta', 
    timeZoneName: 'short' 
  });
}

function logToRawFile(botName, content) {
  const logEntry = `[${getJakartaTime()}] [${botName}] ${content}\n`;
  fs.appendFile(RAW_LOG_FILE, logEntry, (err) => {
    if (err) console.error('Write Error:', err);
  });
}

function addRawWebLog(name, msg) {
  // No filters. No cleaning. Just the raw string.
  const entry = `<span style="color: #888">[${new Date().toLocaleTimeString()}]</span> <b style="color: #55ff55">[${name}]</b> <span style="color: #eee">${msg}</span>`;
  rawWebLogs.unshift(entry);
  if (rawWebLogs.length > 150) rawWebLogs.pop();
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
      // .toString() gives the text, but we aren't filtering it anymore.
      const rawText = jsonMsg.toString();
      
      logToRawFile(this.username, rawText);
      addRawWebLog(this.username, rawText);
    });

    this.bot.once('spawn', async () => {
      this.status = 'Online';
      await this.wait(2000);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      this.startJoinCheck();
    });

    this.bot.on('death', () => {
      this.status = 'Dead ☠';
      logToRawFile(this.username, ">>> EVENT: BOT_DIED <<<");
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      logToRawFile(this.username, `>>> DISCONNECT: ${reason} <<<`);
      setTimeout(() => this.connect(), 15000);
    });
  }

  startJoinCheck() {
    setInterval(async () => {
      if (!this.bot || !this.bot.inventory) return;
      const hotbar = this.bot.inventory.slots.slice(36, 45);
      const selector = hotbar.find(i => i && (i.name.includes('clock') || i.name.includes('compass')));

      if (selector) {
        this.status = 'Lobby';
        try {
          if (this.bot.currentWindow) { await this.bot.clickWindow(20, 0, 0); return; }
          this.bot.setQuickBarSlot(this.bot.inventory.slots.indexOf(selector) - 36);
          this.bot.activateItem();
        } catch (e) {}
      } else {
        this.status = 'In-Game';
      }
    }, 6000);
  }

  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Raw Input Monitor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { background: #000; color: #0f0; font-family: 'Courier New', monospace; padding: 10px; }
          .console { background: #050505; border: 1px solid #222; height: 70vh; overflow-y: scroll; padding: 10px; font-size: 12px; }
          .status-bar { display: flex; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
          .bot-card { background: #111; padding: 5px 10px; border-radius: 4px; border-left: 3px solid #0f0; }
          button { background: #d00; color: #fff; border: none; padding: 10px; cursor: pointer; width: 100%; font-weight: bold; margin-top: 10px;}
        </style>
      </head>
      <body>
        <h3>SYSTEM RAW FEED</h3>
        <div class="status-bar">
          ${Object.keys(bots).map(name => `<div class="bot-card">${name}: ${bots[name].status}</div>`).join('')}
        </div>
        <div class="console" id="con">${rawWebLogs.join('<br>')}</div>
        <button onclick="window.open('/download-raw')">DOWNLOAD FULL RAW LOG (.TXT)</button>
        <script>
          setInterval(() => {
            fetch('/raw-data').then(r => r.text()).then(h => {
              const c = document.getElementById('con');
              c.innerHTML = h;
            });
          }, 2000);
        </script>
      </body>
    </html>
  `);
});

app.get('/raw-data', (req, res) => res.send(rawWebLogs.join('<br>')));
app.get('/download-raw', (req, res) => res.sendFile(RAW_LOG_FILE));

app.listen(port, () => console.log(`Raw Monitor Active: ${port}`));

