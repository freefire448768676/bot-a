const { Telegraf } = require("telegraf");
const dotenv = require("dotenv");

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// هون المسار - اذا workspace بنفس مستوى src استخدم هاد
let admin;
try {
  admin = require("../workspace/admin.js");
} catch (e) {
  // اذا ما زبط جرب هاد المسار
  admin = require("./workspace/admin.js");
}

const { registerAdmin, registerAdminTextHandlers, startPingScheduler } = admin;

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch().then(() => {
  console.log("البوت اشتغل على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
