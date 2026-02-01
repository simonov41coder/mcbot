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

const ACCOUNTS = ['ws_lv', 'penguras_money', 'sr41']; 
const bots = {};
let webLogs = [];

function addWebLog(name, msg) {
  const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
  const entry = `<span style="color: #888">[${new Date().toLocaleTimeString()}]</span> <b style="color: #55ff55">[${name}]</b> ${cleanMsg}`;
  webLogs.unshift(entry);
  if (webLogs.length > 80) webLogs.pop();
}

class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    this.isInGame = false;
    
    setTimeout(() => this.connect(), index * 10000);
  }

  connect() {
    this.cleanup();
    this.status = 'Connecting...';
    this.bot = mineflayer.createBot({
      host: GLOBAL_CONFIG.host,
      port: GLOBAL_CONFIG.port,
      username: this.username,
      version: GLOBAL_CONFIG.version,
      auth: 'offline'
    });

    this.bot.on('message', (jsonMsg) => addWebLog(this.username, jsonMsg.toString()));

    this.bot.once('spawn', async () => {
      this.status = 'Lobby (Auth)';
      
      // Auth
      await this.wait(2000);
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await this.wait(1500);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      this.startJoinCheck();
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isInGame = false;
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 20000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `Error: ${err.message}`));
  }

  startJoinCheck() {
    this.joinInterval = setInterval(async () => {
      if (!this.bot || !this.bot.inventory) return;

      // --- 1. LOBBY CHECK (Hotbar only) ---
      // Hotbar slots are 36 to 44 in Mineflayer
      const hotbarItems = this.bot.inventory.slots.slice(36, 45);
      const clockInHotbar = hotbarItems.find(item => item && (item.name.includes('clock') || item.name.includes('compass')));

      if (!clockInHotbar) {
        // No clock in hotbar = We are likely In-Game or in Queue
        if (this.status !== 'In-Game') {
            this.status = 'In-Game';
            addWebLog(this.username, "Clock gone from hotbar. Status: In-Game.");
        }
        return; 
      }

      this.status = 'Lobby (Joining)';

      // --- 2. INTERACTION ---
      try {
        // If a window is already open, just click
        if (this.bot.currentWindow) {
          addWebLog(this.username, "Selector open. Clicking slot 21...");
          await this.bot.clickWindow(21, 0, 0);
          return;
        }

        // Find which hotbar slot the clock is in (0-8)
        const slotIndex = this.bot.inventory.slots.indexOf(clockInHotbar) - 36;
        
        this.bot.setQuickBarSlot(slotIndex); // Select the slot
        await this.wait(500);
        this.bot.activateItem(); // Right-click
        addWebLog(this.username, `Using clock in hotbar slot ${slotIndex}...`);

      } catch (e) {
        // Error handling
      }
    }, 8000);
  }

  cleanup() {
    if (this.joinInterval) clearInterval(this.joinInterval);
  }

  sendChat(msg) { if (this.bot) this.bot.chat(msg); }
  tpa() { if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD ---
app.get('/', (req, res) => {
  let botRows = Object.keys(bots).map(name => `
    <tr>
      <td>${name}</td>
      <td style="color:${bots[name].status === 'In-Game' ? '#28a745' : '#ffc107'}"><b>${bots[name].status}</b></td>
      <td>
        <button onclick="fetch('/tpa/${name}')">TPA</button>
        <button onclick="sendChat('${name}')" style="background:#6c757d">Chat</button>
        <button onclick="fetch('/reset/${name}')" style="background:#dc3545">RST</button>
      </td>
    </tr>`).join('');

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        td, th { padding: 10px; border: 1px solid #333; text-align: left; }
        button { padding: 8px 12px; border-radius: 4px; border: none; background: #007bff; color: white; cursor: pointer; }
        .logs { background: #000; height: 400px; overflow-y: scroll; padding: 10px; font-family: monospace; font-size: 12px; border: 1px solid #444; color: #0f0; }
      </style></head>
      <body>
        <h3>Bot Dashboard</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${botRows}</table>
        <button onclick="fetch('/tpa-all')" style="background:#28a745; width:48%">TPA ALL</button>
        <button onclick="sendChatAll()" style="background:#444; width:48%">CHAT ALL</button>
        <div style="margin-top:10px;"><strong>Live Logs:</strong></div>
        <div class="logs" id="logBox">${webLogs.join('<br>')}</div>
        <script>
          function sendChat(name) {
            let m = prompt('Message for ' + name);
            if(m) fetch('/chat/' + name + '?msg=' + encodeURIComponent(m));
          }
          function sendChatAll() {
            let m = prompt('Message for ALL');
            if(m) fetch('/chat-all?msg=' + encodeURIComponent(m));
          }
          setInterval(() => {
            fetch('/get-logs').then(r => r.text()).then(html => {
              const b = document.getElementById('logBox');
              const down = b.scrollHeight - b.clientHeight <= b.scrollTop + 5;
              b.innerHTML = html;
              if(down) b.scrollTop = b.scrollHeight;
            });
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

app.get('/get-logs', (req, res) => res.send(webLogs.join('<br>')));
app.get('/reset/:name', (req, res) => { bots[req.params.name]?.bot.quit(); res.sendStatus(200); });
app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.sendStatus(200); });
app.get('/chat/:name', (req, res) => { bots[req.params.name]?.sendChat(req.query.msg); res.sendStatus(200); });
app.get('/chat-all', (req, res) => { Object.values(bots).forEach(b => b.sendChat(req.query.msg)); res.sendStatus(200); });

app.listen(port, () => console.log(`Dashboard on ${port}`));

