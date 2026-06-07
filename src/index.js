const { Telegraf } = require("telegraf");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// هاد المسار رح يشتغل 100% وين ما كان Render
const { registerAdmin, registerAdminTextHandlers, startPingScheduler } = require(path.join(__dirname, "../workspace/admin.js"));

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch().then(() => {
  console.log("البوت اشتغل على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
