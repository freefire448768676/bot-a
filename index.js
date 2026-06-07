const { Telegraf } = require("telegraf");
const { registerAdmin, registerAdminTextHandlers, startPingScheduler } = require("./workspace/admin.js");
require("dotenv").config();

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch().then(() => {
  console.log("البوت اشتغل على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
