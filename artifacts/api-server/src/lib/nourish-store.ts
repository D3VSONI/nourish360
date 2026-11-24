import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { ambulanceBookings, auditLogs, clinicalVisits, consentLogs, db, escalationTickets, facilities, users } from '@workspace/db';
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
  { health_id: '1', aliases: ['N360-SNP-1001','N360-SNP-4821'], full_name: 'Kavya Sharma', guardian_name: 'Sunita Sharma', patient_type: 'CHILD', label: 'Kavya · Child', village: 'Ganaur', risk_tier: 'GREEN' },
  { health_id: '2', aliases: ['N360-SNP-1002','N360-SNP-5306'], full_name: 'Rekha Verma', guardian_name: null, patient_type: 'PREGNANT_LADY', label: 'Rekha · Pregnancy', village: 'Murthal', risk_tier: 'AMBER' },
  { health_id: '3', aliases: ['N360-SNP-1003','N360-SNP-7812'], full_name: 'Pooja Kumari', guardian_name: null, patient_type: 'MOTHER', label: 'Pooja · Postpartum', village: 'Rai', risk_tier: 'RED' },
  { health_id: '4', aliases: ['N360-SNP-1004','N360-SNP-4824'], full_name: 'Aarav Malik', guardian_name: 'Neha Malik', patient_type: 'CHILD', label: 'Aarav · Child', village: 'Barota', risk_tier: 'AMBER' },
  { health_id: '5', aliases: ['N360-SNP-1005','N360-SNP-5307'], full_name: 'Meera Yadav', guardian_name: null, patient_type: 'PREGNANT_LADY', label: 'Meera · Pregnancy', village: 'Kundli', risk_tier: 'RED' },
  { health_id: '6', aliases: ['N360-SNP-1006','N360-SNP-7813'], full_name: 'Sana Ali', guardian_name: null, patient_type: 'MOTHER', label: 'Sana · Postpartum', village: 'Sonipat', risk_tier: 'AMBER' },
  { health_id: '7', aliases: ['N360-SNP-1007','N360-SNP-4825'], full_name: 'Nisha Dahiya', guardian_name: null, patient_type: 'PREGNANT_LADY', label: 'Nisha · Pregnancy', village: 'Kharkhoda', risk_tier: 'AMBER' },
] as const;
export const demoCases = cases.map(({aliases:_,full_name:__,guardian_name:___,...item}) => item);
export const sampleSourceId = (healthId: string) => cases.find(c => c.health_id === healthId)?.aliases[0];

export function patient(user: User): Patient {
  const n = user.phoneNumber.slice(-10);
  return { health_id: user.healthId, patient_type: user.patientType, full_name: user.fullName,
    masked_phone: `+91-${n.slice(0,2)}XXXX${n.slice(-4)}`, village: user.village,
    profile: user.profile as ClinicalProfile, is_demo: user.isDemo };
}

export function visit(row: typeof clinicalVisits.$inferSelect): WireVisit {
  return { id: row.id, mutation_id: row.mutationId, created_at: row.createdAt.toISOString(), vitals: row.vitals as WireVisit['vitals'],
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
  if (!u) throw new AppError(401, 'Sign in to a profile first.');
  const [c] = await tx.select({id:consentLogs.id}).from(consentLogs).where(and(eq(consentLogs.userId,id),isNull(consentLogs.revokedAt))).limit(1);
  if (!c) throw new AppError(403, 'There is no active consent for this profile.');
  return u;
}

export async function facilityCatalog(tx: Tx): Promise<Facility[]> {
  return (await tx.select().from(facilities)).map(f => ({ id:f.id, name:f.name, tier:f.tier, lat:f.lat, lng:f.lng, distance_km:f.distanceKm,
    capabilities:f.capabilities, blood_bank_status:f.bloodBankStatus, nicus_available:f.nicusAvailable }));
}

async function writeVisit(tx: Tx, user: User, v: WireVisit, mutationId=v.id) {
  await tx.insert(clinicalVisits).values({ id:v.id, mutationId, healthId:user.healthId, patientType:user.patientType, vitals:v.vitals, symptoms:v.symptoms,
    riskTier:v.risk_tier, triggeredRules:v.triggered_rules, forecast:v.six_month_forecast, routedFacility:v.routed_facility,
    trend:v.trend, trendDetails:v.trend_details, nextStep:v.next_step, createdAt:new Date(v.created_at) });
}

export async function saveBatch(tx: Tx, user: User, input: WireAssessment[]): Promise<WireVisit[]> {
  const rows = await tx.select().from(clinicalVisits).where(eq(clinicalVisits.healthId,user.healthId));
  const past = rows.map(visit);
  const catalog = await facilityCatalog(tx);
  const lookup = new Map(rows.map((row,i) => [row.mutationId,past[i]!]));
  const result = new Map<string,WireVisit>();
  for (const next of [...input].sort((a,b) => +new Date(a.recorded_at ?? 0) - +new Date(b.recorded_at ?? 0))) {
    const stored = lookup.get(next.mutation_id);
    if (stored) { result.set(next.mutation_id,stored); continue; }
    const v = {...evaluate(patient(user),next,past,catalog),id:randomUUID(),mutation_id:next.mutation_id};
    await writeVisit(tx,user,v,next.mutation_id);
    await audit(tx,user,'ASSESSMENT_CREATED');
    past.push(v); lookup.set(next.mutation_id,v); result.set(next.mutation_id,v);
  }
  return [...result.values()];
}

export async function cloneDemo(tx: Tx, template: User, device: string, healthIdOverride?: string): Promise<User> {
  const [u] = await tx.insert(users).values({ healthId:healthIdOverride ?? healthId(), patientType:template.patientType, fullName:template.fullName,
    phoneNumber:template.phoneNumber, village:template.village, guardianName:template.guardianName, profile:template.profile, isDemo:true }).returning();
  if (!u) throw new Error('Sample profile could not be created');
  await grant(tx,u,device);
  const {visits} = await getRecord(tx, template);
  for (const v of visits) await writeVisit(tx,u,{...v,id:randomUUID()});
  await audit(tx,u,'DEMO_PROFILE_CREATED');
  return u;
}

export async function seed(): Promise<void> {
  secret();
  await db.transaction(async tx => {
    const saved = await tx.select().from(users).where(inArray(users.healthId,cases.flatMap(c => [c.health_id,...c.aliases])));
    for (const user of saved) {
      const sample = cases.find(c => (c.aliases as readonly string[]).includes(user.healthId));
      if (sample && user.isTemplate) {
        await tx.update(users).set({fullName:sample.full_name,guardianName:sample.guardian_name}).where(eq(users.id,user.id));
      }
    }
    for (const f of demoFacilities) await tx.insert(facilities).values({ id:f.id,name:f.name,tier:f.tier,lat:f.lat,lng:f.lng,distanceKm:f.distance_km,
      capabilities:f.capabilities,bloodBankStatus:f.blood_bank_status as typeof facilities.$inferInsert.bloodBankStatus,nicusAvailable:f.nicus_available }).onConflictDoNothing();
    const profiles: ClinicalProfile[] = [
      { dob_months:30, birth_weight_kg:3.1, last_weight_kg:12.4, immunization_status:'Up to date (synthetic)' },
      { age:25, gestational_weeks:25, gravida:2, blood_group:'B+' }, { age:29, days_postpartum:12, delivery_type:'Normal', blood_group:'O+' },
      { dob_months:22, birth_weight_kg:2.8, last_weight_kg:9.8, immunization_status:'Up to date (synthetic)' },
      { age:27, gestational_weeks:31, gravida:2, blood_group:'O+' },
      { age:30, days_postpartum:42, delivery_type:'C-Section', blood_group:'A+' },
      { age:23, gestational_weeks:20, gravida:1, blood_group:'B-' },
    ];
    const examples: WireAssessment['vitals'][][] = [
      [{weight_kg:11.7,muac_cm:14,temp_c:36.8,resp_rate:27},{weight_kg:12.1,muac_cm:14.4,temp_c:36.9,resp_rate:26},{weight_kg:12.4,muac_cm:14.7,temp_c:36.7,resp_rate:27}],
      [{bp_sys:102,bp_dia:66,hb:11.4,weight_kg:52.7},{bp_sys:116,bp_dia:73,hb:10.1,weight_kg:54.6},{bp_sys:134,bp_dia:85,hb:9.2,weight_kg:56.1}],
      [{bp_sys:118,bp_dia:76,hb:11.3,temp_c:36.7},{bp_sys:110,bp_dia:71,hb:10.4,temp_c:37.2},{bp_sys:91,bp_dia:58,hb:6.6,temp_c:38.2}],
      [{weight_kg:9.6,muac_cm:12.7,temp_c:36.8,resp_rate:28},{weight_kg:9.8,muac_cm:12.4,temp_c:36.9,resp_rate:29},{weight_kg:9.8,muac_cm:12.2,temp_c:36.8,resp_rate:30}],
      [{bp_sys:118,bp_dia:76,hb:11.6,weight_kg:61.2},{bp_sys:126,bp_dia:80,hb:10.9,weight_kg:63},{bp_sys:162,bp_dia:108,hb:10.4,weight_kg:64.3}],
      [{bp_sys:112,bp_dia:72,hb:10.8,temp_c:36.7},{bp_sys:114,bp_dia:74,hb:10.1,temp_c:36.8},{bp_sys:116,bp_dia:76,hb:9.6,temp_c:36.9}],
      [{bp_sys:116,bp_dia:72,hb:11.7,weight_kg:54},{bp_sys:126,bp_dia:80,hb:11.5,weight_kg:55},{bp_sys:143,bp_dia:91,hb:11.2,weight_kg:56}],
    ];
    const visitDays = [[100,49,1],[100,49,1],[11,6,1],[90,45,1],[90,45,1],[60,30,1],[100,49,1]];
    const symptomHistory: string[][][] = [
      [[],[],[]], [[],[],[]], [[],[],['Excessive vaginal blood loss','Severe dizziness / fainting']],
      [[],[],[]], [[],[],['Severe headache']], [[],[],[]], [[],[],[]],
    ];
    for (const [i,c] of cases.entries()) {
      for (const id of [c.health_id,...c.aliases]) {
        if (saved.some(u => u.healthId === id)) continue;
        const [u] = await tx.insert(users).values({ healthId:id, patientType:c.patient_type, fullName:c.full_name,
          phoneNumber:`+91000000000${i+1}`, village:c.village, guardianName:c.guardian_name, profile:profiles[i]!, isTemplate:id!==c.health_id, isDemo:true }).onConflictDoNothing().returning();
        if (!u) continue;
        await grant(tx,u,'synthetic-template');
        await audit(tx,u,'DEMO_TEMPLATE_CREATED','system');
        await saveBatch(tx,u,examples[i]!.map((v,j) => ({ mutation_id:randomUUID(), vitals:v,
          symptoms:symptomHistory[i]![j]!,
          recorded_at:new Date(Date.now() - visitDays[i]![j]! * 86_400_000) })));
      }
    }
    const ticketExamples = [
      { healthId: '2', authority: 'CHC_MEDICAL_OFFICER', status: 'PENDING', actionNote: null },
      { healthId: '3', authority: 'DISTRICT_MEDICAL_OFFICER', status: 'ACTION_TAKEN', actionNote: 'Training review documented: readings were rechecked and a follow-up visit was recorded.' },
      { healthId: '5', authority: 'DISTRICT_MEDICAL_OFFICER', status: 'PENDING', actionNote: null },
    ] as const;
    for (const example of ticketExamples) {
      const [existing] = await tx.select({id:escalationTickets.id}).from(escalationTickets)
        .where(eq(escalationTickets.healthId,example.healthId)).limit(1);
      if (existing) continue;
      const [latest] = await tx.select().from(clinicalVisits)
        .where(eq(clinicalVisits.healthId,example.healthId))
        .orderBy(desc(clinicalVisits.createdAt)).limit(1);
      if (!latest || (latest.riskTier !== 'AMBER' && latest.riskTier !== 'RED')) continue;
      const rules = Array.isArray(latest.triggeredRules) ? latest.triggeredRules as string[] : [];
      await tx.insert(escalationTickets).values({
        healthId: example.healthId,
        visitId: latest.id,
        authority: example.authority,
        riskTier: latest.riskTier,
        reason: rules.slice(0,3).join(' ') || `${latest.riskTier} review from the latest check-up.`,
        status: example.status,
        actionNote: example.actionNote,
      }).onConflictDoNothing();
    }
  });
}

export async function erase(tx:Tx, user:User) {
  await audit(tx,user,'RECORD_ERASED');
  await tx.update(consentLogs).set({healthId:null,guardianName:null,ipOrDeviceHash:null,revokedAt:new Date()}).where(eq(consentLogs.userId,user.id));
  await tx.delete(ambulanceBookings).where(eq(ambulanceBookings.healthId,user.healthId));
  await tx.delete(users).where(eq(users.id,user.id));
}
