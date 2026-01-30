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

const ACCOUNTS = ['dawg', 'ws_lv'];
const bots = {}; 

 class BotInstance {
  constructor(username, index) {
    this.username = username;
    this.status = 'Initializing';
    this.isQueued = false;
    this.queuePos = 0;
    this.isJoining = false;
    
    // Stagger starts
    setTimeout(() => this.connect(), index * 15000);
  }

  connect() {
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
      this.status = 'Online (Lobby)';
      console.log(`[${this.username}] Spawned in lobby.`);
      
      // Auth Sequence
      await new Promise(r => setTimeout(r, 2000));
      this.bot.chat(`/register ${GLOBAL_CONFIG.password}`);
      await new Promise(r => setTimeout(r, 1500));
      this.bot.chat(`/login ${GLOBAL_CONFIG.password}`);
      
      // Start trying to join the realm after 5 seconds
      setTimeout(() => this.attemptJoin(), 5000);
    });

    this.bot.on('messagestr', (msg) => {
      if (msg.includes('❤') || msg.includes('★')) return;
      
      // Queue Detection
      const queueMatch = msg.match(/position (\d+) of/);
      if (queueMatch) {
        this.isQueued = true;
        this.queuePos = parseInt(queueMatch[1]);
        this.status = `Queued (${this.queuePos})`;
        
        if (this.queuePos > 5) {
            console.log(`[${this.username}] Queue high (${this.queuePos}). Sleeping.`);
            this.bot.quit();
            this.status = `Waiting (Pos ${this.queuePos})`;
            setTimeout(() => this.connect(), this.queuePos * 10000);
        }
      }

      if (msg.includes('Welcome') || msg.includes('joined the game')) {
        this.status = 'In-Game';
        this.isQueued = false;
        this.isJoining = false;
      }
    });

    this.bot.on('end', (reason) => {
      this.status = 'Offline';
      this.isJoining = false;
      console.log(`[${this.username}] Disconnected: ${reason}`);
      setTimeout(() => this.connect(), 60000);
    });
  }

  async attemptJoin() {
    if (this.status === 'In-Game' || this.isQueued || this.isJoining) return;
    
    this.isJoining = true;
    console.log(`[${this.username}] Attempting to join Realm...`);

    try {
      this.bot.setQuickBarSlot(0); // Select the clock
      await new Promise(r => setTimeout(r, 1000));
      this.bot.activateItem(); // Right click clock

      // Listen for the menu to pop up
      const onWindow = async (window) => {
        console.log(`[${this.username}] Menu opened. Clicking Slot 19.`);
        await new Promise(r => setTimeout(r, 1000));
        await this.bot.clickWindow(19, 0, 0);
        this.isJoining = false;
      };

      this.bot.once('windowOpen', onWindow);

      // If menu doesn't open in 10s, try again
      setTimeout(() => {
        if (this.isJoining) {
            this.bot.removeListener('windowOpen', onWindow);
            this.isJoining = false;
            this.attemptJoin(); 
        }
      }, 10000);

    } catch (e) {
      this.isJoining = false;
    }
  }

  tpa() {
    if (this.bot && this.bot.entity) {
      this.bot.chat(`/tpa ${GLOBAL_CONFIG.targetPlayer}`);
      return true;
    }
    return false;
  }
}
   

// Start Bots
ACCOUNTS.forEach((name, i) => {
  bots[name] = new BotInstance(name, i);
});

// --- WEB INTERFACE ---
app.get('/', (req, res) => {
  let rows = '';
  Object.keys(bots).forEach(name => {
    rows += `
      <tr>
        <td>${name}</td>
        <td><strong>${bots[name].status}</strong></td>
        <td><button onclick="fetch('/tpa/${name}')">Send TPA</button></td>
      </tr>`;
  });

  res.send(`
    <html>
      <head>
        <title>Bot Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; padding: 20px; background: #121212; color: white; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; border: 1px solid #333; text-align: left; }
          button { padding: 8px 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
          button:active { background: #0056b3; }
        </style>
      </head>
      <body>
        <h2>Minecraft Bot Commander</h2>
        <table>
          <tr><th>Bot Name</th><th>Status</th><th>Action</th></tr>
          ${rows}
        </table>
        <br>
        <button onclick="fetch('/tpa-all')" style="background: #28a745;">TPA ALL BOTS</button>
      </body>
    </html>
  `);
});

app.get('/tpa/:name', (req, res) => {
  const name = req.params.name;
  if (bots[name]) {
    bots[name].tpa();
    res.send('Sent');
  } else {
    res.status(404).send('Not Found');
  }
});

app.get('/tpa-all', (req, res) => {
  Object.values(bots).forEach(b => b.tpa());
  res.send('All Sent');
});

app.listen(port, () => {
  console.log(`Dashboard running on port ${port}`);
});

