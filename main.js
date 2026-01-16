const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals: { GoalBlock } } = require('mineflayer-pathfinder');
const readline = require('readline');

// Setup readline for console input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function createBot() {
  const bot = mineflayer.createBot({
    host: 'minegens.id', // Change to your server IP
    port: 25565,
    username: 'MyBot',
    version: false,
    hideErrors: false
  });

  // Load pathfinder plugin
  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('Bot has spawned in the server!');
    
    // Set up pathfinder movements
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    
    bot.chat('/help');
    
    // Start listening for console input
    console.log('\nEnter commands (goto x y z, click, chat <message>, or quit):');
    promptInput();
  });

  bot.on('login', () => {
    console.log('Bot logged in successfully!');
    console.log(`Username: ${bot.username}`);
  });

  bot.on('chat', (username, message) => {
    console.log(`[${username}]: ${message}`);
  });

  // Handle console input
  function promptInput() {
    rl.question('> ', async (input) => {
      const message = input.trim();
      
      if (message === 'quit') {
        bot.quit();
        rl.close();
        process.exit(0);
      }
      
      // Command: goto x y z
      if (message.startsWith('goto')) {
        const args = message.split(' ');
        const x = parseInt(args[1]);
        const y = parseInt(args[2]);
        const z = parseInt(args[3]);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          console.log('Usage: goto <x> <y> <z>');
        } else {
          console.log(`Going to ${x} ${y} ${z}...`);
          
          try {
            await bot.pathfinder.goto(new GoalBlock(x, y, z));
            console.log('Arrived! Right-clicking...');
            
            const block = bot.blockAt(bot.entity.position.offset(0, -1, 0));
            
            if (block) {
              await bot.activateBlock(block);
              console.log('Block activated!');
            }
          } catch (err) {
            console.log(`Error: ${err.message}`);
          }
        }
      }
      
      // Command: click
      else if (message === 'click') {
        const block = bot.blockAtCursor(4);
        if (block) {
          try {
            await bot.activateBlock(block);
            console.log(`Clicked ${block.name}!`);
          } catch (err) {
            console.log(`Error: ${err.message}`);
          }
        } else {
          console.log('No block in range!');
        }
      }
      
      // Command: chat <message>
      else if (message.startsWith('chat ')) {
        const chatMessage = message.substring(5);
        bot.chat(chatMessage);
        console.log(`Sent: ${chatMessage}`);
      }
      
      // Default: send as chat
      else if (message) {
        bot.chat(message);
        console.log(`Sent: ${message}`);
      }
      
      promptInput(); // Continue loop
    });
  }

  bot.on('error', (err) => {
    console.error('Bot error:', err.message);
  });

  bot.on('kicked', (reason) => {
    console.log('Bot was kicked:', reason);
    setTimeout(createBot, 5000);
  });

  bot.on('end', () => {
    console.log('Bot disconnected');
    setTimeout(createBot, 5000);
  });
}

// Start the bot
createBot();
