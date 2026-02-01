const mineflayer = require('mineflayer');
const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// --- 1. CONFIGURATION ---
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
  const cleanMsg = msg.replace(/§[0-9a-fk-or]/g, ''); // Clean Minecraft colors
  const entry = `<span style="color: #888">[${new Date().toLocaleTimeString()}]</span> <b style="color: #55ff55">[${name}]</b> ${cleanMsg}`;
  webLogs.unshift(entry);
  if (webLogs.length > 100) webLogs.pop();
}

class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    this.isInGame = false;
    this.isQueued = false;
    
    // Staggered login to prevent server kick for "Too many connections"
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

    // --- FULL CHAT LOGGING ---
    this.bot.on('message', (jsonMsg) => {
      addWebLog(this.username, jsonMsg.toString());
    });

    this.bot.once('spawn', async () => {
      this.status = 'Lobby (Auth)';
      addWebLog(this.username, "Spawned. Authenticating...");

      // Simple anti-AFK: Move head
      this.afkInterval = setInterval(() => {
        if (this.bot?.entity && !this.isInGame) {
          this.bot.look(Math.random() * Math.PI, (Math.random() - 0.5) * Math.PI);
        }
      }, 4000);

      // Auth Sequence
      await this.wait(2000);
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await this.wait(1500);
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      this.status = 'Lobby (Joining)';
      this.startJoinCheck();
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isInGame = false;
      addWebLog(this.username, `Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 20000);
    });

    this.bot.on('error', (err) => addWebLog(this.username, `System Error: ${err.message}`));
  }

  async startJoinCheck() {
    this.joinInterval = setInterval(async () => {
      if (!this.bot || this.isInGame) return;

      // --- 1. PHYSICAL CHECK (Grass Block) ---
      // If we see grass, we are 100% in the game.
      const grass = this.bot.findBlock({
        matching: this.bot.registry.blocksByName.grass_block.id,
        maxDistance: 32
      });

      if (grass) {
        if (!this.isInGame) addWebLog(this.username, "✅ Grass detected. Confirming In-Game status.");
        this.isInGame = true;
        this.status = 'In-Game';
        clearInterval(this.joinInterval);
        return;
      }

      // --- 2. JOIN LOGIC (Lobby Interaction) ---
      // We check if a menu is already open first.
      if (this.bot.currentWindow) {
        addWebLog(this.username, `Menu "${this.bot.currentWindow.title}" is open. Clicking slot 19...`);
        // Mode 0, Button 0 = Simple Left Click (doesn't "grab" the item)
        await this.bot.clickWindow(21, 0, 0); 
        return;
      }

      // If no menu, try to use the clock.
      const clock = this.bot.inventory.items().find(i => i.name.includes('clock') || i.name.includes('compass'));
      if (clock) {
        try {
          await this.bot.equip(clock, 'hand');
          this.bot.activateItem(); // Right-click to open menu
          addWebLog(this.username, "Right-clicked clock to open menu...");
        } catch (e) {}
      }
    }, 7000);
  }

  cleanup() {
    if (this.joinInterval) clearInterval(this.joinInterval);
    if (this.afkInterval) clearInterval(this.afkInterval);
  }

  sendChat(msg) { if (this.bot) this.bot.chat(msg); }
  tpa() { if (this.bot) this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// --- INITIALIZE ---
ACCOUNTS.forEach((name, i) => { bots[name] = new BotInstance(name, i); });

// --- DASHBOARD (EXPRESS) ---
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
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; background: #1a1a1a; }
        th, td { padding: 12px; border: 1px solid #333; text-align: left; }
        button { padding: 8px 12px; border-radius: 4px; border: none; background: #007bff; color: white; cursor: pointer; margin-right: 2px; }
        .logs { background: #000; height: 400px; overflow-y: scroll; padding: 10px; font-family: monospace; font-size: 12px; border: 1px solid #444; color: #0f0; }
        .btn-group { display: flex; gap: 5px; margin-bottom: 10px; }
      </style></head>
      <body>
        <h3>Bot Command Center</h3>
        <table><tr><th>Bot</th><th>Status</th><th>Actions</th></tr>${botRows}</table>
        <div class="btn-group">
          <button onclick="fetch('/tpa-all')" style="background:#28a745; flex:1">TPA ALL</button>
          <button onclick="sendChatAll()" style="background:#444; flex:1">CHAT ALL</button>
        </div>
        <strong>Live Console:</strong>
        <div class="logs" id="logBox">${webLogs.join('<br>')}</div>
        <script>
          function sendChat(name) {
            let m = prompt('Message/Command for ' + name);
            if(m) fetch('/chat/' + name + '?msg=' + encodeURIComponent(m));
          }
          function sendChatAll() {
            let m = prompt('Message for ALL bots');
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

app.listen(port, () => console.log(`Dashboard listening on port ${port}`));

