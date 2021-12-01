// jshint esversion: 6

const fs = require("fs");
const Jimp = require("jimp");
const { Client, Intents, MessageActionRow, MessageButton } = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
  ],
});

const { token } = require("./token.json");
const { imageHashes } = require("./imageHashes.json");

const guildID = "203778798406074368";
const channelID = "378626530097496077";
const reactionEmojis = {
  1: "1️⃣",
  2: "2️⃣",
  3: "3️⃣",
  4: "4️⃣",
  5: "5️⃣",
  6: "6️⃣",
  7: "7️⃣",
  8: "8️⃣",
  9: "9️⃣",
  10: "🔟",
  0: "0️⃣",
};

client.on("ready", () => {
  console.log(`Bot (${client.user.tag}) ready.`);
});

client.on("interactionCreate", async (interaction) => {
  interaction.message.delete();
  const data = interaction.customId.split(":");
  const messageID = data[0];
  const action = data[1];
  const message = await interaction.message.channel.messages.fetch(messageID);
  if (action == "DELETE") message.delete();
});

client.on("messageCreate", async (message) => {
  if (message.guild == guildID) {
    if (message.channel == channelID) {
      const attachments = message.attachments;
      if (attachments.size > 0) {
        attachments.forEach((attachment) => {
          Jimp.read(attachment.url).then((image) => {
            const hash = image.hash();
            if (hash != "80000000000") {
              // saveHash(message.id, hash); TODO: Uncomment this when ready to save hashes.
              const { similarImages, confidence_ } = compareHashes(hash, 100);
              if (similarImages.length > 0) {
                let messagesLinks = "";
                similarImages.forEach((image, index) => {
                  if (index < 5) {
                    messagesLinks += `https://discord.com/channels/${guildID}/${channelID}/${image.messageID}\n`;
                  }
                });
                message.react("🔁").then(() => {
                  if (confidence >= 10 && confidence <= 100)
                    if (confidence == 100)
                      message.react(reactionEmojis[10]).then(() => {
                        message.react(reactionEmojis[0]);
                      });
                    else
                      message.react(reactionEmojis[confidence / 10]).then(() => {
                        message.react(reactionEmojis[0]);
                      });
                });
                const row = new MessageActionRow().addComponents(
                  new MessageButton().setCustomId(`${message.id}:DELETE`).setLabel("Yes").setStyle("DANGER"),
                  new MessageButton().setCustomId(`${message.id}:IGNORE`).setLabel("No").setStyle("SUCCESS"),
                  new MessageButton()
                    .setCustomId(`${message.id}:NOREPOST`)
                    .setLabel("Not a Repost")
                    .setStyle("SECONDARY")
                );
                message
                  .reply({
                    content: `Hey ${
                      message.member.displayName
                    }!\nThe image you posted seems familiar. Could you please check the link${
                      attachments.length > 1 ? "s" : ""
                    } below to check if your image is a repost?\n\n**Confidence: ~${confidence}%**\n${messagesLinks}\nIf you think this **is a repost** and want to **delete your message** click on **Yes**.\nIf you think this **is a repost** and want to **keep it**, just click on **No**.\nThis is not a repost? I am still learning, to improve in the future! Please click on **Not a Repost** to help me out!\n\nThis message will self destruct in 5 minutes (hopefully).`,
                    components: [row],
                  })
                  .then((reply) => {
                    setTimeout(() => {
                      reply.delete();
                    }, 1000 * 60 * 5);
                  });
              }
            }
          });
        });
      }
    }
  }
});

function saveHash(messageID, hash) {
  imageHashes.push({ messageID, hash });
  fs.writeFileSync("./imageHashes.json", JSON.stringify({ imageHashes }, null, 2));
}

function compareHashes(hash, minSimilarity) {
  let similarImages = [];
  imageHashes.forEach((_image) => {
    let diff = Jimp.compareHashes(hash, _image.hash);
    let percent = (100 - diff * 100).toFixed(1);
    if (percent >= minSimilarity) {
      similarImages.push({ ..._image, percent: percent, hash: _image.hash });
    }
  });
  if (similarImages.length == 0 && minSimilarity >= 40) return compareHashes(hash, minSimilarity - 10);
  else return { similarImages, confidence: minSimilarity };
}

client.login(token);