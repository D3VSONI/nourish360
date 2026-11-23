import type { PatientType,Vitals } from '@workspace/api-client-react';
import { local,type Lang,type Pair } from './i18n';

export const vitalLabels:Record<keyof Vitals,Pair>={resp_rate:['Breaths per minute','एक मिनट की साँसें'],temp_c:['Temperature','तापमान'],muac_cm:['Upper-arm size (MUAC)','बाँह की गोलाई (MUAC)'],weight_kg:['Weight','वज़न'],bp_sys:['Upper BP','ऊपर वाला बीपी'],bp_dia:['Lower BP','नीचे वाला बीपी'],hb:['Hemoglobin','हीमोग्लोबिन']};
export const units:Record<keyof Vitals,Pair>={resp_rate:['/min','/मिनट'],temp_c:['°C','°C'],muac_cm:['cm','सेमी'],weight_kg:['kg','किलो'],bp_sys:['mmHg','mmHg'],bp_dia:['mmHg','mmHg'],hb:['g/dL','g/dL']};
export const vitalRanges:Record<keyof Vitals,[number,number,number,number]>={resp_rate:[0,150,1,25],temp_c:[25,46,.1,37],muac_cm:[3,65,.1,13],weight_kg:[.2,320,.1,10],bp_sys:[35,300,1,120],bp_dia:[20,200,1,80],hb:[1,25,.1,11]};
export const vitalFields:Record<PatientType,(keyof Vitals)[]>={CHILD:['weight_kg','temp_c','resp_rate','muac_cm'],PREGNANT_LADY:['bp_sys','bp_dia','hb','weight_kg'],MOTHER:['bp_sys','bp_dia','hb','temp_c']};
const signs={
 breath:['Fast or difficult breathing','तेज़ साँस या साँस लेने में दिक्कत'],chest:['Chest indrawing','साँस लेते समय छाती अंदर धँसना'],fever:['High fever','तेज़ बुखार'],cold:['Cold body','शरीर ठंडा पड़ना'],feed:['Unable to drink or breastfeed','पीने या दूध पीने में असमर्थ'],vomit:['Vomiting everything','सब कुछ उलट देना'],drowsy:['Lethargic or unconscious','बहुत सुस्त या बेहोश'],navel:['Umbilical redness or pus','नाभि लाल है या मवाद है'],
 head:['Severe headache','तेज़ सिरदर्द'],vision:['Blurred vision or flashes','धुंधला दिखना या चमक दिखना'],swelling:['Sudden swelling of face or hands','चेहरे या हाथों में अचानक सूजन'],blood:['Vaginal bleeding','योनि से खून आना'],movement:['Reduced or absent fetal movement','बच्चे की हलचल कम या बंद'],pain:['Severe abdominal pain','पेट में बहुत दर्द'],
 pad:['Soaking more than one pad per hour','एक घंटे में एक से ज़्यादा पैड भीगना'],chills:['High fever or chills','तेज़ बुखार या कंपकंपी'],discharge:['Foul-smelling discharge','बदबू वाला स्राव'],faint:['Severe dizziness or fainting','बहुत चक्कर या बेहोशी'],breast:['Breast engorgement or pain','स्तन में सूजन या दर्द'],
} as const satisfies Record<string,Pair>;
export type SignKey=keyof typeof signs;
export function signText(key:SignKey,lang:Lang){return local(signs[key],lang);}
export const signKeys:Record<PatientType,SignKey[]>={CHILD:['breath','chest','fever','cold','feed','vomit','drowsy','navel'],PREGNANT_LADY:['head','vision','swelling','blood','movement','pain'],MOTHER:['pad','chills','discharge','faint','breast']};
export const symptomWire=(key:SignKey)=>signs[key][0];
const signAlias:Record<string,SignKey>={'Excessive vaginal blood loss':'blood','Severe dizziness / fainting':'faint'};
export function symptomText(wire:string,lang:Lang){const key=(Object.keys(signs) as SignKey[]).find(k=>signs[k][0]===wire)??signAlias[wire];return key?signText(key,lang):local(['Other recorded symptom','दूसरा दर्ज लक्षण'],lang);}
export const emergencySample:Record<PatientType,{vitals:Vitals;sign:SignKey}>={CHILD:{vitals:{weight_kg:9.3,temp_c:39.6,resp_rate:52},sign:'breath'},PREGNANT_LADY:{vitals:{bp_sys:163,bp_dia:112,hb:9.2},sign:'head'},MOTHER:{vitals:{bp_sys:94,bp_dia:58,hb:6.6,temp_c:37.6},sign:'pad'}};
export const muacApplicable=(age:number|undefined)=>age!==undefined&&age>=6&&age<60;
