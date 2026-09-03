import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
});

export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationsTable = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ── Multi-tenant ───────────────────────────────────────────────────────────

export const companiesTable = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const companyRoleEnum = pgEnum("company_role", ["owner", "member"]);

export const companyMembersTable = pgTable(
  "company_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    role: companyRoleEnum("role").default("owner").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    companyUserUnique: uniqueIndex("company_members_company_user_unique").on(t.companyId, t.userId),
    companyIdIdx: index("company_members_company_id_idx").on(t.companyId),
  })
);

// ── Prospecção — Fase 2 ─────────────────────────────────────────────────────

export const prospectingNichesTable = pgTable(
  "prospecting_niches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    keywords: text("keywords").array().notNull().default(sql`'{}'`),
    targetServices: text("target_services").array().notNull().default(sql`'{}'`),
    commonPains: text("common_pains").array().notNull().default(sql`'{}'`),
    baseMessageTemplate: text("base_message_template").notNull().default(""),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("prospecting_niches_company_id_idx").on(t.companyId),
  })
);

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "running", "completed", "failed"]);

export const prospectingCampaignsTable = pgTable(
  "prospecting_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => prospectingNichesTable.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    cep: varchar("cep", { length: 8 }),
    city: text("city").notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    country: text("country").notNull().default("Brazil"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    radiusKm: integer("radius_km").notNull().default(5),
    maxResults: integer("max_results").notNull().default(50),
    additionalKeywords: text("additional_keywords").array().notNull().default(sql`'{}'`),
    status: campaignStatusEnum("status").notNull().default("draft"),
    totalFound: integer("total_found").notNull().default(0),
    lastRunAt: timestamp("last_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("campaigns_company_id_idx").on(t.companyId),
    nicheIdIdx: index("campaigns_niche_id_idx").on(t.nicheId),
  })
);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "qualified",
  "not_qualified",
  "whatsapp_opened",
  "message_sent",
  "responded",
  "lost",
  "do_not_contact",
]);

export const whatsappStatusEnum = pgEnum("whatsapp_status", ["unknown", "probable", "confirmed", "invalid"]);

export const prospectingLeadsTable = pgTable(
  "prospecting_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companiesTable.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => prospectingCampaignsTable.id, { onDelete: "cascade" }),
    nicheId: uuid("niche_id")
      .notNull()
      .references(() => prospectingNichesTable.id, { onDelete: "restrict" }),
    source: text("source").notNull().default("overpass"),
    name: text("name").notNull(),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    websiteUrl: text("website_url"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    score: integer("score").notNull().default(0),
    status: leadStatusEnum("status").notNull().default("new"),
    whatsappStatus: whatsappStatusEnum("whatsapp_status").notNull().default("unknown"),
    hasWebsite: boolean("has_website").notNull().default(false),
    hasInstagram: boolean("has_instagram").notNull().default(false),
    hasWhatsapp: boolean("has_whatsapp").notNull().default(false),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    aiOverview: text("ai_overview"),
    suggestedOffer: text("suggested_offer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    companyIdIdx: index("leads_company_id_idx").on(t.companyId),
    campaignIdIdx: index("leads_campaign_id_idx").on(t.campaignId),
    statusIdx: index("leads_status_idx").on(t.status),
    scoreIdx: index("leads_score_idx").on(t.score),
  })
);
