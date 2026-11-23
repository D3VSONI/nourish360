import type { Facility, PatientType, Referral, Village } from '@workspace/api-zod';

export const villages: Village[] = [
  { name: 'Ganaur', lat: 29.1389, lng: 77.0143 },
  { name: 'Rai', lat: 28.9224, lng: 77.1012 },
  { name: 'Murthal', lat: 29.035, lng: 77.0583 },
  { name: 'Barota', lat: 28.8883, lng: 77.0053 },
  { name: 'Kundli', lat: 28.8762, lng: 77.1224 },
  { name: 'Kharkhoda', lat: 28.8766, lng: 76.9196 },
  { name: 'Sonipat', lat: 28.995, lng: 77.019 },
];

// Fictional capabilities and locations approximate the regional setting. Never used as live facility information.
export const demoFacilities: Facility[] = [
  { id: 'ganaur-phc', name: 'PHC Ganaur', tier: 'PHC', lat: 29.1296, lng: 77.0133, distance_km: 0, capabilities: ['Basic care', 'Outpatient review'], blood_bank_status: 'NONE', nicus_available: 0 },
  { id: 'murthal-chc', name: 'CHC Murthal', tier: 'CHC', lat: 29.0256, lng: 77.065, distance_km: 0, capabilities: ['Basic care', 'Oxygen'], blood_bank_status: 'NONE', nicus_available: 0 },
  { id: 'rai-phc', name: 'PHC Rai', tier: 'PHC', lat: 28.9336, lng: 77.103, distance_km: 0, capabilities: ['Basic care', 'Outpatient review'], blood_bank_status: 'NONE', nicus_available: 0 },
  { id: 'kharkhoda-chc', name: 'CHC Kharkhoda', tier: 'CHC', lat: 28.8724, lng: 76.9168, distance_km: 0, capabilities: ['Basic care', 'Oxygen'], blood_bank_status: 'OUT_OF_STOCK', nicus_available: 0 },
  { id: 'sonipat-fru', name: 'District Civil Hospital, Sonipat', tier: 'FRU', lat: 28.9912, lng: 77.0248, distance_km: 0, capabilities: ['Oxygen', 'Emergency obstetrics', 'Pediatric emergency', 'Blood bank', 'Neonatal care'], blood_bank_status: 'AVAILABLE', nicus_available: 4 },
];

export function selectFacility(point: {lat: number; lng: number}, role: PatientType, trigger: string, facilities = demoFacilities): Referral | undefined {
  const blood = /hemorrhag|haemorrhag|bleed|blood loss|pph/.test(trigger.toLowerCase());
  const missing = (f: Facility) => [
    ...(f.tier !== 'FRU' ? ['not an emergency referral unit'] : []),
    ...(role === 'CHILD' && !f.capabilities.includes('Pediatric emergency') ? ['no pediatric emergency care'] : []),
    ...(role === 'CHILD' && !f.nicus_available ? ['no listed neonatal capacity'] : []),
    ...(role !== 'CHILD' && !f.capabilities.includes('Emergency obstetrics') ? ['no emergency obstetrics'] : []),
    ...(blood && f.blood_bank_status !== 'AVAILABLE' ? ['no available blood bank'] : []),
  ];
  const ranked = facilities.map(f => ({ ...f, distance_km: Math.round(10 * Math.hypot((point.lat - f.lat) * 111, (point.lng - f.lng) * 97)) / 10 })).sort((a, b) => a.distance_km - b.distance_km);
  const destination = ranked.findIndex(f => !missing(f).length);
  const facility = ranked[destination];
  if (!facility) return;
  return { facility, bypassed: ranked.slice(0, destination).map(f => ({ name: f.name, reason: missing(f).join('; '), distance_km: f.distance_km })) };
}

export const guides: Record<PatientType, string[]> = {
  PREGNANT_LADY: ['In a real emergency, call 108 now and follow the dispatcher’s instructions.', 'Tell the dispatcher about the pregnancy, any bleeding, seizures, breathing changes, or loss of consciousness.', 'Stay with the person. Tell the dispatcher immediately if their alertness or breathing changes.', 'Have someone meet responders at a familiar landmark if safe to do so.'],
  MOTHER: ['In a real emergency, call 108 now and follow the dispatcher’s instructions.', 'Tell the dispatcher how recently the mother delivered and describe any bleeding, fever, fainting, or breathing changes.', 'Stay with the mother and keep her comfortable while following instructions. Do not attempt procedures shown elsewhere.', 'If someone else is available, have them meet responders and share the location.'],
  CHILD: ['In a real emergency, call 108 now and follow the dispatcher’s instructions.', 'Tell the dispatcher the child’s age and describe any changes in breathing, alertness, or ability to feed.', 'Stay with the child. If the child is drowsy or struggling to breathe, ask the dispatcher before giving anything by mouth.', 'Follow the dispatcher’s guidance and report any changes immediately.'],
};
