import { Router, type Request, type Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import * as api from '@workspace/api-zod';
import { auditLogs, clinicalVisits, consentLogs, db, users } from '@workspace/db';
import { validateAssessment, villages } from '@workspace/nourish-logic';
import { account, browser, canonicalPhone, clearSession, consume, establish, issue, limit, profileFor, syntheticPhone } from '../lib/nourish-auth';
import { AppError, audit, cloneDemo, demoCases, digest, erase, getRecord, grant, healthId, lockAccount, saveBatch, type Tx, type User } from '../lib/nourish-store';

export const router = Router();
export function parse<T>(schema:{safeParse:(data:unknown)=>{success:true;data:T}|{success:false}}, data:unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError(400,'Some fields are missing or invalid. Check the demo form.');
  return parsed.data;
}
export function out<T>(res:Response,schema:{parse:(value:unknown)=>T},data:unknown) { res.json(schema.parse(data)); }
export async function owned<T>(req:Request, run:(tx:Tx,u:User)=>Promise<T>): Promise<T> {
  const id = (await account(req))!;
  return db.transaction(async tx => {
    const u = await lockAccount(tx,id);
    const expected = req.get('x-nourish-record');
    if (expected && expected !== u.healthId) throw new AppError(409,'The signed-in profile changed. Reopen the correct demo record first.');
    return run(tx,u);
  });
}
router.get('/catalog',(req,res) => { browser(req,res); out(res,api.GetCatalogResponse,{villages,demo_cases:demoCases,mode:'demo'}); });
router.post('/demo/session',async (req,res) => {
  limit(req,'session',24);
  const data = parse(api.StartDemoBody,req.body);
  const device = browser(req,res);
  const result = await db.transaction(async tx => {
    const [template] = await tx.select().from(users).where(and(eq(users.healthId,data.health_id),eq(users.isTemplate,true)));
    if (!template) throw new AppError(404,'Demo case not found.');
    const u = await cloneDemo(tx,template,device);
    await audit(tx,u,'RECORD_READ');
    return {id:u.id,record:await getRecord(tx,u)};
  });
  await establish(res,result.id);
  out(res,api.StartDemoResponse,result.record);
});
router.get('/session',async (req,res) => {
  const record = await owned(req,async (tx,u) => { await audit(tx,u,'RECORD_READ'); return getRecord(tx,u); });
  out(res,api.GetSessionResponse,record);
});
router.delete('/session',async (req,res) => {
  const id = await account(req,true);
  if (id) await db.transaction(async tx => {
    const [u] = await tx.select().from(users).where(eq(users.id,id));
    if (u) await audit(tx,u,'SIGNED_OUT');
  });
  clearSession(res);
  out(res,api.EndSessionResponse,{message:'Signed out.'});
});
router.post('/auth/register',async (req,res) => {
  limit(req,'register',12);
  const data = parse(api.RegisterPatientBody,req.body);
  const profile = profileFor(data);
  const device = browser(req,res);
  const challenge = await db.transaction(async tx => {
    const [created] = await tx.insert(users).values({healthId:healthId(),patientType:data.patient_type,fullName:data.full_name.trim(),
      phoneNumber:canonicalPhone(data.phone_number),village:data.village.trim(),guardianName:data.patient_type==='CHILD'?data.guardian_name!.trim():null,profile}).returning();
    if (!created) throw new Error('Registration insert returned no profile');
    await grant(tx,created,device);
    await audit(tx,created,'CONSENT_GRANTED','demo_registration');
    return issue(tx,created.id,created.healthId,device,data.channel);
  });
  out(res,api.RegisterPatientResponse,challenge);
});
router.post('/auth/send-otp',async (req,res) => {
  limit(req,'otp',20);
  const data = parse(api.SendOtpBody,req.body);
  const device = browser(req,res);
  const result = await db.transaction(async tx => {
    const [u] = syntheticPhone(data.phone_number) ? await tx.select().from(users).where(and(eq(users.healthId,data.health_id),eq(users.phoneNumber,canonicalPhone(data.phone_number)))).for('update') : [];
    if (u) await audit(tx,u,'DEMO_OTP_REQUESTED','demo_verification');
    return issue(tx,u?.id ?? null,data.health_id,device,data.channel);
  });
  out(res,api.SendOtpResponse,result);
});
router.post('/auth/verify-otp',async (req,res) => {
  limit(req,'verify',35);
  const data = parse(api.VerifyOtpBody,req.body);
  const result = await consume(req,data.challenge_id,data.health_id,data.code,async (tx,userId,device) => {
    const [found] = await tx.select().from(users).where(eq(users.id,userId));
    if (!found) throw new AppError(400,'The demo details did not match an account.');
    const u = found.isTemplate ? await cloneDemo(tx,found,device) : await lockAccount(tx,found.id);
    await audit(tx,u,'OTP_VERIFIED');
    await audit(tx,u,'RECORD_READ');
    return {id:u.id,record:await getRecord(tx,u)};
  });
  await establish(res,result.id);
  out(res,api.VerifyOtpResponse,result.record);
});
function validateVisit(input: api.AssessmentInput) {
  const error = validateAssessment(input);
  if (error) throw new AppError(400,error);
  return input;
}
router.post('/visits/analyze',async (req,res) => {
  limit(req,'visits',90);
  const data = validateVisit(parse(api.AnalyzeVisitBody,req.body));
  const [visit] = await owned(req,(tx,u)=>saveBatch(tx,u,[data]));
  out(res,api.AnalyzeVisitResponse,visit);
});
router.post('/sync',async (req,res) => {
  limit(req,'sync',45);
  const data = parse(api.SyncVisitsBody,req.body);
  if (!req.get('x-nourish-record')) throw new AppError(400,'Specify the Health ID of the offline assessments.');
  const visits = await owned(req,(tx,u)=>saveBatch(tx,u,data.visits.map(validateVisit)));
  out(res,api.SyncVisitsResponse,{synced_ids:[...new Set(data.visits.map(v=>v.mutation_id))],visits});
});
router.post('/visits/:id/review',async (req,res) => {
  const {id} = parse(api.RequestReviewParams,req.params);
  await owned(req,async (tx,u)=>{
    const [visit] = await tx.select().from(clinicalVisits).where(and(eq(clinicalVisits.id,id),eq(clinicalVisits.healthId,u.healthId)));
    if (!visit || visit.riskTier!=='AMBER') throw new AppError(404,'No saved amber assessment was found. Sync first if offline.');
    if (!visit.reviewRequestedAt) {
      await tx.update(clinicalVisits).set({reviewRequestedAt:new Date()}).where(eq(clinicalVisits.id,id));
      await audit(tx,u,'DEMO_PHC_REVIEW_LOGGED');
    }
  });
  out(res,api.RequestReviewResponse,{message:'Demo priority PHC review logged. No real clinic was contacted.',reference:`PHC-${id.slice(0,8).toUpperCase()}`});
});
router.get('/privacy/export/:healthId',async (req,res) => {
  const {healthId} = parse(api.ExportRecordParams,req.params);
  const record = await owned(req,async (tx,u) => {
    if (u.healthId!==healthId) throw new AppError(404,'Record not found.');
    await audit(tx,u,'RECORD_EXPORTED');
    const [c] = await tx.select().from(consentLogs).where(eq(consentLogs.userId,u.id)).orderBy(desc(consentLogs.grantedAt)).limit(1);
    const events = await tx.select({action:auditLogs.action,actor:auditLogs.actor,timestamp:auditLogs.timestamp}).from(auditLogs).where(eq(auditLogs.subjectHash,digest(`audit:${u.id}`))).orderBy(desc(auditLogs.timestamp));
    return {...await getRecord(tx,u), consent:c?{purpose:c.consentPurpose,version:c.consentVersion,granted_at:c.grantedAt.toISOString(),revoked_at:c.revokedAt?.toISOString()??null,guardian_consent:c.guardianConsent,guardian_name:c.guardianName}: {}, audit:events.map(e=>({...e,timestamp:e.timestamp.toISOString()}))};
  });
  out(res,api.ExportRecordResponse,record);
});
router.delete('/privacy/erase/:healthId',async (req,res) => {
  const {healthId} = parse(api.EraseRecordParams,req.params);
  await owned(req,async (tx,u) => { if (u.healthId!==healthId) throw new AppError(404,'Record not found.'); await erase(tx,u); });
  clearSession(res);
  out(res,api.EraseRecordResponse,{message:'Demo profile and assessments erased. The consent entry was revoked and de-identified.'});
});
