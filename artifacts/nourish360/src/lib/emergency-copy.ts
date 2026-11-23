import type { PatientType } from '@workspace/api-client-react';
import { local,type Lang,type Pair } from './i18n';
export const scenarios={
  bleeding:['Excessive bleeding','बहुत ज़्यादा खून बहना'],
  bp:['Seizures or very high BP','दौरा या बहुत ज़्यादा बीपी'],
  breathing:['High fever or breathing difficulty','तेज़ बुखार या साँस में दिक्कत'],
  labor:['Labour pain','प्रसव का दर्द'],
  alertness:['Unconscious or very drowsy','बेहोशी या बहुत सुस्ती'],
  other:['Other urgent concern','दूसरी इमरजेंसी'],
} as const satisfies Record<string,Pair>;
export type Scenario=keyof typeof scenarios;
export const scenarioWire=(key:Scenario)=>scenarios[key][0];
export const scenarioText=(key:Scenario,lang:Lang)=>local(scenarios[key],lang);
export function scenarioKey(wire:string):Scenario {
  return (Object.keys(scenarios) as Scenario[]).find(k=>scenarioWire(k)===wire)??({'Excessive blood loss / hemorrhage':'bleeding','Seizures / high BP':'bp','High fever / breathing difficulty':'breathing','Labor pain':'labor'} as Record<string,Scenario>)[wire]??'other';
}
const waitForHelp:Pair=['Stay with them. Tell 108 if their breathing or alertness changes.','उनके पास रहें। साँस या होश में बदलाव हो तो 108 को बताएँ।'];
const call:Pair=['Call 108 in a real emergency. Follow the dispatcher’s instructions.','असली इमरजेंसी में 108 मिलाएँ। ऑपरेटर की बात मानें।'];
const meet:Pair=['If safe, ask someone to guide responders from a nearby landmark.','अगर सुरक्षित हो तो किसी को पास की पहचान वाली जगह से मदद करने वालों को रास्ता दिखाने भेजें।'];
export const steps:Record<PatientType,Pair[]>={
 CHILD:[call,['Tell 108 the child’s age and what changed in their breathing, alertness or feeding.','108 को बच्चे की उम्र और साँस, होश या दूध पीने में बदलाव बताएँ।'],waitForHelp,meet],
 PREGNANT_LADY:[call,['Tell 108 about the pregnancy and any heavy bleeding, fit, or breathing trouble.','108 को गर्भ के बारे में बताएँ। बहुत खून बह रहा हो, दौरा पड़ा हो या साँस में दिक्कत हो तो बताएँ।'],waitForHelp,meet],
 MOTHER:[call,['Tell 108 when the birth happened and describe any bleeding, fever or fainting.','108 को बताएँ कि प्रसव कब हुआ। खून बहना, बुखार या बेहोशी हुई हो तो बताएँ।'],waitForHelp,meet],
};
const reasons:Record<string,Pair>={
 'not an emergency referral unit':['No emergency referral unit','इमरजेंसी रेफ़रल यूनिट नहीं है'],
 'no pediatric emergency care':['No children’s emergency care','बच्चों की इमरजेंसी देखभाल नहीं है'],
 'no listed neonatal capacity':['No listed newborn critical care','नवजात गहन देखभाल दर्ज नहीं है'],
 'no emergency obstetrics':['No emergency maternity care','इमरजेंसी प्रसूति सेवा नहीं है'],
 'no available blood bank':['No available blood bank','ब्लड बैंक उपलब्ध नहीं है'],
};
export const bypassReason=(wire:string,lang:Lang)=>wire.split('; ').filter(Boolean).map(k=>local(reasons[k]??['Required care not listed','ज़रूरी सेवा दर्ज नहीं है'],lang)).join(' · ');
