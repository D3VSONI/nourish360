import { and, desc, eq, inArray } from 'drizzle-orm';
import { Router } from 'express';
import * as api from '@workspace/api-zod';
import { clinicalVisits, db, escalationTickets, users } from '@workspace/db';
import { AppError, audit, demoCases } from '../lib/nourish-store';
import { browser, limit } from '../lib/nourish-auth';

export const escalationTicketRouter = Router();
const samplePatientIds: string[] = demoCases.filter(patient => patient.risk_tier !== 'GREEN').map(patient => patient.health_id);

function responseTicket(ticket: typeof escalationTickets.$inferSelect, patient: typeof users.$inferSelect) {
  return {
    id: ticket.id,
    health_id: ticket.healthId,
    patient_name: patient.fullName,
    patient_type: patient.patientType,
    village: patient.village,
    authority: ticket.authority,
    risk_tier: ticket.riskTier,
    reason: ticket.reason,
    status: ticket.status,
    action_note: ticket.actionNote,
    created_at: ticket.createdAt.toISOString(),
    updated_at: ticket.updatedAt.toISOString(),
  };
}

escalationTicketRouter.get('/escalation-tickets', async (req, res): Promise<void> => {
  browser(req, res);
  limit(req, 'ticket-list', 120);
  const rows = await db.select({
    ticket: escalationTickets,
    patient: users,
  }).from(escalationTickets)
    .innerJoin(users, eq(escalationTickets.healthId, users.healthId))
    .where(inArray(escalationTickets.healthId, samplePatientIds))
    .orderBy(desc(escalationTickets.createdAt));

  res.json(api.ListEscalationTicketsResponse.parse(rows.map(row => responseTicket(row.ticket, row.patient))));
});

escalationTicketRouter.post('/escalation-tickets', async (req, res): Promise<void> => {
  browser(req, res);
  limit(req, 'ticket-create', 30);
  const parsed = api.CreateEscalationTicketBody.safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'Check the ticket details and try again.');
  const sample = demoCases.find(patient => patient.health_id === parsed.data.health_id);
  if (!sample || sample.risk_tier === 'GREEN') {
    throw new AppError(403, 'Tickets can be raised only for amber or red sample profiles.');
  }

  const created = await db.transaction(async tx => {
    const [patient] = await tx.select().from(users).where(and(
      eq(users.healthId, parsed.data.health_id),
      eq(users.isDemo, true),
      eq(users.isTemplate, false),
    )).for('update');
    if (!patient) throw new AppError(404, 'Sample patient profile not found.');

    const [visit] = await tx.select().from(clinicalVisits)
      .where(eq(clinicalVisits.healthId, patient.healthId))
      .orderBy(desc(clinicalVisits.createdAt))
      .limit(1);
    if (!visit || (visit.riskTier !== 'AMBER' && visit.riskTier !== 'RED')) {
      throw new AppError(409, 'This profile no longer has a recent amber or red assessment.');
    }

    const storedRules = Array.isArray(visit.triggeredRules) ? visit.triggeredRules as string[] : [];
    const reason = storedRules.slice(0, 3).join(' ') || `${visit.riskTier} review is recommended from the latest check-up.`;
    const [ticket] = await tx.insert(escalationTickets).values({
      healthId: patient.healthId,
      visitId: visit.id,
      authority: parsed.data.authority,
      riskTier: visit.riskTier,
      reason,
    }).returning();
    if (!ticket) throw new Error('Ticket insert returned no record.');
    await audit(tx, patient, 'ESCALATION_TICKET_RAISED', 'training_worker');
    return responseTicket(ticket, patient);
  });

  res.status(201).json(api.CreateEscalationTicketResponse.parse(created));
});
