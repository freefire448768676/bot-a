import type { Telegraf, Context } from "telegraf";
import { Markup } from "telegraf";
import type { InlineKeyboardButton } from "telegraf/types";
import { eq, desc, sql, and } from "drizzle-orm";
import {
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
} from "@workspace/db";
import { setStep, getStep } from "../state";
import { callAiSupport, clearAiHistory, hasAiKey } from "../ai-support";
import {
  getAdminPassword,
  setSetting,
  getSetting,
  getMarkupPercent,
  getSocialMarkupPercent,
  getExchangeRate,
  getBotStatus,
} from "../settings";
import {
  ensureUser,
  ADMIN_USERNAME,
} from "./start";
import {
  getUser,
  setAdmin,
  setStatus,
  adjustBalance,
  setBalance,
  listUsers,
  countUsers,
  searchUser,
  markAdminAuthed,
} from "../users";
import { sendOrEdit, clearInlineKeyboard } from "../tg";
import { invalidateCaches } from "./categories";
import { logger } from "../../lib/logger";

const ADMIN_USERNAMES_LOWER = (process.env["ADMIN_USERNAME"] ?? ADMIN_USERNAME)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAdminUsername(u?: string | null) {
  if (!u) return false;
  return ADMIN_USERNAMES_LOWER.includes(u.toLowerCase());
}

async function requireAdmin(ctx: Context): Promise<boolean> {
  const u = await getUser(ctx.from!.id);
  if (!u?.isAdmin) {
    await ctx.reply("⛔ هذا القسم للإدارة فقط.");
    return false;
  }
  return true;
}

async function showAdminMenu(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const status = await getBotStatus();
  const rows: InlineKeyboardButton[][] = [
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

async function showSettingsMenu(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const m = await getMarkupPercent();
  const sm = await getSocialMarkupPercent();
  const r = await getExchangeRate();
  const text =
    `⚙️ الإعدادات\n\n` +
    `الربح العام: ${m}%\n` +
    `ربح السوشل ميديا: ${sm}%\n` +
    `سعر الصرف: ${r} ل.س لكل دولار`;
  await sendOrEdit(
    ctx,
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback("✏️ تعديل الربح العام", "adm:setMarkup")],
      [Markup.button.callback("✏️ تعديل ربح السوشل", "adm:setSocialMarkup")],
      [Markup.button.callback("💱 تعديل سعر الصرف", "adm:setRate")],
      [Markup.button.callback("🔑 تغيير كلمة المرور", "adm:newPass")],
      [Markup.button.callback("🔘 تعديل أزرار التنقل", "adm:btnLabels")],
      [Markup.button.callback("⬅️ رجوع", "admin:menu")],
    ]),
  );
}

/* ---------- Deposits ---------- */

async function showDepList(ctx: Context, page: number) {
  if (!(await requireAdmin(ctx))) return;
  const limit = 8;
  const offset = (page - 1) * limit;
  const rows = await db
    .select()
    .from(depositRequestsTable)
    .where(eq(depositRequestsTable.status, "pending"))
    .orderBy(desc(depositRequestsTable.createdAt))
    .limit(limit + 1)
    .offset(offset);
  const hasNext = rows.length > limit;
  const slice = rows.slice(0, limit);
  if (slice.length === 0) {
    await sendOrEdit(
      ctx,
      "📭 لا توجد طلبات إيداع معلقة.",
      Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", "admin:menu")]]),
    );
    return;
  }
  const kb: InlineKeyboardButton[][] = slice.map((d) => [
    Markup.button.callback(
      `#${d.id} • ${d.methodName} • UID:${d.userId}`,
      `adm:depShow:${d.id}`,
    ),
  ]);
  const nav: InlineKeyboardButton[] = [];
  if (page > 1) nav.push(Markup.button.callback("⬅️ السابق", `adm:depList:${page - 1}`));
  if (hasNext) nav.push(Markup.button.callback("التالي ➡️", `adm:depList:${page + 1}`));
  if (nav.length) kb.push(nav);
  kb.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
  await sendOrEdit(ctx, "📥 طلبات الإيداع المعلقة:", Markup.inlineKeyboard(kb));
}

async function showDepDetails(ctx: Context, depId: number) {
  if (!(await requireAdmin(ctx))) return;
  const d = (
    await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, depId)).limit(1)
  )[0];
  if (!d) {
    await ctx.reply("⚠️ غير موجود.");
    return;
  }
  const u = await getUser(d.userId);
  const text =
    `📥 طلب إيداع #${d.id}\n` +
    `الحالة: ${d.status}\n` +
    `الطريقة: ${d.methodName}\n` +
    `المستخدم: ${u?.firstName ?? ""} ${u?.username ? "@" + u.username : ""} (${d.userId})\n` +
    `رصيد المستخدم: ${u ? Number(u.balance).toFixed(2) : "0.00"}$\n` +
    `رقم/تفاصيل المُحوِّل: ${d.payerNumber ?? "—"}`;
  const balanceRow = [
    Markup.button.callback("➕ شحن رصيد", `adm:userAdd:${d.userId}`),
    Markup.button.callback("➖ خصم رصيد", `adm:userSub:${d.userId}`),
  ];
  const kb =
    d.status === "pending"
      ? Markup.inlineKeyboard([
          [
            Markup.button.callback("✅ موافقة", `adm:dep:approve:${d.id}`),
            Markup.button.callback("❌ رفض", `adm:dep:reject:${d.id}`),
          ],
          balanceRow,
          [Markup.button.callback("👤 ملف المستخدم", `adm:user:${d.userId}`)],
          [Markup.button.callback("⬅️ رجوع", "adm:depList:1")],
        ])
      : Markup.inlineKeyboard([
          balanceRow,
          [Markup.button.callback("👤 ملف المستخدم", `adm:user:${d.userId}`)],
          [Markup.button.callback("⬅️ رجوع", "adm:depList:1")],
        ]);
  try {
    await ctx.replyWithPhoto(d.screenshotFileId, { caption: text, ...kb });
  } catch {
    await ctx.reply(text + "\n\n(تعذّر تحميل الصورة)", kb);
  }
}

async function approveDeposit(ctx: Context, depId: number) {
  if (!(await requireAdmin(ctx))) return;
  setStep(ctx.from!.id, { kind: "admin:depositApproveAmount", depositId: depId });
  await ctx.reply(
    `💵 أرسل المبلغ بالدولار لإضافته إلى رصيد المستخدم لطلب الإيداع #${depId}:`,
    Markup.inlineKeyboard([[Markup.button.callback("❌ إلغاء", "admin:menu")]]),
  );
}

async function rejectDeposit(ctx: Context, depId: number) {
  if (!(await requireAdmin(ctx))) return;
  await db
    .update(depositRequestsTable)
    .set({
      status: "rejected",
      processedBy: ctx.from!.id,
      processedAt: new Date(),
    })
    .where(eq(depositRequestsTable.id, depId));
  const d = (
    await db.select().from(depositRequestsTable).where(eq(depositRequestsTable.id, depId)).limit(1)
  )[0];
  await ctx.reply(`❌ تم رفض طلب الإيداع #${depId}.`);
  if (d) {
    try {
      await ctx.telegram.sendMessage(
        d.userId,
        `❌ تم رفض طلب الإيداع #${d.id}. للاستفسار راسل @${ADMIN_USERNAMES_LOWER[0] ?? ""}.`,
      );
    } catch {
      /* ignore */
    }
  }
}

/* ---------- Users ---------- */

async function showUsersList(ctx: Context, page: number) {
  if (!(await requireAdmin(ctx))) return;
  const limit = 10;
  const offset = (page - 1) * limit;
  const rows = await listUsers(offset, limit);
  const total = await countUsers();
  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (rows.length === 0) {
    await sendOrEdit(
      ctx,
      "👥 لا يوجد مستخدمون.",
      Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", "admin:menu")]]),
    );
    return;
  }
  const kb: InlineKeyboardButton[][] = rows.map((u) => [
    Markup.button.callback(
      `${u.isAdmin ? "👑 " : u.status === "banned" ? "🚫 " : "👤 "}${
        u.firstName ?? "—"
      }${u.username ? " @" + u.username : ""} • ${Number(u.balance).toFixed(2)}$`,
      `adm:user:${u.id}`,
    ),
  ]);
  const nav: InlineKeyboardButton[] = [];
  if (page > 1) nav.push(Markup.button.callback("⬅️ السابق", `adm:users:${page - 1}`));
  nav.push(Markup.button.callback(`${page}/${totalPages}`, "noop"));
  if (page < totalPages) nav.push(Markup.button.callback("التالي ➡️", `adm:users:${page + 1}`));
  kb.push(nav);
  kb.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
  await sendOrEdit(ctx, `👥 المستخدمون (${total})`, Markup.inlineKeyboard(kb));
}

async function showUserCard(ctx: Context, uid: number) {
  if (!(await requireAdmin(ctx))) return;
  const u = await getUser(uid);
  if (!u) {
    await ctx.reply("⚠️ غير موجود.");
    return;
  }
  const orderCountRow = await db
    .select({ c: sql<number>`count(*)::int`, sum: sql<string>`coalesce(sum(price_usd),0)::text` })
    .from(ordersTable)
    .where(eq(ordersTable.userId, uid));
  const oc = orderCountRow[0]?.c ?? 0;
  const sum = Number(orderCountRow[0]?.sum ?? 0);
  const text =
    `👤 ${u.firstName ?? "—"}${u.username ? " @" + u.username : ""}\n` +
    `ID: ${u.id}\n` +
    `الرصيد: ${Number(u.balance).toFixed(2)}$\n` +
    `الحالة: ${u.status}\n` +
    `إداري؟ ${u.isAdmin ? "نعم" : "لا"}\n` +
    `عدد الطلبات: ${oc} • إجمالي: ${sum.toFixed(2)}$`;
  const kb: InlineKeyboardButton[][] = [
    [
      Markup.button.callback("➕ شحن رصيد", `adm:userAdd:${uid}`),
      Markup.button.callback("➖ خصم رصيد", `adm:userSub:${uid}`),
    ],
    [
      Markup.button.callback(
        u.status === "banned" ? "✅ رفع الحظر" : "🚫 حظر",
        `adm:userBan:${uid}`,
      ),
      Markup.button.callback(u.isAdmin ? "👤 إلغاء إداري" : "👑 جعله إداري", `adm:userAdmin:${uid}`),
    ],
    [Markup.button.callback("📦 طلباته", `adm:userOrders:${uid}:1`)],
    [Markup.button.callback("⬅️ رجوع", "adm:users:1")],
  ];
  await sendOrEdit(ctx, text, Markup.inlineKeyboard(kb));
}

async function showUserOrders(ctx: Context, uid: number, page: number) {
  if (!(await requireAdmin(ctx))) return;
  const limit = 10;
  const offset = (page - 1) * limit;
  const rows = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.userId, uid))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit + 1)
    .offset(offset);
  const hasNext = rows.length > limit;
  const slice = rows.slice(0, limit);
  if (slice.length === 0) {
    await sendOrEdit(
      ctx,
      "📭 لا توجد طلبات.",
      Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", `adm:user:${uid}`)]]),
    );
    return;
  }
  const lines = slice.map(
    (r) => `#${r.id} • ${r.productName} ×${r.qty} • ${Number(r.priceUsd).toFixed(2)}$ • ${r.status}`,
  );
  const nav: InlineKeyboardButton[] = [];
  if (page > 1) nav.push(Markup.button.callback("⬅️ السابق", `adm:userOrders:${uid}:${page - 1}`));
  if (hasNext) nav.push(Markup.button.callback("التالي ➡️", `adm:userOrders:${uid}:${page + 1}`));
  const kb: InlineKeyboardButton[][] = [];
  if (nav.length) kb.push(nav);
  kb.push([Markup.button.callback("⬅️ رجوع", `adm:user:${uid}`)]);
  await sendOrEdit(ctx, `📦 طلبات المستخدم ${uid}\n\n${lines.join("\n")}`, Markup.inlineKeyboard(kb));
}

/* ---------- All Orders (with names) ---------- */

async function showAllOrders(ctx: Context, page: number) {
  if (!(await requireAdmin(ctx))) return;
  const limit = 8;
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      id: ordersTable.id,
      userId: ordersTable.userId,
      productName: ordersTable.productName,
      qty: ordersTable.qty,
      priceUsd: ordersTable.priceUsd,
      status: ordersTable.status,
      createdAt: ordersTable.createdAt,
      uname: usersTable.username,
      ufirst: usersTable.firstName,
    })
    .from(ordersTable)
    .leftJoin(usersTable, eq(usersTable.id, ordersTable.userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit + 1)
    .offset(offset);
  const hasNext = rows.length > limit;
  const slice = rows.slice(0, limit);
  if (slice.length === 0) {
    await sendOrEdit(
      ctx,
      "📭 لا توجد طلبات بعد.",
      Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", "admin:menu")]]),
    );
    return;
  }
  const lines = slice.map((r) => {
    const who = `${r.ufirst ?? "—"}${r.uname ? " @" + r.uname : ""} (${r.userId})`;
    return `#${r.id} • ${who}\n   ${r.productName} ×${r.qty} • ${Number(r.priceUsd).toFixed(2)}$ • ${r.status}`;
  });
  const nav: InlineKeyboardButton[] = [];
  if (page > 1) nav.push(Markup.button.callback("⬅️ السابق", `adm:allOrders:${page - 1}`));
  if (hasNext) nav.push(Markup.button.callback("التالي ➡️", `adm:allOrders:${page + 1}`));
  const kb: InlineKeyboardButton[][] = [];
  if (nav.length) kb.push(nav);
  kb.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
  await sendOrEdit(
    ctx,
    `📦 كل طلبات المستخدمين\n\n${lines.join("\n\n")}`,
    Markup.inlineKeyboard(kb),
  );
}

/* ---------- Deposit methods CRUD ---------- */

async function showMethods(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const rows = await db.select().from(depositMethodsTable).orderBy(depositMethodsTable.id);
  const kb: InlineKeyboardButton[][] = rows.map((m) => [
    Markup.button.callback(
      `${m.active ? "🟢" : "🔴"} ${m.name} • ${m.identifier}`,
      `adm:methodEdit:${m.id}`,
    ),
  ]);
  kb.push([Markup.button.callback("➕ إضافة طريقة", "adm:methodAdd")]);
  kb.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
  await sendOrEdit(ctx, "💳 طرق الإيداع", Markup.inlineKeyboard(kb));
}

async function showMethodEdit(ctx: Context, methodId: number) {
  if (!(await requireAdmin(ctx))) return;
  const m = (
    await db.select().from(depositMethodsTable).where(eq(depositMethodsTable.id, methodId)).limit(1)
  )[0];
  if (!m) {
    await ctx.reply("⚠️ غير موجود.");
    return;
  }
  await sendOrEdit(
    ctx,
    `💳 ${m.name}\nالمعرف: ${m.identifier}\nالحالة: ${m.active ? "مفعّل" : "موقوف"}\n\nالتعليمات:\n${m.instructions}`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          m.active ? "🔴 تعطيل" : "🟢 تفعيل",
          `adm:methodToggle:${m.id}`,
        ),
        Markup.button.callback("✏️ تعديل التعليمات", `adm:methodInstr:${m.id}`),
      ],
      [Markup.button.callback("🗑️ حذف", `adm:methodDel:${m.id}`)],
      [Markup.button.callback("⬅️ رجوع", "adm:methods")],
    ]),
  );
}

/* ---------- Login ---------- */

async function startAdminLogin(ctx: Context) {
  const f = ctx.from!;
  setStep(f.id, { kind: "admin:login" });
  await ctx.reply(
    "🔐 أرسل كلمة مرور الإدارة:",
    Markup.inlineKeyboard([[Markup.button.callback("❌ إلغاء", "home")]]),
  );
}

/* ---------- AI Support Chat ---------- */

async function showAiSupport(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const aiActive = hasAiKey();
  setStep(ctx.from!.id, { kind: "admin:aiSupport" });
  const topics =
    `📌 المواضيع المتاحة:\n` +
    `• سعر الصرف | نسبة الربح\n` +
    `• رصيد المستخدم | الإيداعات\n` +
    `• إضافة منتج | تعديل سعر\n` +
    `• أقسام مخصصة | منتج يدوي\n` +
    `• رسالة جماعية | حظر مستخدم\n` +
    `• طلبات معلقة | إشعارات\n` +
    `• وضع الصيانة | كلمة المرور`;
  await sendOrEdit(
    ctx,
    `🛠️ مساعد الإدارة\n\n` +
    (aiActive
      ? `✅ الذكاء الاصطناعي مفعّل — اسألني أي شيء\n\n`
      : `💡 اسألني عن أي إعداد في المتجر وسأجيبك مباشرة\n\n`) +
    topics + `\n\nاكتب سؤالك الآن:`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🗑️ مسح المحادثة", "adm:aiClear")],
      [Markup.button.callback("⬅️ رجوع للإدارة", "admin:menu")],
    ]),
  );
}

/* ---------- Auto-ping Menu ---------- */

async function showPingMenu(ctx: Context) {
  if (!(await requireAdmin(ctx))) return;
  const enabled = (await getSetting("auto_ping_enabled")) === "on";
  const intervalMin = Number(await getSetting("auto_ping_interval_min")) || 5;
  const targetId = await getSetting("auto_ping_target_user_id");
  await sendOrEdit(
    ctx,
    `🔄 البينج التلقائي /start\n\n` +
    `الحالة: ${enabled ? "🟢 مفعّل" : "🔴 موقوف"}\n` +
    `الفترة: كل ${intervalMin} دقيقة\n` +
    `المستلم: ${targetId ? `المستخدم #${targetId}` : "غير محدد"}\n\n` +
    `عند التفعيل: يُرسَل إليك رسالة تأكيد كل ${intervalMin} دقيقة تُثبت أن البوت شغّال.`,
    Markup.inlineKeyboard([
      [Markup.button.callback(enabled ? "🔴 إيقاف البينج" : "🟢 تفعيل البينج", "adm:pingToggle")],
      [Markup.button.callback(`⏱️ تغيير الفترة (حالياً: ${intervalMin} د)`, "adm:pingSetInterval")],
      [Markup.button.callback("⬅️ رجوع", "admin:menu")],
    ]),
  );
}

/* ---------- Registration ---------- */

export function registerAdmin(bot: Telegraf) {
  bot.command("admin", async (ctx) => {
    await ensureUser(ctx);
    const u = await getUser(ctx.from!.id);
    if (u?.isAdmin) await showAdminMenu(ctx);
    else await startAdminLogin(ctx);
  });

  bot.action("admin:menu", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showAdminMenu(ctx);
  });
  bot.action("admin:loginPrompt", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await startAdminLogin(ctx);
  });

  bot.action("adm:settings", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showSettingsMenu(ctx);
  });
  bot.action("adm:setMarkup", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:setMarkup" });
    await ctx.reply("📈 أرسل نسبة الربح العام (مثال: 3 أو 5.5):");
  });
  bot.action("adm:setSocialMarkup", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:setSocialMarkup" });
    await ctx.reply("📈 أرسل نسبة ربح السوشل ميديا (مثال: 3):");
  });
  bot.action("adm:setRate", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:setRate" });
    await ctx.reply("💱 أرسل سعر الصرف (ل.س لكل دولار):");
  });
  bot.action("adm:newPass", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:newPassword" });
    await ctx.reply("🔑 أرسل كلمة المرور الجديدة:");
  });
  bot.action("adm:toggleStatus", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const cur = await getBotStatus();
    await setSetting("bot_status", cur === "on" ? "off" : "on");
    await showAdminMenu(ctx);
  });

  /* Deposits */
  bot.action(/^adm:depList:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showDepList(ctx, Number(ctx.match[1]));
  });
  bot.action(/^adm:depShow:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showDepDetails(ctx, Number(ctx.match[1]));
  });
  bot.action(/^adm:dep:approve:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await clearInlineKeyboard(ctx);
    await approveDeposit(ctx, Number(ctx.match[1]));
  });
  bot.action(/^adm:dep:reject:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await clearInlineKeyboard(ctx);
    await rejectDeposit(ctx, Number(ctx.match[1]));
  });

  /* Users */
  bot.action(/^adm:users:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showUsersList(ctx, Number(ctx.match[1]));
  });
  bot.action("adm:findUser", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:findUser" });
    await ctx.reply("🔍 أرسل اسم المستخدم أو الرقم التعريفي:");
  });
  bot.action(/^adm:user:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showUserCard(ctx, Number(ctx.match[1]));
  });
  bot.action(/^adm:userAdd:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, {
      kind: "admin:userBalance",
      userId: Number(ctx.match[1]),
      mode: "add",
    });
    await ctx.reply(`💵 أرسل المبلغ بالدولار لإضافته إلى المستخدم ${ctx.match[1]}:`);
  });
  bot.action(/^adm:userSub:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, {
      kind: "admin:userBalance",
      userId: Number(ctx.match[1]),
      mode: "deduct",
    });
    await ctx.reply(`💵 أرسل المبلغ بالدولار لخصمه من المستخدم ${ctx.match[1]}:`);
  });
  bot.action(/^adm:userBan:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const uid = Number(ctx.match[1]);
    const u = await getUser(uid);
    if (!u) return;
    await setStatus(uid, u.status === "banned" ? "active" : "banned");
    await showUserCard(ctx, uid);
  });
  bot.action(/^adm:userAdmin:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const me = await getUser(ctx.from!.id);
    if (!me?.isSuperAdmin) {
      await ctx.reply("⛔ يحتاج هذا الإجراء لصلاحيات المدير الأعلى.");
      return;
    }
    const uid = Number(ctx.match[1]);
    const u = await getUser(uid);
    if (!u) return;
    await setAdmin(uid, !u.isAdmin);
    await showUserCard(ctx, uid);
  });
  bot.action(/^adm:userOrders:(\d+):(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showUserOrders(ctx, Number(ctx.match[1]), Number(ctx.match[2]));
  });

  /* All orders */
  bot.action(/^adm:allOrders:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showAllOrders(ctx, Number(ctx.match[1]));
  });

  /* Broadcast */
  bot.action("adm:broadcast", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:broadcast" });
    await ctx.reply("📣 أرسل نص الرسالة الجماعية:");
  });

  /* Deposit methods */
  bot.action("adm:methods", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showMethods(ctx);
  });
  bot.action("adm:methodAdd", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:addMethod:name" });
    await ctx.reply("💳 أرسل اسم طريقة الإيداع (مثال: شام كاش):");
  });
  bot.action(/^adm:methodEdit:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showMethodEdit(ctx, Number(ctx.match[1]));
  });
  bot.action(/^adm:methodToggle:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const id = Number(ctx.match[1]);
    const cur = (
      await db.select().from(depositMethodsTable).where(eq(depositMethodsTable.id, id)).limit(1)
    )[0];
    if (!cur) return;
    await db
      .update(depositMethodsTable)
      .set({ active: !cur.active })
      .where(eq(depositMethodsTable.id, id));
    await showMethodEdit(ctx, id);
  });
  bot.action(/^adm:methodInstr:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:editMethodInstructions", methodId: Number(ctx.match[1]) });
    await ctx.reply("📋 أرسل التعليمات الجديدة:");
  });
  bot.action(/^adm:methodDel:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const id = Number(ctx.match[1]);
    await db.delete(depositMethodsTable).where(eq(depositMethodsTable.id, id));
    await ctx.reply(`🗑️ تم حذف طريقة الإيداع #${id}.`);
    await showMethods(ctx);
  });

  /* Product/category overrides */
  bot.action(/^adm:editPrice:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const { fetchAllProducts } = await import("../api");
    const all = await fetchAllProducts();
    const p = all.find((x) => x.id === pid);
    setStep(ctx.from!.id, { kind: "admin:editPrice", productId: pid, productName: p?.name ?? "" });
    await ctx.reply(
      `✏️ تعديل سعر المنتج: ${p?.name ?? pid}\n\n` +
        `أرسل أحد الخيارات التالية:\n` +
        `• \`%5\` لربح 5% فوق سعر التكلفة\n` +
        `• \`$2.5\` لتثبيت السعر النهائي على 2.5$\n` +
        `• \`reset\` لإعادة الافتراضي`,
      { parse_mode: "Markdown" },
    );
  });
  bot.action(/^adm:editInstr:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const { fetchAllProducts } = await import("../api");
    const all = await fetchAllProducts();
    const p = all.find((x) => x.id === pid);
    setStep(ctx.from!.id, {
      kind: "admin:editProductInstructions",
      productId: pid,
      productName: p?.name ?? "",
    });
    await ctx.reply(
      `📋 أرسل تعليمات المنتج ${p?.name ?? pid} (التي ستظهر للمستخدم).\n` +
        `للإلغاء أرسل: clear`,
    );
  });
  bot.action(/^adm:renameProd:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const { fetchAllProducts } = await import("../api");
    const all = await fetchAllProducts();
    const p = all.find((x) => x.id === pid);
    setStep(ctx.from!.id, {
      kind: "admin:renameProduct",
      productId: pid,
      productName: p?.name ?? "",
    });
    await ctx.reply(
      `📝 أرسل الاسم الجديد للمنتج "${p?.name ?? pid}".\n` +
        `للعودة للاسم الأصلي أرسل: reset`,
    );
  });
  bot.action(/^adm:moveProd:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const { fetchAllProducts } = await import("../api");
    const all = await fetchAllProducts();
    const p = all.find((x) => x.id === pid);
    setStep(ctx.from!.id, {
      kind: "admin:moveProduct",
      productId: pid,
      productName: p?.name ?? "",
    });
    await ctx.reply(
      `🚚 نقل المنتج "${p?.name ?? pid}" إلى قسم آخر.\n\n` +
        `أرسل رقم القسم (ID) المطلوب نقل المنتج إليه.\n` +
        `للعودة للقسم الأصلي أرسل: reset\n\n` +
        `يمكنك الحصول على رقم أي قسم بفتحه — يظهر في الرابط.`,
    );
  });
  bot.action(/^adm:hideProd:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const cur = (
      await db
        .select()
        .from(productOverridesTable)
        .where(eq(productOverridesTable.productId, pid))
        .limit(1)
    )[0];
    const nextHidden = !(cur?.hidden ?? false);
    await db
      .insert(productOverridesTable)
      .values({ productId: pid, hidden: nextHidden })
      .onConflictDoUpdate({
        target: productOverridesTable.productId,
        set: { hidden: nextHidden, updatedAt: new Date() },
      });
    invalidateCaches();
    await ctx.reply(nextHidden ? "🙈 تم إخفاء المنتج." : "👁 تم إظهار المنتج.");
  });
  bot.action(/^adm:catEdit:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:editCategoryName", categoryId: Number(ctx.match[1]) });
    await ctx.reply("✏️ أرسل الاسم الجديد للقسم (أو reset للعودة للاسم الأصلي):");
  });
  bot.action(/^adm:catToggle:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const cid = Number(ctx.match[1]);
    const cur = (
      await db
        .select()
        .from(categoryOverridesTable)
        .where(eq(categoryOverridesTable.categoryId, cid))
        .limit(1)
    )[0];
    const nextHidden = !(cur?.hidden ?? false);
    await db
      .insert(categoryOverridesTable)
      .values({ categoryId: cid, hidden: nextHidden })
      .onConflictDoUpdate({
        target: categoryOverridesTable.categoryId,
        set: { hidden: nextHidden, updatedAt: new Date() },
      });
    invalidateCaches();
    await ctx.reply(nextHidden ? "🙈 تم إخفاء القسم." : "👁 تم إظهار القسم.");
  });

  /* ---- Contact Links ---- */
  bot.action("adm:contacts", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const links = await db.select().from(contactLinksTable).orderBy(contactLinksTable.id);
    const rows: InlineKeyboardButton[][] = links.map((l) => [
      Markup.button.callback(`${l.active ? "✅" : "❌"} ${l.name}`, `adm:contactEdit:${l.id}`),
    ]);
    rows.push([Markup.button.callback("➕ إضافة وسيلة تواصل", "adm:addContact")]);
    rows.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
    await sendOrEdit(ctx, "📞 وسائل التواصل:", Markup.inlineKeyboard(rows));
  });
  bot.action("adm:addContact", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:addContact:name" });
    await ctx.reply("📝 أرسل اسم وسيلة التواصل (مثال: دعم فني):");
  });
  bot.action(/^adm:contactEdit:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const cid = Number(ctx.match[1]);
    const c = (await db.select().from(contactLinksTable).where(eq(contactLinksTable.id, cid)).limit(1))[0];
    if (!c) { await ctx.reply("⚠️ غير موجود."); return; }
    await sendOrEdit(
      ctx,
      `📞 ${c.name}\nالرابط: ${c.link}\nالحالة: ${c.active ? "✅ مفعل" : "❌ معطل"}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(c.active ? "❌ تعطيل" : "✅ تفعيل", `adm:contactToggle:${cid}`)],
        [Markup.button.callback("✏️ تعديل الرابط", `adm:contactLink:${cid}`)],
        [Markup.button.callback("🗑️ حذف", `adm:contactDel:${cid}`)],
        [Markup.button.callback("⬅️ رجوع", "adm:contacts")],
      ]),
    );
  });
  bot.action(/^adm:contactToggle:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const cid = Number(ctx.match[1]);
    const c = (await db.select().from(contactLinksTable).where(eq(contactLinksTable.id, cid)).limit(1))[0];
    if (!c) { await ctx.reply("⚠️ غير موجود."); return; }
    await db.update(contactLinksTable).set({ active: !c.active, updatedAt: new Date() }).where(eq(contactLinksTable.id, cid));
    await ctx.reply(!c.active ? "✅ تم تفعيل وسيلة التواصل." : "❌ تم تعطيلها.");
  });
  bot.action(/^adm:contactLink:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:editContactLink", contactId: Number(ctx.match[1]) });
    await ctx.reply("🔗 أرسل الرابط الجديد لوسيلة التواصل:");
  });
  bot.action(/^adm:contactDel:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    await db.delete(contactLinksTable).where(eq(contactLinksTable.id, Number(ctx.match[1])));
    await ctx.reply("🗑️ تم حذف وسيلة التواصل.");
  });

  /* ---- Virtual Categories ---- */
  bot.action("adm:vcList", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const vcs = await db.select().from(virtualCategoriesTable).orderBy(virtualCategoriesTable.id);
    const rows: InlineKeyboardButton[][] = vcs.map((v) => [
      Markup.button.callback(`${v.active ? "📂" : "🔒"} ${v.name}`, `adm:vcInfo:${v.id}`),
    ]);
    rows.push([Markup.button.callback("➕ إضافة قسم مخصص", "adm:addVCat")]);
    rows.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
    await sendOrEdit(ctx, "📁 الأقسام المخصصة:", Markup.inlineKeyboard(rows));
  });
  bot.action("adm:addVCat", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:addVirtualCategory:name", parentId: 0 });
    await ctx.reply("📁 أرسل اسم القسم المخصص الجديد:");
  });
  bot.action(/^adm:vcInfo:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const vcId = Number(ctx.match[1]);
    const vc = (await db.select().from(virtualCategoriesTable).where(eq(virtualCategoriesTable.id, vcId)).limit(1))[0];
    if (!vc) { await ctx.reply("⚠️ غير موجود."); return; }
    await sendOrEdit(
      ctx,
      `📁 القسم: ${vc.name}\nالحالة: ${vc.active ? "✅ مرئي" : "❌ مخفي"}\n\nلإضافة منتجات لهذا القسم: افتح المنتج ← 🚚 نقل لقسم آخر ← أرسل الرقم: ${vcId}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✏️ تعديل الاسم", `adm:vcEdit:${vcId}`)],
        [Markup.button.callback(vc.active ? "🙈 إخفاء" : "👁 إظهار", `adm:vcToggle:${vcId}`)],
        [Markup.button.callback("🗑️ حذف", `adm:vcDel:${vcId}`)],
        [Markup.button.callback("⬅️ رجوع", "adm:vcList")],
      ]),
    );
  });
  bot.action(/^adm:vcEdit:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:editVirtualCategory", vcId: Number(ctx.match[1]) });
    await ctx.reply("✏️ أرسل الاسم الجديد للقسم:");
  });
  bot.action(/^adm:vcToggle:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const vcId = Number(ctx.match[1]);
    const vc = (await db.select().from(virtualCategoriesTable).where(eq(virtualCategoriesTable.id, vcId)).limit(1))[0];
    if (!vc) { await ctx.reply("⚠️ غير موجود."); return; }
    await db.update(virtualCategoriesTable).set({ active: !vc.active, updatedAt: new Date() }).where(eq(virtualCategoriesTable.id, vcId));
    invalidateCaches();
    await ctx.reply(!vc.active ? "👁 تم إظهار القسم." : "🙈 تم إخفاء القسم.");
  });
  bot.action(/^adm:vcDel:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    await db.delete(virtualCategoriesTable).where(eq(virtualCategoriesTable.id, Number(ctx.match[1])));
    invalidateCaches();
    await ctx.reply("🗑️ تم حذف القسم المخصص.");
  });
  // Add sub-virtual-category under a parent vcat
  bot.action(/^adm:addVCatSub:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const parentVcId = Number(ctx.match[1]);
    const parentVc = (await db.select().from(virtualCategoriesTable).where(eq(virtualCategoriesTable.id, parentVcId)).limit(1))[0];
    setStep(ctx.from!.id, { kind: "admin:addVirtualCategory:name", parentId: parentVcId });
    await ctx.reply(`📁 أرسل اسم القسم الفرعي داخل "${parentVc?.name ?? parentVcId}":`);
  });

  /* ---- Move entire Oranos category ---- */
  bot.action(/^adm:moveCatAll:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const sourceCatId = Number(ctx.match[1]);
    setStep(ctx.from!.id, { kind: "admin:moveCatAll", sourceCategoryId: sourceCatId });
    await ctx.reply(
      `🚚 نقل جميع منتجات القسم #${sourceCatId} إلى قسم آخر.\n\n` +
      `أرسل رقم القسم الهدف (مثال: 42 أو ID قسم مخصص).\n` +
      `لإلغاء العملية أرسل: cancel`,
    );
  });

  /* ---- Manual Products ---- */
  bot.action("adm:manualProds", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const prods = await db.select().from(manualProductsTable).orderBy(manualProductsTable.id);
    const pendingCount = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.status, "pending"))).length;
    const rows: InlineKeyboardButton[][] = prods.map((p) => [
      Markup.button.callback(`${p.active ? "🛒" : "❌"} ${p.name}`, `adm:manualProd:${p.id}`),
    ]);
    rows.push([Markup.button.callback(`📋 طلبات معلقة ${pendingCount > 0 ? `(${pendingCount})` : ""}`, "adm:manualOrders")]);
    rows.push([Markup.button.callback("➕ إضافة منتج يدوي", "adm:addManual")]);
    rows.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
    await sendOrEdit(ctx, "🛒 المنتجات اليدوية:", Markup.inlineKeyboard(rows));
  });
  bot.action("adm:addManual", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    setStep(ctx.from!.id, { kind: "admin:addManualProduct:name" });
    await ctx.reply("📝 أرسل اسم المنتج اليدوي:");
  });
  bot.action(/^adm:manualProd:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const p = (await db.select().from(manualProductsTable).where(eq(manualProductsTable.id, pid)).limit(1))[0];
    if (!p) { await ctx.reply("⚠️ غير موجود."); return; }
    await sendOrEdit(
      ctx,
      `🛒 ${p.name}\nالسعر: ${Number(p.priceUsd).toFixed(2)}$\nالقسم ID: ${p.categoryId}\nAPI ID: ${p.apiProductId ?? "—"}\nالحالة: ${p.active ? "✅ مفعل" : "❌ معطل"}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(p.active ? "❌ تعطيل" : "✅ تفعيل", `adm:manualToggle:${pid}`)],
        [Markup.button.callback("🗑️ حذف", `adm:manualDel:${pid}`)],
        [Markup.button.callback("⬅️ رجوع", "adm:manualProds")],
      ]),
    );
  });
  bot.action(/^adm:manualEditPrice:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    setStep(ctx.from!.id, { kind: "admin:editManualPrice", productId: pid });
    await ctx.reply("💵 أرسل السعر الجديد بالدولار (مثال: 3.50):");
  });
  bot.action(/^adm:manualToggle:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const pid = Number(ctx.match[1]);
    const p = (await db.select().from(manualProductsTable).where(eq(manualProductsTable.id, pid)).limit(1))[0];
    if (!p) { await ctx.reply("⚠️ غير موجود."); return; }
    await db.update(manualProductsTable).set({ active: !p.active, updatedAt: new Date() }).where(eq(manualProductsTable.id, pid));
    await ctx.reply(!p.active ? "✅ تم تفعيل المنتج." : "❌ تم تعطيله.");
  });
  bot.action(/^adm:manualDel:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    await db.delete(manualProductsTable).where(eq(manualProductsTable.id, Number(ctx.match[1])));
    await ctx.reply("🗑️ تم حذف المنتج اليدوي.");
  });

  /* ---- Nav Button Labels ---- */
  bot.action("adm:btnLabels", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const { getBtnBackLabel, getBtnHomeLabel, getBtnPrevLabel, getBtnNextLabel } = await import("../settings");
    const [b, h, p, n] = await Promise.all([getBtnBackLabel(), getBtnHomeLabel(), getBtnPrevLabel(), getBtnNextLabel()]);
    await sendOrEdit(
      ctx,
      `🔘 أزرار التنقل الحالية:\nرجوع: ${b}\nالرئيسية: ${h}\nالسابق: ${p}\nالتالي: ${n}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✏️ زر الرجوع", "adm:btnEdit:btn_back_label:رجوع")],
        [Markup.button.callback("✏️ زر الرئيسية", "adm:btnEdit:btn_home_label:الرئيسية")],
        [Markup.button.callback("✏️ زر السابق", "adm:btnEdit:btn_prev_label:السابق")],
        [Markup.button.callback("✏️ زر التالي", "adm:btnEdit:btn_next_label:التالي")],
        [Markup.button.callback("🔄 إعادة الافتراضي للكل", "adm:btnReset")],
        [Markup.button.callback("⬅️ رجوع", "adm:settings")],
      ]),
    );
  });
  bot.action(/^adm:btnEdit:([^:]+):(.+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const settingKey = ctx.match[1];
    const labelName = ctx.match[2];
    setStep(ctx.from!.id, { kind: "admin:editBtnLabel", settingKey, labelName });
    await ctx.reply(`✏️ أرسل النص الجديد لزر "${labelName}" (أو reset للافتراضي):`);
  });
  bot.action("adm:btnReset", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const { deleteSetting } = await import("../settings");
    await Promise.all([
      deleteSetting("btn_back_label"),
      deleteSetting("btn_home_label"),
      deleteSetting("btn_prev_label"),
      deleteSetting("btn_next_label"),
    ]);
    await ctx.reply("✅ تمت إعادة نصوص الأزرار للافتراضية.");
  });

  /* ── Manual Orders Management ── */
  bot.action("adm:manualOrders", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const orders = await db.select().from(manualOrdersTable)
      .where(eq(manualOrdersTable.status, "pending"))
      .orderBy(desc(manualOrdersTable.id))
      .limit(30);
    if (orders.length === 0) {
      await sendOrEdit(ctx, "📭 لا توجد طلبات يدوية معلقة.", Markup.inlineKeyboard([[Markup.button.callback("⬅️ رجوع", "adm:manualProds")]]));
      return;
    }
    const rate = await getExchangeRate();
    const rows: InlineKeyboardButton[][] = orders.map((o) => {
      const syp = Math.round(Number(o.priceUsd) * rate);
      return [Markup.button.callback(
        `#M${o.id} • ${o.productName.slice(0, 20)} • ${Number(o.priceUsd).toFixed(2)}$`.slice(0, 60),
        `adm:mord:${o.id}`,
      )];
    });
    rows.push([Markup.button.callback("⬅️ رجوع", "adm:manualProds")]);
    await sendOrEdit(ctx, `📋 الطلبات اليدوية المعلقة (${orders.length}):`, Markup.inlineKeyboard(rows));
  });

  bot.action(/^adm:mord:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const oid = Number(ctx.match[1]);
    const o = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.id, oid)).limit(1))[0];
    if (!o) { await ctx.reply("⚠️ الطلب غير موجود."); return; }
    const u = (await db.select().from(usersTable).where(eq(usersTable.id, o.userId)).limit(1))[0];
    const rate = await getExchangeRate();
    const syp = Math.round(Number(o.priceUsd) * rate);
    const uname = u?.telegramUsername ? `@${u.telegramUsername}` : `ID:${o.userId}`;
    const text =
      `📋 طلب يدوي #M${o.id}\n` +
      `👤 المستخدم: ${uname}\n` +
      `🛒 المنتج: ${o.productName}\n` +
      `💰 ${Number(o.priceUsd).toFixed(2)}$ | ${syp.toLocaleString("en-US")} ل.س\n` +
      `📅 ${o.createdAt.toLocaleString("ar", { timeZone: "Asia/Damascus" })}\n` +
      `الحالة: ${o.status}` +
      (o.note ? `\n📝 ملاحظة المستخدم: ${o.note}` : "");
    await sendOrEdit(ctx, text, Markup.inlineKeyboard([
      [
        Markup.button.callback("✅ قبول وتسليم", `adm:mordAccept:${oid}`),
        Markup.button.callback("❌ رفض واسترداد", `adm:mordReject:${oid}`),
      ],
      [Markup.button.callback("💬 إرسال رسالة للمستخدم", `adm:mordMsg:${oid}`)],
      [Markup.button.callback("⬅️ رجوع", "adm:manualOrders")],
    ]));
  });

  bot.action(/^adm:mordAccept:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const oid = Number(ctx.match[1]);
    const o = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.id, oid)).limit(1))[0];
    if (!o || o.status !== "pending") { await ctx.reply("⚠️ الطلب غير موجود أو تم معالجته مسبقاً."); return; }
    setStep(ctx.from!.id, { kind: "admin:manualOrderAccept", orderId: oid, userId: o.userId, productName: o.productName, priceUsd: Number(o.priceUsd) });
    await ctx.reply(`✏️ أرسل رسالة التسليم للمستخدم (رابط، كود، تعليمات...) أو أرسل "skip" لتخطي الرسالة:`);
  });

  bot.action(/^adm:mordReject:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const oid = Number(ctx.match[1]);
    const o = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.id, oid)).limit(1))[0];
    if (!o || o.status !== "pending") { await ctx.reply("⚠️ الطلب غير موجود أو تم معالجته مسبقاً."); return; }
    await db.update(manualOrdersTable).set({ status: "rejected", updatedAt: new Date() }).where(eq(manualOrdersTable.id, oid));
    await adjustBalance(o.userId, Number(o.priceUsd));
    const rate = await getExchangeRate();
    const syp = Math.round(Number(o.priceUsd) * rate);
    await ctx.reply(`✅ تم رفض الطلب #M${oid} وإعادة الرصيد للمستخدم.`);
    await ctx.telegram.sendMessage(
      o.userId,
      `❌ تم رفض طلبك #M${oid}\n🛒 المنتج: ${o.productName}\n💰 تمت إعادة ${Number(o.priceUsd).toFixed(2)}$ | ${syp.toLocaleString("en-US")} ل.س إلى رصيدك.`,
      Markup.inlineKeyboard([[Markup.button.callback("🏠 الرئيسية", "home")]]),
    ).catch(()=>{});
  });

  bot.action(/^adm:mordMsg:(\d+)$/, async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const oid = Number(ctx.match[1]);
    const o = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.id, oid)).limit(1))[0];
    if (!o) { await ctx.reply("⚠️ الطلب غير موجود."); return; }
    setStep(ctx.from!.id, { kind: "admin:manualOrderMsg", orderId: oid, userId: o.userId });
    await ctx.reply(`💬 أرسل الرسالة التي تريد إيصالها للمستخدم ${o.userId} بخصوص طلب #M${oid}:`);
  });

  /* ── AI Support ── */
  bot.action("adm:aiSupport", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showAiSupport(ctx);
  });
  bot.action("adm:aiClear", async (ctx) => {
    ctx.answerCbQuery("🗑️ تم مسح المحادثة").catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    clearAiHistory(ctx.from!.id);
    setStep(ctx.from!.id, { kind: "idle" });
    await showAiSupport(ctx);
  });

  /* ── Auto-ping ── */
  bot.action("adm:ping", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    await showPingMenu(ctx);
  });
  bot.action("adm:pingToggle", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const enabled = (await getSetting("auto_ping_enabled")) === "on";
    if (!enabled) {
      await setSetting("auto_ping_enabled", "on");
      await setSetting("auto_ping_target_user_id", String(ctx.from!.id));
      await setSetting("auto_ping_last_sent", "0");
    } else {
      await setSetting("auto_ping_enabled", "off");
    }
    await showPingMenu(ctx);
  });
  bot.action("adm:pingSetInterval", async (ctx) => {
    ctx.answerCbQuery().catch(()=>{});
    if (!(await requireAdmin(ctx))) return;
    const cur = Number(await getSetting("auto_ping_interval_min")) || 5;
    setStep(ctx.from!.id, { kind: "admin:setPingInterval" });
    await ctx.reply(`⏱️ أرسل الفترة بالدقائق (1-1440).\nالقيمة الحالية: ${cur} دقيقة:`);
  });
}

/* ---------- Text router for admin steps ---------- */

export function registerAdminTextHandlers(bot: Telegraf) {
  bot.on("text", async (ctx, next) => {
    const step = getStep(ctx.from!.id);
    const txt = ctx.message.text.trim();
    if (txt.startsWith("/")) return next();

    switch (step.kind) {
      case "admin:login": {
        const expected = await getAdminPassword();
        if (txt !== expected) {
          await ctx.reply(
            "❌ كلمة المرور خاطئة، حاول مجدداً:",
            Markup.inlineKeyboard([[Markup.button.callback("❌ إلغاء", "home")]]),
          );
          return;
        }
        // First admin to login becomes super admin
        const existingSuper = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.isSuperAdmin, true))
          .limit(1);
        const becomeSuper = existingSuper.length === 0;
        await setAdmin(ctx.from!.id, true, becomeSuper);
        await markAdminAuthed(ctx.from!.id);
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم تسجيل الدخول بنجاح${becomeSuper ? " (مدير أعلى)" : ""}.`);
        await showAdminMenu(ctx);
        return;
      }
      case "admin:setMarkup": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n < 0) {
          await ctx.reply("⚠️ أدخل رقماً صالحاً.");
          return;
        }
        await setSetting("markup_percent", String(n));
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم ضبط الربح العام على ${n}%.`);
        await showSettingsMenu(ctx);
        return;
      }
      case "admin:setSocialMarkup": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n < 0) {
          await ctx.reply("⚠️ أدخل رقماً صالحاً.");
          return;
        }
        await setSetting("social_markup_percent", String(n));
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم ضبط ربح السوشل على ${n}%.`);
        await showSettingsMenu(ctx);
        return;
      }
      case "admin:setRate": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n <= 0) {
          await ctx.reply("⚠️ أدخل سعر صرف صالح.");
          return;
        }
        await setSetting("exchange_rate", String(n));
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم ضبط سعر الصرف على ${n} ل.س/$.`);
        await showSettingsMenu(ctx);
        return;
      }
      case "admin:newPassword": {
        if (txt.length < 4) {
          await ctx.reply("⚠️ كلمة المرور قصيرة جداً.");
          return;
        }
        await setSetting("admin_password", txt);
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply("✅ تم تحديث كلمة المرور.");
        await showSettingsMenu(ctx);
        return;
      }
      case "admin:depositApproveAmount": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n <= 0) {
          await ctx.reply("⚠️ أدخل مبلغاً صالحاً (دولار).");
          return;
        }
        const d = (
          await db
            .select()
            .from(depositRequestsTable)
            .where(eq(depositRequestsTable.id, step.depositId))
            .limit(1)
        )[0];
        if (!d) {
          setStep(ctx.from!.id, { kind: "idle" });
          await ctx.reply("⚠️ طلب الإيداع غير موجود.");
          return;
        }
        await db
          .update(depositRequestsTable)
          .set({
            status: "approved",
            amount: String(n),
            processedBy: ctx.from!.id,
            processedAt: new Date(),
          })
          .where(eq(depositRequestsTable.id, step.depositId));
        await adjustBalance(d.userId, n);
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تمت إضافة ${n}$ لرصيد المستخدم ${d.userId}.`);
        try {
          await ctx.telegram.sendMessage(
            d.userId,
            `✅ تم اعتماد طلب الإيداع #${d.id} وإضافة ${n}$ إلى رصيدك.`,
          );
        } catch {
          /* ignore */
        }
        return;
      }
      case "admin:userBalance": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n <= 0) {
          await ctx.reply("⚠️ أدخل مبلغاً صالحاً.");
          return;
        }
        const delta = step.mode === "add" ? n : -n;
        await adjustBalance(step.userId, delta);
        setStep(ctx.from!.id, { kind: "idle" });
        const u = await getUser(step.userId);
        await ctx.reply(
          `✅ تم تعديل رصيد المستخدم ${step.userId}.\nالرصيد الجديد: ${
            u ? Number(u.balance).toFixed(2) : "?"
          }$`,
        );
        try {
          await ctx.telegram.sendMessage(
            step.userId,
            step.mode === "add"
              ? `💰 تم إضافة ${n}$ إلى رصيدك من قبل الإدارة.`
              : `💸 تم خصم ${n}$ من رصيدك من قبل الإدارة.`,
          );
        } catch {
          /* ignore */
        }
        return;
      }
      case "admin:findUser": {
        const found = await searchUser(txt);
        setStep(ctx.from!.id, { kind: "idle" });
        if (found.length === 0) {
          await ctx.reply("⚠️ لا يوجد نتائج.");
          return;
        }
        const kb: InlineKeyboardButton[][] = found.map((u) => [
          Markup.button.callback(
            `${u.firstName ?? "—"}${u.username ? " @" + u.username : ""} • ${Number(
              u.balance,
            ).toFixed(2)}$`,
            `adm:user:${u.id}`,
          ),
        ]);
        kb.push([Markup.button.callback("⬅️ رجوع", "admin:menu")]);
        await ctx.reply(`نتائج البحث (${found.length}):`, Markup.inlineKeyboard(kb));
        return;
      }
      case "admin:editPrice": {
        if (txt.toLowerCase() === "reset") {
          await db
            .insert(productOverridesTable)
            .values({ productId: step.productId, productName: step.productName })
            .onConflictDoUpdate({
              target: productOverridesTable.productId,
              set: {
                customMarkupPercent: null,
                customPriceUsd: null,
                updatedAt: new Date(),
              },
            });
          invalidateCaches();
          setStep(ctx.from!.id, { kind: "idle" });
          await ctx.reply("✅ تمت إعادة السعر للافتراضي.");
          return;
        }
        const m = txt.match(/^([%$])\s*(-?\d+(\.\d+)?)$/);
        if (!m) {
          await ctx.reply("⚠️ صيغة غير صحيحة. مثال: `%5` أو `$2.5`.");
          return;
        }
        const v = Number(m[2]);
        const set: Partial<typeof productOverridesTable.$inferInsert> = {
          productId: step.productId,
          productName: step.productName,
          updatedAt: new Date(),
        };
        if (m[1] === "%") {
          set.customMarkupPercent = String(v);
          set.customPriceUsd = null;
        } else {
          set.customPriceUsd = String(v);
          set.customMarkupPercent = null;
        }
        await db
          .insert(productOverridesTable)
          .values(set as typeof productOverridesTable.$inferInsert)
          .onConflictDoUpdate({
            target: productOverridesTable.productId,
            set,
          });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم حفظ السعر الجديد للمنتج ${step.productName}.`);
        return;
      }
      case "admin:editProductInstructions": {
        const value = txt.toLowerCase() === "clear" ? null : txt;
        await db
          .insert(productOverridesTable)
          .values({
            productId: step.productId,
            productName: step.productName,
            instructions: value,
          })
          .onConflictDoUpdate({
            target: productOverridesTable.productId,
            set: { instructions: value, updatedAt: new Date() },
          });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(value ? "✅ تم حفظ التعليمات." : "✅ تم مسح التعليمات.");
        return;
      }
      case "admin:renameProduct": {
        const value = txt.toLowerCase() === "reset" ? null : txt;
        await db
          .insert(productOverridesTable)
          .values({
            productId: step.productId,
            productName: step.productName,
            customName: value,
          })
          .onConflictDoUpdate({
            target: productOverridesTable.productId,
            set: { customName: value, updatedAt: new Date() },
          });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(value ? `✅ تم تغيير اسم المنتج إلى: ${value}` : "✅ تمت إعادة الاسم الأصلي.");
        return;
      }
      case "admin:moveProduct": {
        let target: number | null = null;
        if (txt.toLowerCase() !== "reset") {
          const n = Number(txt);
          if (!Number.isInteger(n) || n <= 0) {
            await ctx.reply("⚠️ يجب إرسال رقم القسم (مثال: 12).");
            return;
          }
          target = n;
        }
        await db
          .insert(productOverridesTable)
          .values({
            productId: step.productId,
            productName: step.productName,
            customCategoryId: target,
          })
          .onConflictDoUpdate({
            target: productOverridesTable.productId,
            set: { customCategoryId: target, updatedAt: new Date() },
          });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(
          target == null
            ? "✅ تمت إعادة المنتج لقسمه الأصلي."
            : `✅ تم نقل المنتج إلى القسم رقم ${target}.`,
        );
        return;
      }
      case "admin:moveCatAll": {
        if (txt.toLowerCase() === "cancel") {
          setStep(ctx.from!.id, { kind: "idle" });
          await ctx.reply("❌ تم إلغاء العملية.");
          return;
        }
        const targetId = Number(txt);
        if (!Number.isInteger(targetId) || targetId <= 0) {
          await ctx.reply("⚠️ يجب إرسال رقم القسم الهدف (مثال: 42)، أو cancel للإلغاء.");
          return;
        }
        // Fetch all products in source category from Oranos cache
        const { getCachedProducts } = await import("./categories");
        const allProducts = await getCachedProducts();
        const sourcePids = allProducts
          .filter((p) => p.parent_id === step.sourceCategoryId)
          .map((p) => p.id);
        if (sourcePids.length === 0) {
          setStep(ctx.from!.id, { kind: "idle" });
          await ctx.reply("⚠️ لم يتم العثور على منتجات في هذا القسم.");
          return;
        }
        let moved = 0;
        for (const pid of sourcePids) {
          const product = allProducts.find((p) => p.id === pid);
          await db
            .insert(productOverridesTable)
            .values({ productId: pid, productName: product?.name ?? String(pid), customCategoryId: targetId })
            .onConflictDoUpdate({
              target: productOverridesTable.productId,
              set: { customCategoryId: targetId, updatedAt: new Date() },
            });
          moved++;
        }
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم نقل ${moved} منتج من القسم #${step.sourceCategoryId} إلى القسم #${targetId}.`);
        return;
      }
      case "admin:editCategoryName": {
        const value = txt.toLowerCase() === "reset" ? null : txt;
        await db
          .insert(categoryOverridesTable)
          .values({ categoryId: step.categoryId, customName: value })
          .onConflictDoUpdate({
            target: categoryOverridesTable.categoryId,
            set: { customName: value, updatedAt: new Date() },
          });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply("✅ تم تحديث اسم القسم.");
        return;
      }
      case "admin:broadcast": {
        const text = txt;
        const userRows = await db.select({ id: usersTable.id }).from(usersTable);
        let sent = 0;
        for (const u of userRows) {
          try {
            await ctx.telegram.sendMessage(u.id, text);
            sent++;
          } catch {
            /* ignore blocked users */
          }
        }
        await db.insert(broadcastsTable).values({
          message: text,
          sentBy: ctx.from!.id,
          sentCount: sent,
        });
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`📣 تم الإرسال إلى ${sent} مستخدم.`);
        return;
      }
      case "admin:addMethod:name": {
        setStep(ctx.from!.id, { kind: "admin:addMethod:id", name: txt });
        await ctx.reply("📌 أرسل الرقم/المعرف لطريقة الإيداع:");
        return;
      }
      case "admin:addMethod:id": {
        setStep(ctx.from!.id, {
          kind: "admin:addMethod:instructions",
          name: step.name,
          identifier: txt,
        });
        await ctx.reply("📋 أرسل تعليمات الإيداع للمستخدمين:");
        return;
      }
      case "admin:addMethod:instructions": {
        await db.insert(depositMethodsTable).values({
          name: step.name,
          identifier: step.identifier,
          instructions: txt,
          active: true,
        });
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تمت إضافة طريقة الإيداع "${step.name}".`);
        await showMethods(ctx);
        return;
      }
      case "admin:editMethodInstructions": {
        await db
          .update(depositMethodsTable)
          .set({ instructions: txt })
          .where(eq(depositMethodsTable.id, step.methodId));
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply("✅ تم تحديث التعليمات.");
        await showMethodEdit(ctx, step.methodId);
        return;
      }
      /* ---- Contact Links ---- */
      case "admin:addContact:name": {
        setStep(ctx.from!.id, { kind: "admin:addContact:link", name: txt });
        await ctx.reply(`🔗 أرسل رابط/معرف "${txt}" (مثال: https://t.me/support أو @username):`);
        return;
      }
      case "admin:addContact:link": {
        await db.insert(contactLinksTable).values({ name: step.name, link: txt, active: true });
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تمت إضافة وسيلة التواصل "${step.name}".`);
        return;
      }
      case "admin:editContactLink": {
        await db.update(contactLinksTable).set({ link: txt, updatedAt: new Date() }).where(eq(contactLinksTable.id, step.contactId));
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply("✅ تم تحديث رابط التواصل.");
        return;
      }
      /* ---- Virtual Categories ---- */
      case "admin:addVirtualCategory:name": {
        await db.insert(virtualCategoriesTable).values({ name: txt, parentId: step.parentId, active: true });
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تمت إضافة القسم "${txt}". لإضافة منتجات: افتح منتج ← 🚚 نقل ← أرسل ID القسم الجديد.`);
        return;
      }
      case "admin:editVirtualCategory": {
        await db.update(virtualCategoriesTable).set({ name: txt, updatedAt: new Date() }).where(eq(virtualCategoriesTable.id, step.vcId));
        invalidateCaches();
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم تغيير اسم القسم إلى: ${txt}`);
        return;
      }
      /* ---- Manual Products ---- */
      case "admin:addManualProduct:name": {
        setStep(ctx.from!.id, { kind: "admin:addManualProduct:price", name: txt });
        await ctx.reply(`💵 أرسل سعر المنتج بالدولار (مثال: 2.5):`);
        return;
      }
      case "admin:addManualProduct:price": {
        const price = Number(txt);
        if (!Number.isFinite(price) || price < 0) {
          await ctx.reply("⚠️ سعر غير صحيح. أرسل رقماً مثل: 2.5");
          return;
        }
        setStep(ctx.from!.id, { kind: "admin:addManualProduct:catId", name: step.name, priceUsd: price });
        await ctx.reply("📁 أرسل رقم القسم (ID) الذي سيظهر فيه المنتج (0 للرئيسية):");
        return;
      }
      case "admin:addManualProduct:catId": {
        const catId = Number(txt);
        if (!Number.isInteger(catId) || catId < 0) {
          await ctx.reply("⚠️ أرسل رقماً صحيحاً.");
          return;
        }
        // Auto-detect whether this ID is a virtual category or a real one
        const isVcat = catId > 0
          ? !!(await db.select({ id: virtualCategoriesTable.id }).from(virtualCategoriesTable).where(eq(virtualCategoriesTable.id, catId)).limit(1))[0]
          : false;
        setStep(ctx.from!.id, { kind: "admin:addManualProduct:apiId", name: step.name, priceUsd: step.priceUsd, categoryId: catId, categoryIsVirtual: isVcat });
        await ctx.reply(
          `📁 القسم المختار: ${isVcat ? "📂 قسم مخصص" : "🗂️ قسم حقيقي"} (ID: ${catId})\n\n🔗 أرسل رقم المنتج في API الموقع (أو أرسل skip للتخطي):`,
        );
        return;
      }
      case "admin:addManualProduct:apiId": {
        const apiId = txt.toLowerCase() === "skip" ? null : Number(txt);
        await db.insert(manualProductsTable).values({
          name: step.name,
          priceUsd: String(step.priceUsd),
          categoryId: step.categoryId,
          categoryIsVirtual: step.categoryIsVirtual ?? false,
          apiProductId: apiId && Number.isInteger(apiId) ? apiId : null,
          active: true,
        });
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تمت إضافة المنتج "${step.name}" بسعر ${step.priceUsd.toFixed(2)}$.`);
        return;
      }
      /* ---- Manual Product Price Edit ---- */
      case "admin:editManualPrice": {
        const price = Number(txt);
        if (!Number.isFinite(price) || price < 0) {
          await ctx.reply("⚠️ سعر غير صحيح. أرسل رقماً مثل: 3.50");
          return;
        }
        await db
          .update(manualProductsTable)
          .set({ priceUsd: String(price), updatedAt: new Date() })
          .where(eq(manualProductsTable.id, step.productId));
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم تحديث السعر إلى ${price.toFixed(2)}$.`);
        return;
      }
      /* ---- Nav Button Labels ---- */
      case "admin:editBtnLabel": {
        const value = txt.toLowerCase() === "reset" ? null : txt;
        const { setSetting: ss, deleteSetting: ds } = await import("../settings");
        if (value) await ss(step.settingKey, value);
        else await ds(step.settingKey);
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(value ? `✅ تم تحديث الزر إلى: ${value}` : "✅ تمت إعادة النص الافتراضي.");
        return;
      }
      /* ---- Manual Order: Send message to user ---- */
      case "admin:manualOrderMsg": {
        await ctx.telegram.sendMessage(
          step.userId,
          `💬 رسالة من الإدارة بخصوص طلبك #M${step.orderId}:\n\n${txt}`,
          Markup.inlineKeyboard([[Markup.button.callback("🏠 الرئيسية", "home")]]),
        ).catch(() => {});
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم إرسال الرسالة للمستخدم ${step.userId}.`);
        return;
      }
      /* ---- Manual Order: Accept + deliver ---- */
      case "admin:manualOrderAccept": {
        const o = (await db.select().from(manualOrdersTable).where(eq(manualOrdersTable.id, step.orderId)).limit(1))[0];
        if (!o || o.status !== "pending") {
          setStep(ctx.from!.id, { kind: "idle" });
          await ctx.reply("⚠️ الطلب غير موجود أو تم معالجته مسبقاً.");
          return;
        }
        await db.update(manualOrdersTable)
          .set({ status: "accepted", adminNote: txt === "skip" ? null : txt, updatedAt: new Date() })
          .where(eq(manualOrdersTable.id, step.orderId));
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم قبول الطلب #M${step.orderId}.`);
        const rate = await getExchangeRate();
        const syp = Math.round(step.priceUsd * rate);
        const deliveryMsg =
          `✅ تم تنفيذ طلبك #M${step.orderId} بنجاح!\n` +
          `🛒 المنتج: ${step.productName}\n` +
          `💰 المبلغ: ${step.priceUsd.toFixed(2)}$ | ${syp.toLocaleString("en-US")} ل.س` +
          (txt !== "skip" ? `\n\n📦 التسليم:\n${txt}` : "");
        await ctx.telegram.sendMessage(
          step.userId,
          deliveryMsg,
          Markup.inlineKeyboard([[Markup.button.callback("🏠 الرئيسية", "home")]]),
        ).catch(() => {});
        return;
      }
      /* ---- AI Support Chat ---- */
      case "admin:aiSupport": {
        const thinking = await ctx.reply("🤔 جاري التفكير...");
        const aiReply = await callAiSupport(ctx.from!.id, txt);
        try {
          await ctx.telegram.deleteMessage(ctx.chat!.id, thinking.message_id);
        } catch { /* ignore */ }
        await ctx.reply(
          aiReply,
          Markup.inlineKeyboard([
            [Markup.button.callback("🗑️ مسح المحادثة", "adm:aiClear")],
            [Markup.button.callback("⬅️ خروج للإدارة", "admin:menu")],
          ]),
        );
        // Stay in aiSupport step so next message continues the chat
        return;
      }
      /* ---- Auto-ping interval ---- */
      case "admin:setPingInterval": {
        const n = Number(txt);
        if (!Number.isFinite(n) || n < 1 || n > 1440) {
          await ctx.reply("⚠️ أرسل رقماً صحيحاً بين 1 و 1440 دقيقة.");
          return;
        }
        await setSetting("auto_ping_interval_min", String(Math.round(n)));
        await setSetting("auto_ping_last_sent", "0");
        setStep(ctx.from!.id, { kind: "idle" });
        await ctx.reply(`✅ تم تحديد الفترة: كل ${Math.round(n)} دقيقة.`);
        return;
      }
      default:
        return next();
    }
  });
}

/* ---------- Auto-ping Scheduler ---------- */

export function startPingScheduler(bot: Telegraf) {
  // Check every 30 seconds if a ping is due
  setInterval(async () => {
    try {
      const enabled = (await getSetting("auto_ping_enabled")) === "on";
      if (!enabled) return;
      const targetId = Number(await getSetting("auto_ping_target_user_id"));
      if (!targetId) return;
      const intervalMin = Number(await getSetting("auto_ping_interval_min")) || 5;
      const lastSent = Number(await getSetting("auto_ping_last_sent")) || 0;
      const now = Date.now();
      if (now - lastSent < intervalMin * 60_000) return;
      await setSetting("auto_ping_last_sent", String(now));
      // Send /start as a tappable command so admin can tap it to open the bot
      await bot.telegram.sendMessage(targetId, "/start").catch(() => {});
    } catch { /* silent */ }
  }, 30_000).unref();
}

// keep `and` import usage suppressed if not used
void and;
void logger;
