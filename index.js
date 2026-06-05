import { Telegraf } from "telegraf";
import { registerAdmin, registerAdminTextHandlers, startPingScheduler } from "./workspace/admin.js";
import dotenv from "dotenv";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

registerAdmin(bot);
registerAdminTextHandlers(bot);
startPingScheduler(bot);

bot.launch(() => {
  console.log("البوت شغال على Render ✅");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
