import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import type { Challenge, RegistrationInput } from '@workspace/api-zod';
import { and, eq, lt } from 'drizzle-orm';
import { db, otpChallenges, users } from '@workspace/db';
import { AppError, digest, secret, type Tx } from './nourish-store';

const sessionCookie = 'n360_session';
const deviceCookie = 'n360_browser';
const opts = { secure:true, httpOnly:true, sameSite:'none' as const, partitioned:true, path:'/api' };
const encoder = new TextEncoder();
const issuer = 'nourish360-demo';
export const syntheticPhone = (n: string) => /^(?:\+91)?00000[0-9]{5}$/.test(n.trim());
export const canonicalPhone = (n:string) => `+91${n.trim().slice(-10)}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function browser(req: Request, res: Response) {
  const existing = browserId(req);
  if (existing) return existing;
  const id = randomUUID();
  res.cookie(deviceCookie, id, {...opts,maxAge:86_400_000});
  return id;
}
function browserId(req:Request): string | undefined {
  const value = req.cookies?.[deviceCookie];
  return typeof value === 'string' && uuid.test(value) ? value : undefined;
}
export async function establish(res: Response, id: string) {
  const token = await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setIssuer(issuer).setAudience(issuer).setSubject(id).setIssuedAt().setExpirationTime('12h').sign(encoder.encode(secret()));
  res.cookie(sessionCookie, token, {...opts,maxAge:43_200_000});
}
export function clearSession(res:Response) { res.clearCookie(sessionCookie,opts); }
export async function account(req:Request, optional = false): Promise<string | undefined> {
  const raw = req.cookies?.[sessionCookie];
  if (typeof raw === 'string') {
    try {
      const {payload} = await jwtVerify(raw,encoder.encode(secret()),{ issuer,audience:issuer,algorithms:['HS256'] });
      if (payload.sub && uuid.test(payload.sub)) return payload.sub;
    } catch { /* invalid or expired cookies are not accepted */ }
  }
  if (!optional) throw new AppError(401,'Sign in to a demo profile first.');
  return undefined;
}

const limits = new Map<string,{ reset:number; hits:number }>();
const now = () => Date.now();

export function limit(req:Request, bucket:string, max:number, interval = 60_000) {
  const key = `${bucket}:${digest(`ip:${req.ip ?? 'unknown'}`)}`;
  const current = limits.get(key);
  if (!current || current.reset <= now()) { limits.set(key,{reset:now()+interval,hits:1}); return; }
  if (++current.hits > max) throw new AppError(429,'Too many requests. Wait a minute and try again.');
}
const clean = setInterval(() => {
  for (const [id,x] of limits) if (x.reset <= now()) limits.delete(id);
},60_000);
clean.unref();

export async function issue(tx:Tx, userId:string|null, healthId:string, device:string, channel:'sms'|'call'): Promise<Challenge> {
  const id = randomUUID();
  const code = String(randomInt(100_000, 1_000_000));
  const subjectHash = digest(`otp-subject:${healthId}`);
  const browserHash = digest(`otp-browser:${device}`);
  await tx.delete(otpChallenges).where(lt(otpChallenges.expiresAt,new Date()));
  await tx.delete(otpChallenges).where(and(eq(otpChallenges.subjectHash,subjectHash),eq(otpChallenges.browserHash,browserHash)));
  await tx.insert(otpChallenges).values({id,userId,subjectHash,browserHash,proof:digest(`otp:${id}:${code}`),expiresAt:new Date(now()+5*60_000)});
  return { health_id:healthId, challenge_id:id, channel, demo_code:code };
}
export async function consume<T>(req:Request,id:string,healthId:string,code:string, verify:(tx:Tx,userId:string,device:string)=>Promise<T>): Promise<T> {
  const device = browserId(req);
  if (!device) throw new AppError(400,'The demo code expired. Request a new one.');
  const result = await db.transaction(async tx => {
    const [candidate] = await tx.select({userId:otpChallenges.userId}).from(otpChallenges).where(eq(otpChallenges.id,id));
    // Serialize with reissue and erasure, which also lock the account before modifying challenges.
    if (candidate?.userId) await tx.select({id:users.id}).from(users).where(eq(users.id,candidate.userId)).for('update');
    const [c] = await tx.select().from(otpChallenges).where(eq(otpChallenges.id,id)).for('update');
    if (!c || c.expiresAt.getTime() <= now() || c.subjectHash !== digest(`otp-subject:${healthId}`) || c.browserHash !== digest(`otp-browser:${device}`)) {
      return { error:'The demo code expired. Request a new one.' } as const;
    }
    const matches = timingSafeEqual(Buffer.from(c.proof),Buffer.from(digest(`otp:${id}:${code}`)));
    if (matches || c.attempts >= 4) await tx.delete(otpChallenges).where(eq(otpChallenges.id,id));
    else await tx.update(otpChallenges).set({attempts:c.attempts+1}).where(eq(otpChallenges.id,id));
    if (!matches || !c.userId) return { error:'The demo code or login details did not match.' } as const;
    return { value:await verify(tx,c.userId,device) };
  });
  if ('value' in result) return result.value as T;
  throw new AppError(400,result.error);
}

const inRange = (n:number|undefined,min:number,max:number) => n !== undefined && n>=min && n<=max;
const dateOnly = (s:string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s && Date.parse(s) <= Date.now();
const groups = new Set(['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown']);

export function profileFor(body: RegistrationInput) {
  const p = body.profile;
  if (!body.consent || (body.patient_type==='CHILD' && (!body.guardian_consent || !body.guardian_name?.trim()))) throw new AppError(400,'Explicit consent is required, including a guardian’s name and consent for a child.');
  if (!syntheticPhone(body.phone_number)) throw new AppError(400,'Use a fictional demo number, for example 0000000000. Do not enter a real phone number.');
  if (body.full_name.trim().length < 2 || body.village.trim().length < 2) throw new AppError(400,'Enter a demo alias and select a village.');
  if (body.patient_type==='CHILD') {
    if (!inRange(p.dob_months,0,60) || !inRange(p.birth_weight_kg,0.2,10) || !inRange(p.last_weight_kg,0.2,50)) throw new AppError(400,'Enter the child’s demo age, birth weight and last recorded weight.');
    return {dob_months:p.dob_months,birth_weight_kg:p.birth_weight_kg,last_weight_kg:p.last_weight_kg,immunization_status:'Not recorded'};
  }
  if (!inRange(p.age,12,65) || !p.blood_group || !groups.has(p.blood_group)) throw new AppError(400,'Enter the demo age and select a blood group.');
  if (body.patient_type==='PREGNANT_LADY') {
    if ((!inRange(p.gestational_weeks,1,45) && !dateOnly(p.lmp_date)) || !inRange(p.gravida,1,25)) throw new AppError(400,'Enter gestational weeks or last menstrual date, and pregnancy count.');
    return {age:p.age,blood_group:p.blood_group,gestational_weeks:p.gestational_weeks,lmp_date:dateOnly(p.lmp_date)?p.lmp_date:undefined,gravida:p.gravida};
  }
  if (!inRange(p.days_postpartum,0,730) || !p.delivery_type) throw new AppError(400,'Enter time since delivery and delivery type.');
  return {age:p.age,blood_group:p.blood_group,days_postpartum:p.days_postpartum,delivery_type:p.delivery_type,delivery_date:new Date(Date.now()-p.days_postpartum!*86_400_000).toISOString().slice(0,10)};
}
