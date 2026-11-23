import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { and, desc, eq, gte } from 'drizzle-orm';
import { BookAmbulanceBody, BookAmbulanceResponse, GetActiveDrillsResponse, GetAmbulanceParams, GetAmbulanceResponse, TriggerFamilyCallParams, TriggerFamilyCallResponse, type Booking } from '@workspace/api-zod';
import { ambulanceBookings, db } from '@workspace/db';
import { guides, selectFacility, villages } from '@workspace/nourish-logic';
import { AppError, audit, digest, facilityCatalog, lockAccount, type Tx, type User } from '../lib/nourish-store';
import { account, limit } from '../lib/nourish-auth';
import { out, owned, parse } from './nourish';

export const dispatch = Router();
const triggers: [RegExp,string][] = [
  [/loss|bleed|hemorrhag|haemorrhag|pph/i,'Excessive blood loss / hemorrhage'],
  [/seizur|convuls|high bp|pressure|eclamps/i,'Seizures / high BP'],
  [/fever|breath|respir|cold|infect/i,'High fever / breathing difficulty'],
  [/labo[u]?r|contraction/i,'Labor pain'],
  [/fall|trauma|injury/i,'Injury'],
  [/unconscious|drowsy|danger|other|unsure|critical|emergency|urgent/i,'Other urgent concern'],
];
type BookingWire = Omit<Booking,'created_at'> & {created_at:string};
const simulationSeconds = 522;
function tracking(row: typeof ambulanceBookings.$inferSelect): BookingWire {
  const snapshot = row.snapshot as Pick<BookingWire,'route'|'guide'|'destination'|'bypassed_facilities'>;
  const elapsed = Math.max(0,Math.floor((Date.now()-row.createdAt.getTime())/1000));
  const eta = Math.max(0,row.etaSeconds-elapsed);
  return { id:row.id,booking_code:row.bookingCode,patient_type:row.patientType,emergency_type:row.emergencyType,
    pickup_village:row.pickupVillage,pickup_lat:row.pickupLat,pickup_lng:row.pickupLng,driver_name:row.driverName,driver_phone:row.driverPhone,
    ambulance_number:row.ambulanceNumber,eta_seconds:eta,status:eta===0?'ARRIVED':elapsed>=8?'EN_ROUTE':'DISPATCHED',created_at:row.createdAt.toISOString(),simulation:true,...snapshot };
}

dispatch.post('/ambulance/book',async (req,res)=>{
  limit(req,'dispatch',20);
  const body = parse(BookAmbulanceBody,req.body);
  const point = villages.find(p=>p.name.toLowerCase()===body.pickup_village.trim().toLowerCase());
  if (!point) throw new AppError(400,'Select a listed pickup village. Real GPS is not collected by this demo.');
  const trigger = triggers.find(([match])=> match.test(body.emergency_type))?.[1];
  if (!trigger) throw new AppError(400,'Select a demo emergency scenario.');
  const accountId = await account(req,true);
  const expected = req.get('x-nourish-record');
  if (expected && !accountId) throw new AppError(401,'Sign in to save this demo drill to your profile.');
  const booking = await db.transaction(async tx=>{
    const u = accountId ? await lockAccount(tx,accountId) : null;
    if (expected && expected !== u?.healthId) throw new AppError(409,'The signed-in profile changed. Reopen the correct demo record first.');
    const requestKey = digest(`dispatch:${u?.id ?? 'guest'}:${body.mutation_id}`);
    const identical = (row:typeof ambulanceBookings.$inferSelect) => {
      if (row.patientType !== body.patient_type || row.pickupVillage !== point.name || row.emergencyType !== trigger) {
        throw new AppError(409,'This drill request was already used with different details.');
      }
      return tracking(row);
    };
    const [existing] = await tx.select().from(ambulanceBookings).where(eq(ambulanceBookings.requestKey,requestKey));
    if (existing) return identical(existing);
    const referral = selectFacility(point,body.patient_type,trigger,await facilityCatalog(tx));
    if (!referral) throw new AppError(503,'No simulated destination was available. In a real emergency call 108.');
    const {facility,bypassed} = referral;
    const route = [ { lat:facility.lat,lng:facility.lng }, { lat:facility.lat + (point.lat-facility.lat)*.43, lng:facility.lng + (point.lng-facility.lng)*.22 },
      { lat:facility.lat + (point.lat-facility.lat)*.69, lng:facility.lng + (point.lng-facility.lng)*.64 }, {lat:point.lat,lng:point.lng} ];
    const [row] = await tx.insert(ambulanceBookings).values({bookingCode:`SIM-${randomBytes(4).toString('hex').toUpperCase()}`,
      requestKey,healthId:u?.healthId,patientType:body.patient_type,emergencyType:trigger,pickupVillage:point.name,
      pickupLat:point.lat,pickupLng:point.lng,destinationFacilityId:facility.id,destinationFacilityName:facility.name,bypassedFacilities:bypassed,
      driverName:'Ravi Kumar (Demo)',driverPhone:'+91-00XXXX0000',ambulanceNumber:'HR-10-GV-1084',etaSeconds:simulationSeconds,status:'DISPATCHED',
      snapshot:{route,guide:guides[body.patient_type],destination:facility,bypassed_facilities:bypassed}})
      .onConflictDoNothing({target:ambulanceBookings.requestKey}).returning();
    if (!row) {
      const [saved] = await tx.select().from(ambulanceBookings).where(eq(ambulanceBookings.requestKey,requestKey));
      if (saved) return identical(saved);
      throw new AppError(503,'Could not save the demo drill. Retry the same request.');
    }
    if (u && row.healthId) await audit(tx,u,'DEMO_AMBULANCE_BOOKED');
    return tracking(row);
  });
  out(res,BookAmbulanceResponse,booking);
});
dispatch.get('/ambulance/active',async (req,res)=>{
  const drills = await owned(req,async (tx,u)=>{
    const rows = await tx.select().from(ambulanceBookings).where(and(eq(ambulanceBookings.healthId,u.healthId),
      gte(ambulanceBookings.createdAt,new Date(Date.now()-simulationSeconds*1000)))).orderBy(desc(ambulanceBookings.createdAt));
    return rows.map(tracking).filter(drill=>drill.status!=='ARRIVED');
  });
  out(res,GetActiveDrillsResponse,{drills});
});

async function loadDrill(tx:Tx,id:string,owner:User|null) {
  const [row] = await tx.select().from(ambulanceBookings).where(eq(ambulanceBookings.id,id));
  // Guest bookings are synthetic and shareable by their opaque booking URL.
  if (!row || (row.healthId && row.healthId!==owner?.healthId)) throw new AppError(404,'Demo tracking session not found.');
  return row;
}
async function ownerFor(tx:Tx,id:string|undefined) {
  if (!id) return null;
  try { return await lockAccount(tx,id); } catch (e) {
    if (e instanceof AppError && [401,403].includes(e.status)) return null;
    throw e;
  }
}
dispatch.get('/ambulance/:id',async (req,res)=>{
  const {id} = parse(GetAmbulanceParams,req.params);
  const accountId = await account(req,true);
  const row = await db.transaction(async tx => loadDrill(tx,id,await ownerFor(tx,accountId)));
  out(res,GetAmbulanceResponse,tracking(row));
});
dispatch.post('/ambulance/:id/family-call',async (req,res)=>{
  limit(req,'demo-family',20);
  const {id} = parse(TriggerFamilyCallParams,req.params);
  const accountId = await account(req,true);
  const row = await db.transaction(async tx=>{
    const row = await loadDrill(tx,id,await ownerFor(tx,accountId));
    await tx.update(ambulanceBookings).set({familyCallAt:new Date()}).where(eq(ambulanceBookings.id,id));
    return row;
  });
  out(res,TriggerFamilyCallResponse,{message:'Demo family voice alert logged. No call was placed.',reference:row.bookingCode});
});
