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

const { guildID, channelID } = require("./config.json");
const { token } = require("./token.json");
const { imageHashes } = require("./imageHashes.json");

const detectConfidence = 85; // % of similarity between two images to be considered a match
const maxLinks = 5; // maximum number of links to be displayed in the message
const minutesAutoDelete = 5; // minutes until auto deleting message
// const reactionEmojis = {
//   1: "1️⃣",
//   2: "2️⃣",
//   3: "3️⃣",
//   4: "4️⃣",
//   5: "5️⃣",
//   6: "6️⃣",
//   7: "7️⃣",
//   8: "8️⃣",
//   9: "9️⃣",
//   10: "🔟",
//   0: "0️⃣",
// };

let toAddHashes = {};
let deleteTimer = {};

client.on("ready", () => {
  console.log(`Bot (${client.user.tag}) ready.`);
});

client.on("interactionCreate", async (interaction) => {
  const data = interaction.customId.split(":");
  const action = data[0];
  const messageID = data[1];
  const authorID = data[2];
  if (interaction.member.id == authorID) {
    interaction.message.delete();
    const message = await interaction.message.channel.messages.fetch(messageID);
    if (action == "DELETE") message.delete();
    if (action != "DELETE") addHash(messageID);
  }
});

client.on("messageDelete", async (message) => {
  if (deleteTimer[message.id]) {
    clearTimeout(deleteTimer[message.id]);
    delete deleteTimer[message.id];
  }
  removeHash(message.id);
});

client.on("messageCreate", async (message) => {
  if (message.guild == guildID) {
    if (message.channel == channelID) {
      const attachments = message.attachments;
      if (attachments.size > 0) {
        let messagesLinks = await getMessageLinks(message, { count: 0, content: "" }, attachments, 0);
        if (messagesLinks.count != 0) sendReply(message, messagesLinks, attachments.size);
      }
    }
  }
});

async function getMessageLinks(message, messagesLinks, attachments, index) {
  let attachment = attachments.at(index);
  let attachmentImage = await Jimp.read(attachment.url);
  const hash = attachmentImage.hash();
  if (!toAddHashes[message.id]) toAddHashes[message.id] = [];
  toAddHashes[message.id].push(hash);
  if (hash != "80000000000") {
    const { similarImages, confidence } = compareHashes(hash, 100);
    if (similarImages.length > 0) {
      if (attachments.size > 1) messagesLinks.content += `${index + 1}${enumerate(index + 1)} Image | `;
      messagesLinks.content += `*Confidence: ~${confidence}%*\n`;
      similarImages.forEach((similarImage, index) => {
        if (index <= maxLinks) {
          checkMessage(message.channel, similarImage.messageID);
          messagesLinks.count++;
          messagesLinks.content += `https://discord.com/channels/${guildID}/${channelID}/${similarImage.messageID}\n`;
        }
      });
    } else addHash(message.id);
  }
  if (index < attachments.size - 1) return getMessageLinks(message, messagesLinks, attachments, index + 1);
  else return messagesLinks;
}

function sendReply(message, messagesLinks, attachmentCount) {
  // NOTE: Not working with multiple attachments:
  // NOTE: Confidence is now in 1% steps, not 10% steps, which makes following code incompatible:
  // message.react("🔁").then(() => {
  //   if (confidence >= 10 && confidence <= 100)
  //     if (confidence == 100)
  //       message.react(reactionEmojis[10]).then(() => {
  //         message.react(reactionEmojis[0]);
  //       });
  //     else
  //       message.react(reactionEmojis[confidence / 10]).then(() => {
  //         message.react(reactionEmojis[0]);
  //       });
  // });
  const row = new MessageActionRow().addComponents(
    new MessageButton().setCustomId(`DELETE:${message.id}:${message.author.id}`).setLabel("Yes").setStyle("DANGER"),
    new MessageButton().setCustomId(`IGNORE:${message.id}:${message.author.id}`).setLabel("No").setStyle("SUCCESS"),
    new MessageButton()
      .setCustomId(`NOREPOST:${message.id}:${message.author.id}`)
      .setLabel("Not a Repost")
      .setStyle("SECONDARY")
  );
  message
    .reply({
      content: `Hey ${
        message.member.displayName
      }!\nThe image you posted seems familiar. Could you please check the link${
        messagesLinks.count > 1 ? "s" : ""
      } below to check if this is a repost?\n\n${
        messagesLinks.content
      }\nIf you think this **is a repost** and want to **delete your message** click on **Yes**.\nIf you think this **is a repost** and want to **keep it**, just click on **No**.\nThis is not a repost? I am still learning, to improve in the future! Please click on **Not a Repost** to help me out!${
        attachmentCount > 1
          ? `\n**You posted ${attachmentCount} images in one message, if you click on Yes the whole message with all images will be deleted!**`
          : ""
      }\n\nThis message will self destruct in ${minutesAutoDelete} minute${
        minutesAutoDelete != 1 ? "s" : ""
      } (hopefully).`,
      components: [row],
    })
    .then((reply) => {
      deleteTimer[message.id] = setTimeout(() => {
        reply.delete();
      }, 1000 * 60 * minutesAutoDelete);
    });
}

function enumerate(number) {
  const _e = {
    1: "st",
    2: "nd",
    3: "rd",
    4: "th",
  };
  if (number > 0 && number < 5) return _e[number];
  else return "th";
}

function checkMessage(channel, messageID) {
  channel.messages.fetch(messageID).catch(() => {
    removeHash(messageID);
  });
}

function removeHash(messageID) {
  let index = imageHashes.findIndex((imageHash) => imageHash.messageID == messageID);
  if (index != -1) imageHashes.splice(index, 1);
  saveHashes();
}

function addHash(messageID) {
  if (toAddHashes[messageID]) {
    toAddHashes[messageID].forEach((hash) => {
      imageHashes.push({ messageID, hash });
    });
    delete toAddHashes[messageID];
    saveHashes();
  }
}

function saveHashes() {
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
  if (similarImages.length == 0 && minSimilarity >= detectConfidence) return compareHashes(hash, minSimilarity - 1);
  else return { similarImages, confidence: minSimilarity };
}

client.login(token);
