const Discord = require('discord.js');
const fetch = require('node-fetch');
const axios = require('axios');

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers
  ]
});

const SHEETS_URL = process.env.SHEETS_URL;
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID;
const BOT_TOKEN = process.env.BOT_TOKEN;
const ROVER_API_KEY = process.env.ROVER_API_KEY; // Optional, kalau pakai API

client.once('ready', async () => {
  console.log(`✅ Bot ${client.user.tag} online!`);
  
  const commands = [
    {
      name: 'verify',
      description: 'Verifikasi akun Roblox kamu (harus sudah verify di RoVer/Bloxlink)'
    }
  ];
  
  await client.application.commands.set(commands);
  console.log('✅ Slash commands terdaftar!');
});

// Fungsi untuk cek Roblox username dari RoVer
async function getRobloxFromRover(discordId, guildId) {
  try {
    // Method 1: Pakai RoVer API (kalau punya API key)
    if (ROVER_API_KEY) {
      const response = await axios.get(`https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`, {
        headers: { 'Authorization': `Bearer ${ROVER_API_KEY}` }
      });
      return response.data;
    }
    
    // Method 2: Pakai endpoint public RoVer (backup)
    const response = await axios.get(`https://verify.eryn.io/api/user/${discordId}`);
    
    if (response.data && response.data.robloxId) {
      return {
        robloxId: response.data.robloxId,
        robloxUsername: response.data.robloxUsername
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Roblox from RoVer:', error.message);
    return null;
  }
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.commandName === 'verify') {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      // Step 1: Cek apakah user sudah verify di RoVer/Bloxlink
      const robloxData = await getRobloxFromRover(interaction.user.id, interaction.guild.id);
      
      if (!robloxData || !robloxData.robloxId) {
        return interaction.editReply({
          content: '❌ **Kamu belum verify di RoVer!**\n\n' +
                   '**Cara verify:**\n' +
                   '1. Ketik `/verify` (command dari RoVer bot)\n' +
                   '2. Buka link yang diberikan RoVer\n' +
                   '3. Login ke akun Roblox kamu\n' +
                   '4. Setelah selesai, ketik `/verify` di bot ini lagi\n\n' +
                   '**Belum ada RoVer?** Invite: https://rover.link/invite'
        });
      }
      
      const robloxUsername = robloxData.robloxUsername;
      const robloxId = robloxData.robloxId;
      
      // Step 2: Cek apakah sudah pernah verify di sistem kita
      const checkUrl = SHEETS_URL + '?userid=' + robloxId;
      const checkResponse = await fetch(checkUrl);
      const checkData = await checkResponse.json();
      
      if (checkData.verified === true) {
        return interaction.editReply({
          content: '⚠️ Kamu sudah terverifikasi sebelumnya!\n' +
                   `**Username Roblox:** ${robloxUsername}\n` +
                   'Kamu sudah bisa join game sekarang.'
        });
      }
      
      // Step 3: Simpan ke Google Sheets
      await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: interaction.user.id,
          robloxUsername: robloxUsername,
          robloxUserId: robloxId
        })
      });
      
      // Step 4: Kasih role "Warga"
      const role = interaction.guild.roles.cache.get(VERIFIED_ROLE_ID);
      
      if (role) {
        await interaction.member.roles.add(role);
        
        const embed = new Discord.EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('✅ Verifikasi Berhasil!')
          .setDescription(`Selamat datang di server RP, ${interaction.user}!`)
          .addFields(
            { name: '👤 Username Roblox', value: robloxUsername, inline: true },
            { name: '🆔 Roblox ID', value: robloxId.toString(), inline: true },
            { name: '🎮 Status', value: '✅ Kamu sekarang bisa join game!', inline: false }
          )
          .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`)
          .setFooter({ text: 'Selamat bermain!' })
          .setTimestamp();
        
        await interaction.editReply({ embeds: [embed] });
        
        // Log ke console
        console.log(`✅ ${interaction.user.tag} verified as ${robloxUsername} (${robloxId})`);
      } else {
        await interaction.editReply({
          content: '✅ Data tersimpan, tapi role "Warga" tidak ditemukan!\nHubungi admin.'
        });
      }
      
    } catch (error) {
      console.error('Error during verification:', error);
      await interaction.editReply({
        content: '❌ Terjadi error saat verifikasi!\n' +
                 'Coba lagi dalam beberapa saat atau hubungi admin.\n\n' +
                 '**Error:** ' + error.message
      });
    }
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.login(BOT_TOKEN);
