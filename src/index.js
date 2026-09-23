require('dotenv').config();

const { Client, EmbedBuilder, Events, GatewayIntentBits } = require('discord.js');
const dlCommand = require('./commands/dl');

const token = process.env.BOT_TOKEN;
const prefix = process.env.PREFIX || '!';

if (!token || token === 'your_bot_token_here') {
  throw new Error('BOT_TOKEN belum diisi di file .env.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot aktif sebagai ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const parts = message.content.trim().split(/\s+/);
  const commandName = parts[0]?.toLowerCase();
  if (commandName !== `${prefix.toLowerCase()}dl`) return;

  try {
    await dlCommand.execute(message, parts[1]);
  } catch (error) {
    console.error('❌ Error pada command prefix:', error);
    await message.reply({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Gagal Memproses Command')
        .setDescription('Terjadi kesalahan saat memproses command download.')
        .setColor(0xed4245)]
    }).catch(() => {});
  }
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

client.login(token);
