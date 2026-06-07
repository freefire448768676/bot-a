const { drizzle } = require("drizzle-orm/postgres-js");
const postgres = require("postgres");
const {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
} = require("drizzle-orm/pg-core");

// اتصال قاعدة البيانات
const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

// الجداول
const depositMethodsTable = pgTable("deposit_methods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  active: boolean("active").default(true),
});

const depositRequestsTable = pgTable("deposit_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: numeric("amount").notNull(),
  methodId: integer("method_id").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

const productOverridesTable = pgTable("product_overrides", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  price: numeric("price"),
});

const categoryOverridesTable = pgTable("category_overrides", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull(),
  markup: numeric("markup"),
});

const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: integer("telegram_id").unique().notNull(),
  username: text("username"),
  balance: numeric("balance").default("0"),
  isAdmin: boolean("is_admin").default(false),
  adminAuthed: boolean("admin_authed").default(false),
});

const contactLinksTable = pgTable("contact_links", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  link: text("link").notNull(),
});

const virtualCategoriesTable = pgTable("virtual_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

const manualProductsTable = pgTable("manual_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  price: numeric("price").notNull(),
});

const manualOrdersTable = pgTable("manual_orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  productId: integer("product_id").notNull(),
  status: text("status").default("pending"),
});

// تصدير الكل
module.exports = {
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
};
