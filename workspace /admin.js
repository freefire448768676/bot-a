const { Telegraf, Markup } = require("telegraf");
const { eq, desc, sql, and } = require("drizzle-orm");

const {
  db,
  depositMethodsTable,
  depositRequestsTable,
  productOverridesTable,
  categoryOverridesTable,
  ordersTable,
  broadcastsTable,
  usersTable,
  contactLinksTable,
  virtualCategoriesTable,
  manualProductsTable,
  manualOrdersTable,
} = require("./db.js"); // غيرت ../db.js لـ ./db.js لانه هلق admin.js بنفس مجلد db.js

const { setStep, getStep } = require("./state.js"); // غيرت ../state.js لـ ./state.js
const { callAiSupport, clearAiHistory, hasAiKey } = require("./ai-support.js"); // غيرت ../ai-support.js لـ ./ai-support.js

const {
  getAdminPassword,
  setSetting,
  getSetting,
  getMarkupPercent,
  getSocialMarkupPercent,
  getExchangeRate,
  getBotStatus,
} = require("./settings.js"); // غيرت ../settings.js لـ ./settings.js

const { ensureUser, ADMIN_USERNAME } = require("./start.js"); // غيرت ./start.js لـ ./start.js

const {
  getUser,
  setAdmin,
  setStatus,
  adjustBalance,
  setBalance,
  listUsers,
  countUsers,
  searchUser,
  markAdminAuthed,
} = require("./users.js"); // غيرت ../users.js لـ ./users.js

const { sendOrEdit, clearInlineKeyboard } = require("./tg.js"); // غيرت ../tg.js لـ ./tg.js
const { invalidateCaches } = require("./categories.js"); // غيرت ./categories.js لـ ./categories.js
const { logger } = require("../lib/logger.js"); // هاد ضل ../ لانه lib برا src

const ADMIN_USERNAMES_LOWER = (process.env.ADMIN_USERNAME ?? ADMIN_USERNAME)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAdminUsername(u) {
  if (!u) return false;
  return ADMIN_USERNAMES_LOWER.includes(u.toLowerCase());
}

async function requireAdmin(ctx) {
  const u = await getUser(ctx.from.id);
  if (!u?.isAdmin) {
    await ctx.reply("⛔ هذا القسم للإدارة فقط.");
    return false;
  }
  return true;
}

async function showAdminMenu(ctx) {
  if (!(await requireAdmin(ctx))) return;
  const status = await getBotStatus();
  const rows = [
    [
      Markup.button.callback("📥 طلبات الإيداع", "adm:depList:1"),
      Markup.button.callback("👥 المستخدمون", "adm:users:1"),
    ],
    [
      Markup.button.callback("🔍 بحث مستخدم", "adm:findUser"),
      Markup.button.callback("📦 كل الطلبات", "adm:allOrders:1"),
    ],
    [
      Markup.button.callback("📣 رسالة جماعية", "adm:broadcast"),
      Markup.button.callback("💳 طرق الإيداع", "adm:methods"),
    ],
    [
      Markup.button.callback("🛒 إدارة المنتجات", "cat:0:1:0"),
      Markup.button.callback("⚙️ الإعدادات", "adm:settings"),
    ],
    [
      Markup.button.callback("📞 وسائل التواصل", "adm:contacts"),
      Markup.button.callback("📁 أقسام مخصصة", "adm:vcList"),
    ],
    [
      Markup.button.callback("➕ إضافة منتج يدوي", "adm:manualProds"),
      Markup.button.callback("🛠️ الإصلاحات والتعديل", "adm:aiSupport"),
    ],
    [
      Markup.button.callback("🔄 بينج تلقائي /start", "adm:ping"),
      Markup.button.callback(
        status === "on" ? "🟢 البوت: شغال" : "🔴 البوت: متوقف",
        "adm:toggleStatus",
      ),
    ],
    [Markup.button.callback("🏠 الرئيسية", "home")],
  ];
  await sendOrEdit(ctx, "👑 لوحة الإدارة", Markup.inlineKeyboard(rows));
}

// هون بتحط باقي الدوال تبعك كاملة: showSettingsMenu, showDepList, approveDeposit... الخ
// نفس الكود اللي عندك بس بدون :string و :number و interface

function registerAdmin(bot) {
  bot.command("admin", async (ctx) => {
    await ensureUser(ctx);
    const u = await getUser(ctx.from.id);
    if (u?.isAdmin) await showAdminMenu(ctx);
    else await startAdminLogin(ctx);
  });

  // كل الـ bot.action نفسهن بدون تغيير
}

function registerAdminTextHandlers(bot) {
  bot.on("text", async (ctx, next) => {
    const step = getStep(ctx.from.id);
    const txt = ctx.message.text.trim();
    if (txt.startsWith("/")) return next();
    
    // كل الـ switch case تبعك هون
  });
}

module.exports = { registerAdmin, registerAdminTextHandlers };
