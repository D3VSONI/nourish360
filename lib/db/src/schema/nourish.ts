import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

const stamp = (name: string) => timestamp(name, { withTimezone: true });
export const patientType = pgEnum('patient_type', ['CHILD', 'PREGNANT_LADY', 'MOTHER']);
export const riskTier = pgEnum('risk_tier', ['GREEN', 'AMBER', 'RED']);
export const bloodStatus = pgEnum('blood_bank_status', ['AVAILABLE', 'OUT_OF_STOCK', 'NONE']);
export const ambulanceStatus = pgEnum('ambulance_status', ['DISPATCHED', 'EN_ROUTE', 'ARRIVED']);

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  healthId: text('health_id').notNull().unique(),
  patientType: patientType('patient_type').notNull(),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number').notNull(),
  village: text().notNull(),
  guardianName: text('guardian_name'),
  profile: jsonb('role_specific_profile').notNull(),
  isDemo: boolean('is_demo').notNull().default(true),
  isTemplate: boolean('is_template').notNull().default(false),
  createdAt: stamp('created_at').notNull().defaultNow(),
});

export const consentLogs = pgTable('dpdp_consent_logs', {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  healthId: text('health_id'),
  patientType: patientType('patient_type').notNull(),
  guardianName: text('guardian_name'),
  guardianConsent: boolean('guardian_consent').notNull(),
  consentPurpose: text('consent_purpose').notNull(),
  consentVersion: text('consent_version').notNull(),
  ipOrDeviceHash: text('ip_or_device_hash'),
  grantedAt: stamp('granted_at').notNull().defaultNow(),
  revokedAt: stamp('revoked_at'),
}, t => [index('consent_user_idx').on(t.userId)]);

export const clinicalVisits = pgTable('clinical_visits', {
  id: uuid().defaultRandom().primaryKey(),
  mutationId: uuid('mutation_id').notNull(),
  healthId: text('health_id').notNull().references(() => users.healthId, { onDelete: 'cascade' }),
  patientType: patientType('patient_type').notNull(),
  vitals: jsonb().notNull(),
  symptoms: jsonb().notNull(),
  riskTier: riskTier('risk_tier').notNull(),
  triggeredRules: jsonb('triggered_rules').notNull(),
  forecast: jsonb('six_month_forecast').notNull(),
  routedFacility: jsonb('routed_facility'),
  trend: text().notNull(),
  trendDetails: jsonb('trend_details').notNull(),
  nextStep: text('next_step').notNull(),
  createdAt: stamp('created_at').notNull().defaultNow(),
  reviewRequestedAt: stamp('review_requested_at'),
}, t => [index('visits_health_date_idx').on(t.healthId, t.createdAt), uniqueIndex('visits_sync_idx').on(t.healthId, t.mutationId)]);

export const facilities = pgTable('facilities', {
  id: text().primaryKey(), name: text().notNull(), tier: text().notNull(),
  lat: doublePrecision().notNull(), lng: doublePrecision().notNull(),
  distanceKm: doublePrecision('distance_km').notNull(), capabilities: jsonb().$type<string[]>().notNull(),
  bloodBankStatus: bloodStatus('blood_bank_status').notNull(), nicusAvailable: integer('nicus_available').notNull(),
});

export const ambulanceBookings = pgTable('ambulance_bookings', {
  id: uuid().defaultRandom().primaryKey(), bookingCode: text('booking_code').notNull().unique(),
  healthId: text('health_id').references(() => users.healthId, { onDelete: 'cascade' }),
  patientType: patientType('patient_type').notNull(), emergencyType: text('emergency_type').notNull(),
  pickupVillage: text('pickup_village').notNull(), pickupLat: doublePrecision('pickup_lat').notNull(), pickupLng: doublePrecision('pickup_lng').notNull(),
  destinationFacilityId: text('destination_facility_id').notNull().references(() => facilities.id),
  destinationFacilityName: text('destination_facility_name').notNull(), bypassedFacilities: jsonb('bypassed_facilities').notNull(),
  driverName: text('driver_name').notNull(), driverPhone: text('driver_phone').notNull(), ambulanceNumber: text('ambulance_number').notNull(),
  etaSeconds: integer('eta_seconds').notNull(), status: ambulanceStatus().notNull(),
  snapshot: jsonb().notNull(),
  familyCallAt: stamp('family_call_at'), createdAt: stamp('created_at').notNull().defaultNow(),
});

// No raw patient identifiers or contact details are stored in this append-only event interface.
export const auditLogs = pgTable('audit_logs', {
  id: uuid().defaultRandom().primaryKey(),
  subjectHash: text('subject_hash').notNull(),
  action: text().notNull(), actor: text().notNull(), timestamp: stamp('timestamp').notNull().defaultNow(),
}, t => [index('audit_subject_idx').on(t.subjectHash)]);
