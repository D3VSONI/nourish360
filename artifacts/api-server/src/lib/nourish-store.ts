import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { ambulanceBookings, auditLogs, clinicalVisits, consentLogs, db, facilities, users } from '@workspace/db';
import type { ClinicalProfile, Facility, Patient, PatientRecord } from '@workspace/api-zod';
import { demoFacilities, evaluate, type WireAssessment, type WireVisit } from '@workspace/nourish-logic';

export const consentPurpose = 'CLINICAL_TRIAGE_AND_EMERGENCY_REFERRAL';
export const consentVersion = '2026-11-demo-v1';
export type User = typeof users.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type RecordWire = Omit<PatientRecord, 'visits'> & { visits: WireVisit[] };
export const secret = (): string => {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required');
  return process.env.SESSION_SECRET;
};
export const digest = (value: string) => createHmac('sha256', secret()).update(value).digest('hex');
export const healthId = () => `N360-SNP-${randomBytes(4).toString('hex').toUpperCase()}`;
export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }

const cases = [
  { health_id: 'N360-SNP-4821', patient_type: 'CHILD', label: 'Aarav · Child', village: 'Ganaur', risk_tier: 'GREEN' },
  { health_id: 'N360-SNP-5306', patient_type: 'PREGNANT_LADY', label: 'Meena · Pregnant', village: 'Murthal', risk_tier: 'AMBER' },
  { health_id: 'N360-SNP-7812', patient_type: 'MOTHER', label: 'Sunita · Postpartum', village: 'Rai', risk_tier: 'RED' },
] as const;
export const demoCases = cases.map(x => ({...x}));

export function patient(user: User): Patient {
  const n = user.phoneNumber.slice(-10);
  return { health_id: user.healthId, patient_type: user.patientType, full_name: user.fullName,
    masked_phone: `+91-${n.slice(0,2)}XXXX${n.slice(-4)}`, village: user.village,
    profile: user.profile as ClinicalProfile, is_demo: user.isDemo };
}

export function visit(row: typeof clinicalVisits.$inferSelect): WireVisit {
  return { id: row.id, created_at: row.createdAt.toISOString(), vitals: row.vitals as WireVisit['vitals'],
    symptoms: row.symptoms as string[], risk_tier: row.riskTier, triggered_rules: row.triggeredRules as string[],
    six_month_forecast: row.forecast as WireVisit['six_month_forecast'], trend: row.trend, trend_details: row.trendDetails as string[],
    next_step: row.nextStep, ...(row.routedFacility ? { routed_facility: row.routedFacility as NonNullable<WireVisit['routed_facility']> } : {}) };
}

export async function getRecord(tx: Tx, user: User): Promise<RecordWire> {
  const rows = await tx.select().from(clinicalVisits).where(eq(clinicalVisits.healthId, user.healthId)).orderBy(asc(clinicalVisits.createdAt));
  return { patient: patient(user), visits: rows.map(visit) };
}

export async function audit(tx: Tx, user: User, action: string, actor = 'verified_demo_session') {
  await tx.insert(auditLogs).values({ subjectHash: digest(`audit:${user.id}`), action, actor });
}

export async function grant(tx: Tx, user: User, device: string) {
  await tx.insert(consentLogs).values({ userId: user.id, healthId: user.healthId, patientType: user.patientType,
    guardianName: user.guardianName, guardianConsent: user.patientType === 'CHILD', consentPurpose, consentVersion,
    ipOrDeviceHash: digest(`consent:${device}`) });
}

export async function lockAccount(tx: Tx, id: string) {
  const [u] = await tx.select().from(users).where(and(eq(users.id, id),eq(users.isTemplate,false))).for('update');
  if (!u) throw new AppError(401, 'Sign in to the demo first.');
  const [c] = await tx.select({id:consentLogs.id}).from(consentLogs).where(and(eq(consentLogs.userId,id),isNull(consentLogs.revokedAt))).limit(1);
  if (!c) throw new AppError(403, 'There is no active consent for this demo record.');
  return u;
}

export async function facilityCatalog(tx: Tx): Promise<Facility[]> {
  return (await tx.select().from(facilities)).map(f => ({ id:f.id, name:f.name, tier:f.tier, lat:f.lat, lng:f.lng, distance_km:f.distanceKm,
    capabilities:f.capabilities, blood_bank_status:f.bloodBankStatus, nicus_available:f.nicusAvailable }));
}

async function writeVisit(tx: Tx, user: User, v: WireVisit) {
  await tx.insert(clinicalVisits).values({ id:v.id, mutationId:v.id, healthId:user.healthId, patientType:user.patientType, vitals:v.vitals, symptoms:v.symptoms,
    riskTier:v.risk_tier, triggeredRules:v.triggered_rules, forecast:v.six_month_forecast, routedFacility:v.routed_facility,
    trend:v.trend, trendDetails:v.trend_details, nextStep:v.next_step, createdAt:new Date(v.created_at) });
}

export async function saveBatch(tx: Tx, user: User, input: WireAssessment[]): Promise<WireVisit[]> {
  const past = (await getRecord(tx,user)).visits;
  const catalog = await facilityCatalog(tx);
  const lookup = new Map(past.map(v => [v.id, v]));
  const result: WireVisit[] = [];
  for (const next of [...input].sort((a,b) => +new Date(a.recorded_at ?? 0) - +new Date(b.recorded_at ?? 0))) {
    const stored = lookup.get(next.mutation_id);
    if (stored) { result.push(stored); continue; }
    const v = evaluate(patient(user),next,past,catalog);
    await writeVisit(tx,user,v);
    await audit(tx,user,'ASSESSMENT_CREATED');
    past.push(v); lookup.set(v.id,v); result.push(v);
  }
  return result;
}

export async function cloneDemo(tx: Tx, template: User, device: string): Promise<User> {
  const [u] = await tx.insert(users).values({ healthId:healthId(), patientType:template.patientType, fullName:template.fullName,
    phoneNumber:template.phoneNumber, village:template.village, guardianName:template.guardianName, profile:template.profile, isDemo:true }).returning();
  if (!u) throw new Error('Demo profile could not be created');
  await grant(tx,u,device);
  const {visits} = await getRecord(tx, template);
  for (const v of visits) await writeVisit(tx,u,{...v,id:randomUUID()});
  await audit(tx,u,'DEMO_PROFILE_CREATED');
  return u;
}

export async function seed(): Promise<void> {
  secret();
  await db.transaction(async tx => {
    const saved = await tx.select({id:users.healthId}).from(users).where(inArray(users.healthId,cases.map(c => c.health_id)));
    for (const f of demoFacilities) await tx.insert(facilities).values({ id:f.id,name:f.name,tier:f.tier,lat:f.lat,lng:f.lng,distanceKm:f.distance_km,
      capabilities:f.capabilities,bloodBankStatus:f.blood_bank_status as typeof facilities.$inferInsert.bloodBankStatus,nicusAvailable:f.nicus_available }).onConflictDoNothing();
    const profiles: ClinicalProfile[] = [
      { dob_months:30, birth_weight_kg:3.1, last_weight_kg:12.4, immunization_status:'Up to date (synthetic)' },
      { age:25, gestational_weeks:25, gravida:2, blood_group:'B+' }, { age:29, days_postpartum:12, delivery_type:'Normal', blood_group:'O+' },
    ];
    const examples: WireAssessment['vitals'][][] = [
      [{weight_kg:11.7,muac_cm:14,temp_c:36.8,resp_rate:27},{weight_kg:12.1,muac_cm:14.4,temp_c:36.9,resp_rate:26},{weight_kg:12.4,muac_cm:14.7,temp_c:36.7,resp_rate:27}],
      [{bp_sys:102,bp_dia:66,hb:11.4,weight_kg:52.7},{bp_sys:116,bp_dia:73,hb:10.1,weight_kg:54.6},{bp_sys:134,bp_dia:85,hb:9.2,weight_kg:56.1}],
      [{bp_sys:118,bp_dia:76,hb:11.3,temp_c:36.7},{bp_sys:110,bp_dia:71,hb:10.4,temp_c:37.2},{bp_sys:91,bp_dia:58,hb:6.6,temp_c:38.2}],
    ];
    for (const [i,c] of cases.entries()) {
      if (saved.some(u => u.id === c.health_id)) continue;
      const [u] = await tx.insert(users).values({ healthId:c.health_id, patientType:c.patient_type, fullName:['Aarav (Demo)','Meena (Demo)','Sunita (Demo)'][i]!,
        phoneNumber:`+91000000000${i+1}`, village:c.village, guardianName:i===0?'Demo Guardian':null, profile:profiles[i]!, isTemplate:true }).onConflictDoNothing().returning();
      if (!u) continue;
      await grant(tx,u,'synthetic-template');
      await audit(tx,u,'DEMO_TEMPLATE_CREATED','system');
      const days = i===2 ? [11,6,1] : [100,49,1];
      await saveBatch(tx,u,examples[i]!.map((v,j) => ({ mutation_id:randomUUID(), vitals:v,
        symptoms:i===2 && j===2 ? ['Excessive vaginal blood loss','Severe dizziness / fainting'] : [],
        recorded_at:new Date(Date.now() - days[j]! * 86_400_000) })));
    }
  });
}

export async function erase(tx:Tx, user:User) {
  await audit(tx,user,'RECORD_ERASED');
  await tx.update(consentLogs).set({healthId:null,guardianName:null,ipOrDeviceHash:null,revokedAt:new Date()}).where(eq(consentLogs.userId,user.id));
  await tx.delete(ambulanceBookings).where(eq(ambulanceBookings.healthId,user.healthId));
  await tx.delete(users).where(eq(users.id,user.id));
}
