import {pgSchema,uuid,text,jsonb,integer,boolean,timestamp,index,foreignKey,primaryKey} from 'drizzle-orm/pg-core';

// Separate from all existing user/Neon Auth tables. No destructive migrations.
export const kitchen = pgSchema('codex_kitchen');
export const businesses = kitchen.table('businesses', {
  id:text('id').primaryKey(),name:text('name').notNull(),profile:jsonb('profile').notNull().default({}),revision:integer('revision').notNull().default(1),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const members = kitchen.table('members', {
  id:text('id').primaryKey(),email:text('email').notNull(),status:text('status').notNull().default('pending'),
  username:text('username').unique(),name:text('name').notNull().default(''),requireEmailVerification:boolean('require_email_verification').notNull().default(false),
  businessId:text('business_id').notNull().default('luxus').references(()=>businesses.id),
  monthlyTarget:integer('monthly_target').notNull().default(0),
  barTokens:integer('bar_tokens').notNull().default(0),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const authLimits = kitchen.table('auth_limits', {
  key:text('key').primaryKey(),count:integer('count').notNull(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),
});
export const loginAlerts = kitchen.table('login_alerts', {
  id:uuid('id').primaryKey(),userId:text('user_id').notNull(),username:text('username').notNull(),
  action:text('action').notNull().default('login'),target:text('target'),
  status:text('status').notNull().default('pending'),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
});
export const projects = kitchen.table('projects', {
  id:uuid('id').notNull(), ownerId:text('owner_id').notNull(), name:text('name').notNull(),
  document:jsonb('document').notNull(), revision:integer('revision').notNull().default(1),
  businessId:text('business_id').notNull().default('luxus').references(()=>businesses.id),
  reviewStatus:text('review_status').notNull().default('draft'),reviewNote:text('review_note').notNull().default(''),
  reviewedRevision:integer('reviewed_revision'),reviewedAt:timestamp('reviewed_at',{withTimezone:true}),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.ownerId,t.id]}),index('projects_owner_updated').on(t.ownerId,t.updatedAt)]);
export const presence = kitchen.table('presence', {
  userId:text('user_id').primaryKey().references(()=>members.id),projectId:uuid('project_id'),
  lastSeen:timestamp('last_seen',{withTimezone:true}).notNull(),lastActive:timestamp('last_active',{withTimezone:true}),
});
export const assets = kitchen.table('assets', {
  id:uuid('id').primaryKey(), projectId:uuid('project_id').notNull(), ownerId:text('owner_id').notNull(),
  name:text('name').notNull(), pathname:text('pathname').notNull().unique(),
  contentType:text('content_type').notNull(), size:integer('size').notNull(), status:text('status').notNull().default('pending'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[foreignKey({columns:[t.ownerId,t.projectId],foreignColumns:[projects.ownerId,projects.id]}),index('assets_owner_project').on(t.ownerId,t.projectId)]);
