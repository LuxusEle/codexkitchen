import {pgSchema,uuid,text,jsonb,integer,timestamp,index,foreignKey,primaryKey} from 'drizzle-orm/pg-core';

// Separate from all existing user/Neon Auth tables. No destructive migrations.
export const kitchen = pgSchema('codex_kitchen');
export const members = kitchen.table('members', {
  id:text('id').primaryKey(),email:text('email').notNull(),status:text('status').notNull().default('pending'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const projects = kitchen.table('projects', {
  id:uuid('id').notNull(), ownerId:text('owner_id').notNull(), name:text('name').notNull(),
  document:jsonb('document').notNull(), revision:integer('revision').notNull().default(1),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
  updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[primaryKey({columns:[t.ownerId,t.id]}),index('projects_owner_updated').on(t.ownerId,t.updatedAt)]);
export const assets = kitchen.table('assets', {
  id:uuid('id').primaryKey(), projectId:uuid('project_id').notNull(), ownerId:text('owner_id').notNull(),
  name:text('name').notNull(), pathname:text('pathname').notNull().unique(),
  contentType:text('content_type').notNull(), size:integer('size').notNull(), status:text('status').notNull().default('pending'),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),
},t=>[foreignKey({columns:[t.ownerId,t.projectId],foreignColumns:[projects.ownerId,projects.id]}),index('assets_owner_project').on(t.ownerId,t.projectId)]);
