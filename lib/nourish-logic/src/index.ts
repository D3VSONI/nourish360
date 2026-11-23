import type { AssessmentInput, Facility, Forecast, Patient, Visit, Vitals } from '@workspace/api-zod';
import { selectFacility, villages } from './routing';
export * from './routing';

type Dated<T, K extends keyof T> = Omit<T, K> & { [P in K]: string };
export type WireVisit = Dated<Visit, 'created_at'>;
export type WireAssessment = Omit<AssessmentInput, 'recorded_at'> & { recorded_at?: string | Date };
const ranges: Record<keyof Vitals,[number,number]> = {bp_sys:[35,300],bp_dia:[20,200],hb:[1,25],weight_kg:[0.2,320],temp_c:[25,46],resp_rate:[0,150],muac_cm:[3,65]};
export function validateAssessment(input: WireAssessment): string | undefined {
  if (!Object.keys(input.vitals).length && !input.symptoms.length) return 'Enter a sample reading or select a symptom.';
  for (const [key,value] of Object.entries(input.vitals)) {
    const range = ranges[key as keyof Vitals];
    if (!range || !Number.isFinite(value) || value<range[0] || value>range[1]) return 'A sample vital is outside the accepted entry range.';
  }
  if (input.recorded_at !== undefined) {
    const date = new Date(input.recorded_at);
    if (!Number.isFinite(+date) || +date>Date.now()+300_000 || date.getUTCFullYear()<2020) return 'Enter a valid assessment date.';
  }
  return undefined;
}
const round = (n: number) => Math.round(n * 10) / 10;

export function evaluate(patient: Patient, input: WireAssessment, prior: WireVisit[], facilities?: Facility[]): WireVisit {
  const v = input.vitals;
  const occurred = new Date(input.recorded_at ?? Date.now()).toISOString();
  const history = prior.filter(p => p.created_at <= occurred).sort((a,b) => a.created_at.localeCompare(b.created_at));
  const last = history.at(-1);
  const text = input.symptoms.join(' | ').toLowerCase().replace(/[_-]/g, ' ');
  const red: string[] = [], amber: string[] = [], details: string[] = [];
  const forecast: Forecast[] = [];
  let direction = 0;
  const diff = (key: keyof Vitals, label: string, unit: string) => {
    const current = v[key];
    const earlier = history.flatMap(p => p.vitals[key] === undefined ? [] : [p.vitals[key]!]);
    if (earlier.length && current !== undefined) {
      const delta = round(current - earlier.at(-1)!);
      const long = round(current - earlier[0]!);
      details.push(`${label}: ${earlier.at(-1)} → ${current} ${unit} (${delta >= 0 ? '+' : ''}${delta} since last reading${earlier.length > 1 ? `; ${long >= 0 ? '+' : ''}${long} across ${earlier.length + 1} readings` : ''}).`);
      return { delta, long };
    }
    return undefined;
  };
  const weight = diff('weight_kg', 'Weight', 'kg');
  const bp = diff('bp_sys', 'Systolic BP', 'mmHg');
  const hb = diff('hb', 'Hemoglobin', 'g/dL');
  diff('bp_dia', 'Diastolic BP', 'mmHg'); diff('temp_c','Temperature','°C'); diff('muac_cm','MUAC','cm'); diff('resp_rate','Respiratory rate','/min');
  const add = (condition: string, probability_level: string, timeline: string, clinical_reason: string, preventive_action: string, hindi: string) => forecast.push({condition, probability_level, timeline, clinical_reason, preventive_action, hindi});
  const child = patient.patient_type === 'CHILD';
  const pregnant = patient.patient_type === 'PREGNANT_LADY';
  if (child) {
    if (/unable to drink|unable to breastfeed|unable to feed|vomit.*everything|unconscious|letharg|convuls|seizure|difficult breathing|breathing difficulty/.test(text)) red.push('IMNCI example: a general danger sign or reported breathing difficulty.');
    if (v.temp_c !== undefined && (v.temp_c < 35.5 || v.temp_c >= 39.5)) red.push(`Demo priority rule: temperature ${v.temp_c} °C.`);
    const age = patient.profile.dob_months ?? 0;
    const fast = age < 2 ? 60 : age < 12 ? 50 : 40;
    if (v.resp_rate !== undefined && v.resp_rate >= fast) amber.push(`IMNCI example: recorded breathing rate ${v.resp_rate}/min at ${age} months.`);
    if (/fast breathing|fever|cold body|umbilic/.test(text)) amber.push('Reported temperature, breathing, or umbilical concern.');
    if (age >= 6 && v.muac_cm !== undefined) {
      if (v.muac_cm < 11.5) red.push(`Demo nutrition rule: MUAC ${v.muac_cm} cm.`);
      else if (v.muac_cm < 12.5) amber.push(`Demo nutrition rule: MUAC ${v.muac_cm} cm.`);
    }
    const flat = weight && (weight.delta < 0 || (history.filter(p => p.vitals.weight_kg !== undefined).length >= 2 && weight.delta === 0 && weight.long <= 0.1));
    if (flat) amber.push('Weight did not increase across the recorded checkups.');
    if (flat || (age >= 6 && v.muac_cm !== undefined && v.muac_cm < 12.5)) {
      add('Growth faltering / undernutrition', 'Elevated demo flag', 'Next 1–6 months', 'The recorded growth or MUAC pattern warrants review; there is no predicted personal probability.', 'Discuss growth measurements and age-appropriate feeding with a trained health worker.', 'यह एक उदाहरण है। बच्चे के वजन और भोजन के बारे में स्वास्थ्यकर्मी से बात करें।');
    }
    if (weight) direction += weight.delta < 0 ? -1 : weight.delta > 0 ? 1 : 0;
  } else {
    if ((v.bp_sys ?? 0) >= 160 || (v.bp_dia ?? 0) >= 110) red.push('Demo maternal danger rule: very high BP reading.');
    else if ((v.bp_sys ?? 0) >= 140 || (v.bp_dia ?? 0) >= 90) amber.push('Demo maternal review rule: elevated BP reading.');
    if (bp && (bp.delta >= 15 || bp.long >= 20)) amber.push(`Blood pressure rose ${bp.delta >= 0 ? '+' : ''}${bp.delta} mmHg since the most recent systolic reading (net ${bp.long >= 0 ? '+' : ''}${bp.long} across the series).`);
    if (v.hb !== undefined && v.hb < 7) red.push(`Demo anemia rule: recorded hemoglobin ${v.hb} g/dL.`);
    else if (v.hb !== undefined && v.hb < (pregnant ? 11 : 10)) amber.push(`Demo anemia review flag: Hb ${v.hb} g/dL.`);
    if (pregnant && /severe headache|blurred vision|flashes|vaginal bleed|reduced fetal|reduced.*movement|absent.*movement|severe abdominal|seizur|convuls/.test(text)) red.push('PMSMA example: reported pregnancy danger sign.');
    if (pregnant && /swell/.test(text)) amber.push('Reported sudden swelling; demo clinical review flag.');
    if (!pregnant && /blood loss|bleed|pad|hemorrhag|pph|faint|severe dizziness|seizur/.test(text)) red.push('Postpartum example: reported heavy bleeding, fainting, seizure, or severe dizziness.');
    if (!pregnant && (/fever|chills/.test(text) || (v.temp_c ?? 0) >= 38) && /foul|discharge/.test(text)) red.push('Postpartum example: possible infection signs reported together.');
    else if (!pregnant && (/fever|chills|foul|discharge|breast|engorge/.test(text) || (v.temp_c ?? 0) >= 38)) amber.push('Postpartum example: fever, discharge, or breast symptom merits review.');
    if (v.hb !== undefined && v.hb < 11) add(pregnant ? 'Persistent anemia and pregnancy complications' : 'Persistent postpartum anemia', v.hb < 9 ? 'Elevated demo flag' : 'Review flag', pregnant ? 'Through delivery and the following months' : 'Next 1–3 months', 'Low recorded Hb; this is not a validated prediction of hemorrhage or birth weight.', 'Ask a clinician to review Hb, diet, and whether treatment or retesting is appropriate.', 'यह एक उदाहरण है। हीमोग्लोबिन की जाँच और उपचार के बारे में डॉक्टर से पूछें।');
    if ((v.bp_sys ?? 0) >= 140 || (v.bp_dia ?? 0) >= 90 || (bp?.delta ?? 0) >= 15) add(pregnant ? 'Hypertensive complications of pregnancy' : 'Persistent elevated blood pressure', 'Elevated demo flag', 'Current visit through follow-up', 'Higher recorded BP or a rising pattern in this example.', 'Arrange a clinician review and confirm blood pressure measurements. Do not wait for a forecast date to seek help.', 'यह एक उदाहरण है। रक्तचाप की जाँच और आगे की देखभाल के लिए डॉक्टर से बात करें।');
    if (bp) direction -= bp.delta >= 5 ? 1 : bp.delta <= -5 ? -1 : 0;
    if (hb) direction += hb.delta >= 0.4 ? 1 : hb.delta <= -0.4 ? -1 : 0;
  }
  const needed: (keyof Vitals)[] = child ? ['weight_kg', 'temp_c', 'resp_rate'] : ['bp_sys', 'bp_dia', 'hb'];
  if (needed.some(k => v[k] === undefined)) amber.push('Some baseline readings are missing; no reassuring conclusion can be drawn.');
  if (!forecast.length) add('Routine follow-up', 'No modeled change', 'Next 6 months', 'No pattern among the limited demo rules; this does not rule out health concerns.', 'Follow the checkup schedule agreed with your health worker.', 'अपने स्वास्थ्यकर्मी से अगली जाँच की तारीख पूछें।');
  const risk_tier = red.length ? 'RED' : amber.length ? 'AMBER' : 'GREEN';
  const point = villages.find(p => p.name.toLowerCase() === patient.village.toLowerCase()) ?? villages[0]!;
  const routed_facility = risk_tier === 'RED' ? selectFacility(point, patient.patient_type, `${text} ${red.join(' ')}`, facilities) : undefined;
  return { id: input.mutation_id, created_at: occurred, vitals: v, symptoms: input.symptoms, risk_tier,
    triggered_rules: [...red, ...amber], six_month_forecast: forecast, trend_details: details,
    trend: !last || !details.length ? 'Baseline only' : direction < 0 ? 'Deteriorating' : direction > 0 ? 'Improving' : 'Stable or mixed',
    next_step: risk_tier === 'RED' ? 'In a real emergency, call 108 immediately. The referral shown is simulated.' : risk_tier === 'AMBER' ? 'This example warrants clinical review. A demo PHC review can be logged; no clinic is contacted.' : child ? 'Demo routine plan: confirm the next growth and immunization check with a health worker.' : pregnant ? 'Demo routine plan: confirm your next antenatal check with your care team.' : 'Demo routine plan: confirm your next postnatal check with your care team.',
    ...(routed_facility ? { routed_facility } : {}),
  };
}
