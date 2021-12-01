// jshint esversion: 6
const fs = require("fs");
const Jimp = require("jimp");
const images = require("./data/images.json");
const imageFolder = "./data/images/";

let imageHashes = [];

// images.messages = images.messages.slice(0, 10);

images.messages.forEach((message) => {
  let messageID = message.id;
  let attachments = message.attachments.filter((attachment) => {
    return (
      attachment.url.endsWith(".png") ||
      attachment.url.endsWith(".jpg") ||
      attachment.url.endsWith(".jpeg") ||
      attachment.url.endsWith(".gif") ||
      attachment.url.endsWith(".bmp") ||
      attachment.url.endsWith(".tiff")
    );
  });
  if (attachments.length > 0) {
    attachments.forEach((attachment) => {
      imageHashes.push({ messageID, fileName: attachment.url });
    });
  }
});

let buggedFiles = [];
genImageHash(0);

async function genImageHash(i) {
  let fileName = imageHashes[i].fileName;
  let path = imageFolder + fileName;
  console.log(`${i + 1}/${imageHashes.length} | ${fileName}`);
  await Jimp.read(path)
    .then((image) => {
      if (image.hash() == "80000000000") buggedFiles.push(fileName);
      else imageHashes[i].hash = image.hash();
    })
    .catch((err) => {
      console.warn(err);
    });
  if (i + 1 < imageHashes.length) genImageHash(i + 1);
  else {
    imageHashes = imageHashes.filter((image) => !buggedFiles.includes(image.fileName));
    imageHashes.forEach((image) => {
      delete image.fileName;
    });
    fs.writeFileSync("./imageHashes.json", JSON.stringify({ imageHashes }, null, 2));
  }
}
