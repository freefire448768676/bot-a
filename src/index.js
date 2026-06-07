const { Telegraf } = require("telegraf");
const dotenv = require("dotenv");
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// استدعاء ملف الادمن - المسار مظبوط 100%
const { registerAdmin, registerAdminTextHandlers, startPingScheduler } = require("../workspace/admin.js");

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch().then(() => {
  console.log("البوت اشتغل على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
