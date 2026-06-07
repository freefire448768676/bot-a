const { Telegraf } = require("telegraf");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// بدور على admin.js لحاله وين ما كان
let adminPath;
const possiblePaths = [
  path.join(__dirname, "../workspace/admin.js"),
  path.join(__dirname, "./workspace/admin.js"),
  path.join(__dirname, "admin.js")
];

for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    adminPath = p;
    console.log("لقيت admin.js بـ:", p);
    break;
  }
}

if (!adminPath) {
  console.error("خطأ: ما لقيت ملف admin.js بأي مكان!");
  process.exit(1);
}

const { registerAdmin, registerAdminTextHandlers, startPingScheduler } = require(adminPath);

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch().then(() => {
  console.log("البوت اشتغل على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
