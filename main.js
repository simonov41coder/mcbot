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

const ACCOUNTS = ['ws_lv', 'penguras_money','sr41']; 
const bots = {};
let webLogs = [];

function addWebLog(name, msg) {
  // Strip Minecraft color codes for the web UI
  const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, '');
  const entry = `<span style="color: #55ff55">[${new Date().toLocaleTimeString()}]</span> <b>[${name}]</b> ${cleanMsg}`;
  webLogs.unshift(entry);
  if (webLogs.length > 100) webLogs.pop();
}

class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    this.isQueued = false;
    this.isInGame = false;
    
    setTimeout(() => this.connect(), index * 8000);
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

    // --- ENHANCED LOGGING ---
    // This captures EVERY message the server sends
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
      this.startLoops();
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isInGame = false;
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 20000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `ERROR: ${err.message}`));
  }

  startLoops() {
    if (this.joinInterval) clearInterval(this.joinInterval);
    
    this.joinInterval = setInterval(async () => {
      if (!this.bot) return;

      // --- 1. BLOCK DETECTION ---
      // Scans for grass_block within 16 blocks
      const grass = this.bot.findBlock({
        matching: this.bot.registry.blocksByName.grass_block.id,
        maxDistance: 16
      });

      if (grass) {
        if (!this.isInGame) addWebLog(this.username, "TRUTH: Grass detected! We are In-Game.");
        this.isInGame = true;
        this.status = 'In-Game';
        return; // Stop trying to click the clock if we see grass
      }

      // --- 2. JOIN LOGIC (If not in game) ---
      if (this.status.includes('Lobby')) {
        const clock = this.bot.inventory.items().find(i => i.name.includes('clock') || i.name.includes('compass'));
        if (clock) {
          try {
            await this.bot.equip(clock, 'hand');
            this.bot.activateItem();
            const window = await this.bot.waitForTicks(20).then(() => this.bot.currentWindow);
            if (window) {
                 await this.bot.clickWindow(19, 0, 0); // Click slot 19
                 addWebLog(this.username, "Menu found, clicked Slot 19");
            }
          } catch (e) {}
        }
      }
    }, 8000);
  }

  startAfkMovements() {
    this.afkInterval = setInterval(() => {
      if (this.bot?.entity && !this.isInGame) {
        this.bot.look(Math.random() * 3, Math.random() * 1.5);
      }
    }, 5000);
  }

  sendChat(msg) { if (this.bot) this.bot.chat(msg); }
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
        <button onclick="fetch('/reconnect/${name}')" style="background:#dc3545">RST</button>
      </td>
    </tr>`).join('');

  res.send(`
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: 'Segoe UI', sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 10px; }
        table { width: 100%; border-collapse: collapse; background: #1a1a1a; margin-bottom: 15px; border-radius: 8px; overflow: hidden; }
        th, td { padding: 12px; border-bottom: 1px solid #333; text-align: left; }
        button { padding: 8px 12px; border-radius: 5px; border: none; background: #3b82f6; color: white; cursor: pointer; font-weight: bold; }
        .logs { background: #000; height: 400px; overflow-y: scroll; padding: 15px; font-family: 'Consolas', monospace; font-size: 12px; border: 1px solid #444; color: #fff; line-height: 1.5; }
        .controls { display: flex; gap: 10px; margin-bottom: 10px; }
      </style></head>
      <body>
        <h3>Bot Squad Controller</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${rows}</table>
        <div class="controls">
          <button onclick="fetch('/tpa-all')" style="background:#10b981; flex: 1;">TPA ALL</button>
          <button onclick="sendChatAll()" style="background:#6b7280; flex: 1;">CHAT ALL</button>
        </div>
        <div style="margin-top:15px; margin-bottom: 5px;"><strong>Server Console:</strong></div>
        <div class="logs" id="logBox">${webLogs.join('<br>')}</div>
        <script>
            function sendChat(name) {
                let msg = prompt('Message/Command for ' + name);
                if(msg) fetch('/chat/' + name + '?msg=' + encodeURIComponent(msg));
            }
            function sendChatAll() {
                let msg = prompt('Message for ALL bots');
                if(msg) fetch('/chat-all?msg=' + encodeURIComponent(msg));
            }
            // Auto-update logs every 3 seconds
            setInterval(() => {
                fetch('/get-logs').then(r => r.text()).then(html => {
                    const lb = document.getElementById('logBox');
                    const wasAtBottom = lb.scrollHeight - lb.clientHeight <= lb.scrollTop + 1;
                    lb.innerHTML = html;
                    if (wasAtBottom) lb.scrollTop = lb.scrollHeight;
                });
            }, 3000);
        </script>
      </body>
    </html>
  `);
});

app.get('/get-logs', (req, res) => res.send(webLogs.join('<br>')));
app.get('/reconnect/:name', (req, res) => { bots[req.params.name]?.bot.quit(); res.sendStatus(200); });
app.get('/tpa/:name', (req, res) => { bots[req.params.name]?.tpa(); res.sendStatus(200); });
app.get('/tpa-all', (req, res) => { Object.values(bots).forEach(b => b.tpa()); res.sendStatus(200); });
app.get('/chat/:name', (req, res) => { bots[req.params.name]?.sendChat(req.query.msg); res.sendStatus(200); });
app.get('/chat-all', (req, res) => { Object.values(bots).forEach(b => b.sendChat(req.query.msg)); res.sendStatus(200); });

app.listen(port, () => console.log(`Worker active on ${port}`));

