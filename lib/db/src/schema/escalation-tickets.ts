import { createInsertSchema } from 'drizzle-zod';
import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { z } from 'zod/v4';
import { clinicalVisits, riskTier, users } from './nourish';

export const escalationAuthority = pgEnum('escalation_authority', [
  'PHC_MEDICAL_OFFICER',
  'CHC_MEDICAL_OFFICER',
  'DISTRICT_MEDICAL_OFFICER',
]);

export const escalationTicketStatus = pgEnum('escalation_ticket_status', [
  'PENDING',
  'ACTION_TAKEN',
]);

export const escalationTickets = pgTable('escalation_tickets', {
  id: uuid().defaultRandom().primaryKey(),
  healthId: text('health_id').notNull().references(() => users.healthId, { onDelete: 'cascade' }),
  visitId: uuid('visit_id').notNull().references(() => clinicalVisits.id, { onDelete: 'cascade' }),
  authority: escalationAuthority('authority').notNull(),
  riskTier: riskTier('risk_tier').notNull(),
  reason: text('reason').notNull(),
  status: escalationTicketStatus('status').notNull().default('PENDING'),
  actionNote: text('action_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index('escalation_tickets_health_created_idx').on(table.healthId, table.createdAt),
  index('escalation_tickets_status_created_idx').on(table.status, table.createdAt),
]);

export const insertEscalationTicketSchema = createInsertSchema(escalationTickets)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEscalationTicket = z.infer<typeof insertEscalationTicketSchema>;
export type EscalationTicket = typeof escalationTickets.$inferSelect;
