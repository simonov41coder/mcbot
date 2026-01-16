const mineflayer = require('mineflayer');
const readline = require('readline');

// Bot configuration
const BOT_CONFIG = {
  host: 'minegens.id',   // Server address
  port: 25565,           // Default Minecraft port
  username: 'ws_lv',     // Bot username (change this)
  version: '1.20.1',     // Minecraft version
  auth: 'offline'        // For cracked servers
};

// Create the bot
const bot = mineflayer.createBot(BOT_CONFIG);

// Setup readline for console input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

// Pathfinding variables
let pathfinderLoaded = false;
let mcData = null;

// Bot event handlers
bot.on('login', () => {
  console.log(`[BOT] Logged in as ${bot.username}`);
  console.log(`[BOT] Connected to ${BOT_CONFIG.host}:${BOT_CONFIG.port}`);
});

bot.on('spawn', () => {
  console.log('[BOT] Spawned in game');
  const pos = bot.entity.position;
  console.log(`[BOT] Position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`);
  console.log('[BOT] Ready to receive commands!');
  rl.prompt();
});

bot.on('chat', (username, message) => {
  if (username === bot.username) return;
  console.log(`[CHAT] <${username}> ${message}`);
  rl.prompt();
});

bot.on('messagestr', (message) => {
  // Show server messages (like login success, etc.)
  if (!message.startsWith('<')) {
    console.log(`[SERVER] ${message}`);
    rl.prompt();
  }
});

bot.on('whisper', (username, message) => {
  console.log(`[WHISPER] ${username} whispers: ${message}`);
  rl.prompt();
});

bot.on('error', (err) => {
  console.error('[ERROR]', err.message);
  rl.prompt();
});

bot.on('kicked', (reason) => {
  console.log('[BOT] Kicked:', reason);
  rl.close();
  process.exit(1);
});

bot.on('end', () => {
  console.log('[BOT] Disconnected from server');
  rl.close();
  process.exit(0);
});

bot.on('death', () => {
  console.log('[BOT] Bot died! Respawning...');
  bot.chat('/respawn');
  rl.prompt();
});

bot.on('health', () => {
  if (bot.health !== undefined) {
    console.log(`[STATUS] Health: ${bot.health.toFixed(1)}/20 | Food: ${bot.food}/20 | Saturation: ${bot.foodSaturation.toFixed(1)}`);
    rl.prompt();
  }
});

bot.on('move', () => {
  // Update position during movement
  if (bot.pathfinder && bot.pathfinder.isMoving()) {
    const pos = bot.entity.position;
    process.stdout.write(`\r[MOVING] X=${pos.x.toFixed(1)}, Y=${pos.y.toFixed(1)}, Z=${pos.z.toFixed(1)} `);
  }
});

// Command handler
function handleCommand(input) {
  const args = input.trim().split(' ');
  const cmd = args[0].toLowerCase();

  switch(cmd) {
    case 'chat':
      const msg = args.slice(1).join(' ');
      bot.chat(msg);
      console.log(`[BOT] Sent: ${msg}`);
      break;

    case 'whisper':
    case 'msg':
    case 'w':
      if (args.length < 3) {
        console.log('[ERROR] Usage: whisper <player> <message>');
      } else {
        const target = args[1];
        const whisperMsg = args.slice(2).join(' ');
        bot.whisper(target, whisperMsg);
        console.log(`[BOT] Whispered to ${target}: ${whisperMsg}`);
      }
      break;

    case 'goto':
    case 'go':
      if (!pathfinderLoaded) {
        console.log('[ERROR] Pathfinder not loaded. Install: npm install mineflayer-pathfinder');
        break;
      }
      if (args.length < 4) {
        console.log('[ERROR] Usage: goto <x> <y> <z>');
      } else {
        try {
          const x = Math.floor(parseFloat(args[1]));
          const y = Math.floor(parseFloat(args[2]));
          const z = Math.floor(parseFloat(args[3]));
          
          const currentPos = bot.entity.position;
          const distance = Math.sqrt(
            Math.pow(x - currentPos.x, 2) + 
            Math.pow(z - currentPos.z, 2)
          );
          
          console.log(`[BOT] Distance to target: ${distance.toFixed(1)} blocks`);
          
          const { goals } = require('mineflayer-pathfinder');
          // Use GoalNear instead of GoalBlock for more flexibility
          const goal = new goals.GoalNear(x, y, z, 1);
          
          console.log(`[BOT] Navigating to (${x}, ${y}, ${z})...`);
          bot.pathfinder.setGoal(goal);
          
          bot.once('goal_reached', () => {
            console.log('\n[BOT] Destination reached!');
            rl.prompt();
          });
          
          bot.once('path_update', (results) => {
            if (results.status === 'noPath') {
              console.log('[ERROR] Cannot find path! Try:');
              console.log('  - Using "gotoforce" for direct movement');
              console.log('  - Moving to a closer location first');
              console.log('  - Checking if destination is reachable');
              rl.prompt();
            }
          });
        } catch (err) {
          console.log(`[ERROR] ${err.message}`);
        }
      }
      break;

    case 'gotoforce':
    case 'goforce':
      if (args.length < 4) {
        console.log('[ERROR] Usage: gotoforce <x> <y> <z>');
      } else {
        const x = parseFloat(args[1]);
        const y = parseFloat(args[2]);
        const z = parseFloat(args[3]);
        
        const currentPos = bot.entity.position;
        const distance = Math.sqrt(
          Math.pow(x - currentPos.x, 2) + 
          Math.pow(z - currentPos.z, 2)
        );
        
        console.log(`[BOT] Force navigating ${distance.toFixed(1)} blocks to (${x}, ${y}, ${z})`);
        console.log('[BOT] Walking directly (may not avoid obstacles)...');
        
        const walkInterval = setInterval(() => {
          const pos = bot.entity.position;
          const dx = x - pos.x;
          const dz = z - pos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          
          if (dist < 1) {
            bot.clearControlStates();
            clearInterval(walkInterval);
            console.log('\n[BOT] Arrived at destination!');
            rl.prompt();
            return;
          }
          
          const yaw = Math.atan2(-dx, -dz);
          bot.look(yaw, 0, true);
          bot.setControlState('forward', true);
          bot.setControlState('sprint', true);
          
          // Jump if needed
          if (bot.entity.onGround && Math.random() < 0.1) {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 100);
          }
        }, 50);
        
        // Store interval so we can stop it
        bot.forceWalkInterval = walkInterval;
      }
      break;

    case 'walk':
      if (args.length < 2) {
        console.log('[ERROR] Usage: walk <forward|back|left|right|stop>');
      } else {
        const direction = args[1].toLowerCase();
        bot.clearControlStates();
        
        switch(direction) {
          case 'forward':
          case 'f':
            bot.setControlState('forward', true);
            bot.setControlState('sprint', true);
            console.log('[BOT] Walking forward (use "walk stop" to stop)');
            break;
          case 'back':
          case 'b':
            bot.setControlState('back', true);
            console.log('[BOT] Walking backward (use "walk stop" to stop)');
            break;
          case 'left':
          case 'l':
            bot.setControlState('left', true);
            console.log('[BOT] Walking left (use "walk stop" to stop)');
            break;
          case 'right':
          case 'r':
            bot.setControlState('right', true);
            console.log('[BOT] Walking right (use "walk stop" to stop)');
            break;
          case 'stop':
          case 's':
            bot.clearControlStates();
            console.log('[BOT] Stopped walking');
            break;
          default:
            console.log('[ERROR] Unknown direction. Use: forward, back, left, right, or stop');
        }
      }
      break;

    case 'follow':
      if (!pathfinderLoaded) {
        console.log('[ERROR] Pathfinder not loaded. Install: npm install mineflayer-pathfinder');
        break;
      }
      if (args.length < 2) {
        console.log('[ERROR] Usage: follow <player>');
      } else {
        const playerName = args[1];
        const player = bot.players[playerName];
        if (player && player.entity) {
          const { goals } = require('mineflayer-pathfinder');
          const goal = new goals.GoalFollow(player.entity, 3);
          bot.pathfinder.setGoal(goal, true);
          console.log(`[BOT] Following ${playerName}...`);
        } else {
          console.log(`[ERROR] Player ${playerName} not found or not visible`);
        }
      }
      break;

    case 'stop':
      if (pathfinderLoaded && bot.pathfinder) {
        bot.pathfinder.setGoal(null);
      }
      if (bot.forceWalkInterval) {
        clearInterval(bot.forceWalkInterval);
        bot.forceWalkInterval = null;
      }
      bot.clearControlStates();
      console.log('[BOT] Stopped all movement');
      break;

    case 'come':
      if (!pathfinderLoaded) {
        console.log('[ERROR] Pathfinder not loaded');
        break;
      }
      if (args.length < 2) {
        console.log('[ERROR] Usage: come <player>');
      } else {
        const playerName = args[1];
        const player = bot.players[playerName];
        if (player && player.entity) {
          const pos = player.entity.position;
          const { goals } = require('mineflayer-pathfinder');
          const goal = new goals.GoalNear(pos.x, pos.y, pos.z, 2);
          bot.pathfinder.setGoal(goal);
          console.log(`[BOT] Coming to ${playerName}...`);
        } else {
          console.log(`[ERROR] Player ${playerName} not found`);
        }
      }
      break;

    case 'jump':
      bot.setControlState('jump', true);
      setTimeout(() => bot.setControlState('jump', false), 100);
      console.log('[BOT] Jumped');
      break;

    case 'sneak':
      const sneaking = bot.getControlState('sneak');
      bot.setControlState('sneak', !sneaking);
      console.log(`[BOT] Sneak ${!sneaking ? 'enabled' : 'disabled'}`);
      break;

    case 'sprint':
      const sprinting = bot.getControlState('sprint');
      bot.setControlState('sprint', !sprinting);
      console.log(`[BOT] Sprint ${!sprinting ? 'enabled' : 'disabled'}`);
      break;

    case 'pos':
    case 'position':
      const pos = bot.entity.position;
      console.log(`[BOT] Position: X=${pos.x.toFixed(2)}, Y=${pos.y.toFixed(2)}, Z=${pos.z.toFixed(2)}`);
      console.log(`[BOT] Yaw: ${bot.entity.yaw.toFixed(2)}, Pitch: ${bot.entity.pitch.toFixed(2)}`);
      break;

    case 'health':
    case 'hp':
      console.log(`[BOT] Health: ${bot.health.toFixed(1)}/20`);
      console.log(`[BOT] Food: ${bot.food}/20`);
      console.log(`[BOT] Saturation: ${bot.foodSaturation.toFixed(1)}`);
      break;

    case 'players':
    case 'list':
      const playerList = Object.keys(bot.players);
      console.log(`[BOT] Online players (${playerList.length}): ${playerList.join(', ')}`);
      break;

    case 'nearby':
      const entities = Object.values(bot.entities).filter(e => 
        e.type === 'player' && 
        e !== bot.entity &&
        e.position.distanceTo(bot.entity.position) < 50
      );
      console.log(`[BOT] Nearby players (${entities.length}):`);
      entities.forEach(e => {
        const dist = e.position.distanceTo(bot.entity.position).toFixed(1);
        console.log(`  - ${e.username} (${dist}m away)`);
      });
      break;

    case 'inventory':
    case 'inv':
      const items = bot.inventory.items();
      if (items.length === 0) {
        console.log('[BOT] Inventory is empty');
      } else {
        console.log('[BOT] Inventory:');
        items.forEach(item => {
          console.log(`  - ${item.name} x${item.count} [Slot ${item.slot}]`);
        });
      }
      break;

    case 'equip':
      if (args.length < 2) {
        console.log('[ERROR] Usage: equip <item name>');
      } else {
        const itemName = args.slice(1).join(' ');
        const item = bot.inventory.items().find(i => i.name.includes(itemName));
        if (item) {
          bot.equip(item, 'hand', (err) => {
            if (err) console.log(`[ERROR] ${err.message}`);
            else console.log(`[BOT] Equipped ${item.name}`);
          });
        } else {
          console.log(`[ERROR] Item not found: ${itemName}`);
        }
      }
      break;

    case 'toss':
    case 'drop':
      if (args.length < 2) {
        console.log('[ERROR] Usage: toss <item name> [amount]');
      } else {
        const itemName = args[1];
        const amount = args[2] ? parseInt(args[2]) : 1;
        const item = bot.inventory.items().find(i => i.name.includes(itemName));
        if (item) {
          bot.toss(item.type, null, amount, (err) => {
            if (err) console.log(`[ERROR] ${err.message}`);
            else console.log(`[BOT] Tossed ${amount}x ${item.name}`);
          });
        } else {
          console.log(`[ERROR] Item not found: ${itemName}`);
        }
      }
      break;

    case 'attack':
    case 'hit':
    case 'leftclick':
      if (args.length > 1) {
        // Attack specific player
        const targetName = args[1];
        const entity = Object.values(bot.entities).find(e => 
          e.username && e.username.toLowerCase() === targetName.toLowerCase()
        );
        if (entity) {
          bot.attack(entity);
          console.log(`[BOT] Attacked ${entity.username}`);
        } else {
          console.log(`[ERROR] Player ${targetName} not found`);
        }
      } else {
        // Attack closest entity
        const entity = bot.nearestEntity(e => {
          return e.type !== 'object' && e.type !== 'player' && e.type !== 'orb';
        });
        if (entity) {
          bot.attack(entity);
          const name = entity.name || entity.username || entity.type;
          console.log(`[BOT] Attacked nearest entity: ${name}`);
        } else {
          console.log('[ERROR] No nearby entities to attack');
        }
      }
      break;

    case 'interact':
    case 'rightclick':
    case 'click':
      // Get the closest entity within range
      const closestEntity = bot.nearestEntity(e => {
        const dist = e.position.distanceTo(bot.entity.position);
        return dist < 6; // Within interaction range
      });
      
      if (closestEntity) {
        const name = closestEntity.name || closestEntity.username || closestEntity.type;
        const dist = closestEntity.position.distanceTo(bot.entity.position).toFixed(2);
        
        // Look at the entity first
        bot.lookAt(closestEntity.position.offset(0, closestEntity.height / 2, 0));
        
        // Try to interact with it
        bot.activateEntity(closestEntity);
        console.log(`[BOT] Right-clicked on ${name} (${dist}m away)`);
      } else {
        console.log('[ERROR] No entities nearby to interact with (must be within 6 blocks)');
      }
      break;

    case 'clickat':
      if (args.length < 2) {
        console.log('[ERROR] Usage: clickat <entity_name_or_type>');
      } else {
        const searchTerm = args.slice(1).join(' ').toLowerCase();
        const entity = Object.values(bot.entities).find(e => {
          const name = (e.name || e.username || e.type || '').toLowerCase();
          return name.includes(searchTerm);
        });
        
        if (entity) {
          const name = entity.name || entity.username || entity.type;
          const dist = entity.position.distanceTo(bot.entity.position).toFixed(2);
          
          bot.lookAt(entity.position.offset(0, entity.height / 2, 0));
          bot.activateEntity(entity);
          console.log(`[BOT] Right-clicked on ${name} (${dist}m away)`);
        } else {
          console.log(`[ERROR] Entity not found: ${searchTerm}`);
        }
      }
      break;

    case 'entities':
    case 'nearby':
      const range = args[1] ? parseFloat(args[1]) : 20;
      const nearbyEntities = Object.values(bot.entities).filter(e => 
        e !== bot.entity &&
        e.position.distanceTo(bot.entity.position) < range
      ).sort((a, b) => {
        const distA = a.position.distanceTo(bot.entity.position);
        const distB = b.position.distanceTo(bot.entity.position);
        return distA - distB;
      });
      
      console.log(`[BOT] Nearby entities within ${range} blocks (${nearbyEntities.length}):`);
      nearbyEntities.forEach((e, i) => {
        const dist = e.position.distanceTo(bot.entity.position).toFixed(1);
        const name = e.name || e.username || e.type;
        const type = e.type;
        console.log(`  ${i + 1}. ${name} [${type}] - ${dist}m away`);
      });
      
      if (nearbyEntities.length === 0) {
        console.log('  (none)');
      }
      break;

    case 'disconnect':
    case 'quit':
    case 'exit':
      console.log('[BOT] Disconnecting...');
      bot.quit();
      break;

    case 'help':
      console.log('\n=== Available Commands ===');
      console.log('\n⚠️  BOT COMMANDS (no slash):');
      console.log('Movement:');
      console.log('  goto <x> <y> <z>      - Smart pathfinding to coords');
      console.log('  gotoforce <x> <y> <z> - Walk directly (ignores obstacles)');
      console.log('  walk <direction>      - Manual walk (forward/back/left/right/stop)');
      console.log('  follow <player>       - Follow a player');
      console.log('  come <player>         - Go near a player');
      console.log('  stop                  - Stop all movement');
      console.log('  jump                  - Jump once');
      console.log('  sneak                 - Toggle sneak');
      console.log('  sprint                - Toggle sprint');
      console.log('\nChat:');
      console.log('  chat <message>        - Send chat message');
      console.log('  whisper <player> <m>  - Private message');
      console.log('\nInfo:');
      console.log('  pos                   - Show position');
      console.log('  health                - Show health/food');
      console.log('  players               - List all players');
      console.log('  entities [range]      - List nearby entities');
      console.log('  inventory             - Show inventory');
      console.log('\nActions:');
      console.log('  interact              - Right-click closest entity');
      console.log('  clickat <name>        - Right-click specific entity');
      console.log('  attack [name]         - Left-click entity');
      console.log('  lookat <name>         - Look at entity');
      console.log('  look <player>         - Look at player');
      console.log('  equip <item>          - Equip item');
      console.log('  toss <item> [amount]  - Drop items');
      console.log('  use                   - Use item in hand');
      console.log('\nOther:');
      console.log('  disconnect            - Quit bot');
      console.log('  help                  - Show this help');
      console.log('\n🎮 SERVER COMMANDS (with slash):');
      console.log('  /register <password>  - Register account');
      console.log('  /login <password>     - Login to account');
      console.log('  /spawn                - Teleport to spawn');
      console.log('  (any command starting with / goes to server)\n');
      break;

    default:
      // If command starts with /, treat it as a chat command
      if (input.startsWith('/')) {
        bot.chat(input);
        console.log(`[BOT] Sent command: ${input}`);
      } else {
        console.log(`[ERROR] Unknown command: ${cmd}. Type 'help' for commands.`);
      }
  }
}

// Console input handler
rl.on('line', (input) => {
  if (input.trim()) {
    handleCommand(input);
  }
  rl.prompt();
});

// Handle Ctrl+C gracefully
rl.on('SIGINT', () => {
  console.log('\n[BOT] Disconnecting...');
  bot.quit();
  setTimeout(() => process.exit(0), 500);
});

// Load pathfinder plugin
try {
  const pathfinder = require('mineflayer-pathfinder').pathfinder;
  const Movements = require('mineflayer-pathfinder').Movements;
  
  bot.loadPlugin(pathfinder);
  pathfinderLoaded = true;
  
  bot.once('spawn', () => {
    mcData = require('minecraft-data')(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = false; // Don't break blocks while pathing
    defaultMove.scafoldingBlocks = []; // Don't place blocks
    bot.pathfinder.setMovements(defaultMove);
    console.log('[BOT] Pathfinder loaded successfully');
  });
  
  console.log('[INFO] Pathfinder plugin loaded');
} catch (err) {
  console.log('[WARNING] Pathfinder not available. Movement commands disabled.');
  console.log('[INFO] Install with: npm install mineflayer-pathfinder');
}

console.log('=== Mineflayer Bot ===');
console.log(`Connecting to ${BOT_CONFIG.host}:${BOT_CONFIG.port}...`);
console.log('\nType "help" for available commands.');
console.log('Commands starting with / are sent directly to server.\n');
