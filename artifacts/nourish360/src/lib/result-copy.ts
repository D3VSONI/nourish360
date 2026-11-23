import type { Forecast,PatientType,RiskTier } from '@workspace/api-client-react';
import { local,type Lang,type Pair } from './i18n';

export const tierCopy:Record<RiskTier,{tag:Pair;title:Pair;note:Pair;zone:string}>={
 GREEN:{tag:['Green · Routine','हरा · सामान्य जाँच'],title:['No demo warning flags','डेमो में कोई चेतावनी नहीं'],note:['These rules check only a few signs. Keep the next visit agreed with your health worker.','इस अभ्यास में कुछ ही लक्षण देखे गए हैं। स्वास्थ्यकर्मी से तय अगली जाँच कराएँ।'],zone:'zone-green'},
 AMBER:{tag:['Amber · Review','पीला · दोबारा जाँच'],title:['Ask a clinician to review','डॉक्टर से जाँच करवाएँ'],note:['The readings or symptoms need review, or a key reading is missing.','माप या लक्षण डॉक्टर को दिखाने हैं, या कोई ज़रूरी माप बाकी है।'],zone:'zone-amber'},
 RED:{tag:['Red · Urgent','लाल · तुरंत मदद'],title:['Urgent warning in this demo','डेमो में गंभीर चेतावनी'],note:['If this is a real emergency, call 108 now. Practice tracking does not send help.','असली इमरजेंसी में अभी 108 मिलाएँ। अभ्यास से मदद नहीं भेजी जाती।'],zone:'zone-red'},
};
const reasons={
 childDanger:['Child danger sign or breathing difficulty','बच्चे में गंभीर लक्षण या साँस लेने में दिक्कत'],
 temperature:['Temperature flagged: {0} °C','तापमान पर ध्यान दें: {0} °C'],
 fastBreathing:['Breathing rate: {0}/min at {1} months','साँस की रफ़्तार: {1} महीने की उम्र में {0}/मिनट'],
 childSymptoms:['Temperature, breathing, or navel symptom','तापमान, साँस या नाभि का लक्षण'],
 muac:['Upper-arm size flagged: {0} cm','बाँह की गोलाई पर ध्यान दें: {0} सेमी'],
 weight:['Weight did not increase','वज़न नहीं बढ़ा'],
 veryHighBp:['Very high blood pressure','बीपी बहुत ज़्यादा'],
 highBp:['High blood pressure','बीपी ज़्यादा'],
 climbingBp:['Upper BP change: {0} mmHg since last time ({1} overall)','ऊपर वाले बीपी में बदलाव: पिछली बार से {0} mmHg (कुल {1})'],
 anemiaDanger:['Hemoglobin very low: {0} g/dL','हीमोग्लोबिन बहुत कम: {0} g/dL'],
 anemiaReview:['Hemoglobin low: {0} g/dL','हीमोग्लोबिन कम: {0} g/dL'],
 pregnancyDanger:['Pregnancy danger sign reported','गर्भावस्था का गंभीर लक्षण'],
 swelling:['Sudden swelling reported','अचानक सूजन का लक्षण'],
 postpartumDanger:['Heavy bleeding, fainting, fit, or severe dizziness reported','ज़्यादा खून, बेहोशी, दौरा या बहुत चक्कर का लक्षण'],
 postpartumInfection:['Possible infection signs together','संक्रमण के एक से अधिक लक्षण'],
 postpartumReview:['Fever, discharge or breast symptom','बुखार, स्राव या स्तन का लक्षण'],
 missing:['Some key measurements are missing','कुछ ज़रूरी माप नहीं भरे गए'],
} as const satisfies Record<string,Pair>;
// Historic visits retain English rule snapshots. Translate their stable categories and parameters, not their prose.
const adapters:[keyof typeof reasons,RegExp][]=[
 ['childDanger',/^IMNCI example: a general danger sign/],['temperature',/^Demo priority rule: temperature ([\d.]+)/],['fastBreathing',/^IMNCI example: recorded breathing rate (\d+)\/min at (\d+)/],
 ['childSymptoms',/^Reported temperature, breathing/],['muac',/^Demo nutrition rule: MUAC ([\d.]+)/],['weight',/^Weight did not increase/],['veryHighBp',/^Demo maternal danger rule:/],
 ['highBp',/^Demo maternal review rule:/],['climbingBp',/^Blood pressure rose ([+-]?[\d.]+) mmHg.*net ([+-]?[\d.]+)/],['anemiaDanger',/^Demo anemia rule: recorded hemoglobin ([\d.]+)/],
 ['anemiaReview',/^Demo anemia review flag: Hb ([\d.]+)/],['pregnancyDanger',/^PMSMA example:/],['swelling',/^Reported sudden swelling/],['postpartumDanger',/^Postpartum example: reported heavy bleeding/],
 ['postpartumInfection',/^Postpartum example: possible infection/],['postpartumReview',/^Postpartum example: fever/],['missing',/^Some baseline readings are missing/],
];
export function ruleLabel(wire:string,lang:Lang){
  for(const [code,pattern] of adapters){const matched=pattern.exec(wire);if(matched)return local(reasons[code],lang).replace(/\{(\d+)\}/g,(_m,index:string)=>matched[Number(index)+1]??'');}
  return local(['Recorded flag · ask a health worker','दर्ज चेतावनी · स्वास्थ्यकर्मी से पूछें'],lang);
}
const howToFollow:Record<PatientType,Pair>={CHILD:['Confirm the next growth and vaccination check.','बढ़त और टीके की अगली जाँच तय करें।'],PREGNANT_LADY:['Confirm the next pregnancy check.','गर्भ की अगली जाँच तय करें।'],MOTHER:['Confirm the next after-delivery check.','प्रसव के बाद की अगली जाँच तय करें।']};
export const routineNext=(role:PatientType,lang:Lang)=>local(howToFollow[role],lang);
const outlooks={
 growth:{name:['Growth and nutrition','बढ़त और पोषण'],reason:['Growth or the arm measurement needs a closer look.','बढ़त या बाँह की गोलाई की दोबारा जाँच चाहिए।'],action:['Ask a trained health worker to review growth and feeding.','बढ़त और खाने-पीने के बारे में प्रशिक्षित स्वास्थ्यकर्मी से पूछें।'],months:[1,6]},
 pregnancyAnemia:{name:['Low hemoglobin in pregnancy','गर्भ में कम हीमोग्लोबिन'],reason:['Recorded hemoglobin was low.','दर्ज हीमोग्लोबिन कम था।'],action:['Ask a clinician about diet, a repeat test and whether treatment is needed.','खाने-पीने, दोबारा जाँच और इलाज की ज़रूरत के बारे में डॉक्टर से पूछें।'],months:[0,6]},
 postpartumAnemia:{name:['Low hemoglobin after birth','प्रसव के बाद कम हीमोग्लोबिन'],reason:['Recorded hemoglobin was low.','दर्ज हीमोग्लोबिन कम था।'],action:['Ask a clinician about diet, a repeat test and whether treatment is needed.','खाने-पीने, दोबारा जाँच और इलाज की ज़रूरत के बारे में डॉक्टर से पूछें।'],months:[1,3]},
 pregnancyBp:{name:['Blood pressure in pregnancy','गर्भ में बीपी'],reason:['Recorded BP was high or rose over time.','दर्ज बीपी ज़्यादा था या समय के साथ बढ़ा।'],action:['Ask a clinician to repeat the BP check. Do not wait for a forecast date to seek help.','डॉक्टर से दोबारा बीपी जाँचने को कहें। मदद लेने के लिए आगे की तारीख का इंतज़ार न करें।'],months:[0,6]},
 postpartumBp:{name:['Blood pressure after birth','प्रसव के बाद बीपी'],reason:['Recorded BP was high or rose over time.','दर्ज बीपी ज़्यादा था या समय के साथ बढ़ा।'],action:['Ask a clinician to repeat the BP check. Do not wait for a forecast date to seek help.','डॉक्टर से दोबारा बीपी जाँचने को कहें। मदद लेने के लिए आगे की तारीख का इंतज़ार न करें।'],months:[0,6]},
 routine:{name:['Routine follow-up','समय पर अगली जाँच'],reason:['The example found no additional pattern. A health concern is still possible.','इस अभ्यास में कोई और बदलाव नहीं दिखा। फिर भी स्वास्थ्य की समस्या हो सकती है।'],action:['Keep the visit schedule agreed with your health worker.','स्वास्थ्यकर्मी से तय समय पर जाँच कराएँ।'],months:[1,6]},
} as const;
const forecastId:Record<string,keyof typeof outlooks>={
 'Growth faltering / undernutrition':'growth','Persistent anemia and pregnancy complications':'pregnancyAnemia','Persistent postpartum anemia':'postpartumAnemia',
 'Hypertensive complications of pregnancy':'pregnancyBp','Persistent elevated blood pressure':'postpartumBp','Routine follow-up':'routine',
};
export function outlook(wire:Forecast,lang:Lang){
  const key=forecastId[wire.condition];const row=key?outlooks[key]:undefined;
  const title=row?local(row.name,lang):local(['Ask your health worker','स्वास्थ्यकर्मी से पूछें'],lang);
  const reason=row?local(row.reason,lang):local(['See a trained health worker for guidance.','सलाह के लिए प्रशिक्षित स्वास्थ्यकर्मी से मिलें।'],lang);
  const action=row?local(row.action,lang):local(['Arrange a follow-up visit.','दोबारा जाँच का समय तय करें।'],lang);
  const timeline:Pair=wire.timeline==='Through delivery and the following months'?['Through and after delivery','प्रसव तक और उसके बाद']:wire.timeline==='Current visit through follow-up'?['Now through follow-up','अभी से अगली जाँच तक']:wire.timeline==='Next 1–3 months'?['Months 1–3','1–3 महीने']:wire.timeline==='Next 1–6 months'?['Months 1–6','1–6 महीने']:['Next 6 months','अगले 6 महीने'];
  return {key,title,reason,action,time:local(timeline,lang),interval:row&&wire.timeline!=='Current visit through follow-up'&&wire.timeline!=='Through delivery and the following months'?row.months:undefined};
}
const trendLabels:Record<string,Pair>={'Baseline only':['First readings','पहले माप'],'Deteriorating':['Needs a closer look','दोबारा देखना ज़रूरी'],'Improving':['Some readings improved','कुछ माप बेहतर हुए'],'Stable or mixed':['Steady or mixed','कुछ समान, कुछ बदले']};
export function trendLabel(wire:string,lang:Lang){return local(trendLabels[wire]??['Compare visits','जाँचों की तुलना करें'],lang);}
