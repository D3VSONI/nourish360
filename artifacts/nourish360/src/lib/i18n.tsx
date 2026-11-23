import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PatientType } from '@workspace/api-client-react';

export type Lang='en'|'hi';
export type Pair=readonly [string,string];
export const local=(pair:Pair,lang:Lang)=>pair[lang==='hi'?1:0];
const LangCtx=createContext<{lang:Lang;setLang:(lang:Lang)=>void;tr:(en:string,hi:string)=>string}|null>(null);
export function LangProvider({children}:{children:ReactNode}) {
  const [lang,setLang]=useState<Lang>(()=>{ try{return localStorage.getItem('n360.language')==='hi'?'hi':'en';}catch{return 'en';} });
  useEffect(()=>{ document.documentElement.lang=lang; try{localStorage.setItem('n360.language',lang);}catch{/* Language still applies in this tab. */} },[lang]);
  const tr=useCallback((en:string,hi:string)=>lang==='hi'?hi:en,[lang]);
  return <LangCtx.Provider value={{lang,setLang,tr}}>{children}</LangCtx.Provider>;
}
export function useLang(){const ctx=useContext(LangCtx);if(!ctx)throw new Error('Language provider missing');return ctx;}
const roles:Record<PatientType,Pair>={CHILD:['Child','बच्चा'],PREGNANT_LADY:['Pregnant woman','गर्भवती महिला'],MOTHER:['New mother','प्रसूता माँ']};
const places:Record<string,string>={Ganaur:'गन्नौर',Rai:'राई',Murthal:'मुरथल',Barota:'बरोटा',Kundli:'कुंडली',Kharkhoda:'खरखौदा',Sonipat:'सोनीपत',
  'PHC Ganaur':'प्राथमिक स्वास्थ्य केंद्र, गन्नौर','PHC Rai':'प्राथमिक स्वास्थ्य केंद्र, राई','CHC Murthal':'सामुदायिक स्वास्थ्य केंद्र, मुरथल','CHC Kharkhoda':'सामुदायिक स्वास्थ्य केंद्र, खरखौदा','District Civil Hospital, Sonipat':'जिला नागरिक अस्पताल, सोनीपत'};
export function roleLabel(role:PatientType,lang:Lang){return local(roles[role],lang);}
export function villageName(name:string,lang:Lang){return lang==='hi'?(places[name]??name):name;}
export function dateLabel(value:string,lang:Lang,full=false){return new Intl.DateTimeFormat(lang==='hi'?'hi-IN':'en-IN',{day:'numeric',month:'short',...(full?{year:'numeric',hour:'numeric',minute:'2-digit'}:{})}).format(new Date(value));}
export const saved:Pair=['Saved to Database','डेटाबेस में सहेजा गया'];
export const offlineSaved:Pair=['Saved Offline — Will Sync Automatically','फ़ोन पर सहेजा गया — नेटवर्क आते ही अपने-आप भेजा जाएगा'];
const known:Record<string,string>={
  'Some fields are missing or invalid. Check the demo form.':'कुछ जानकारी गलत है या भरी नहीं गई। फ़ॉर्म देखें।',
  'Sign in to a demo profile first.':'पहले डेमो प्रोफ़ाइल खोलें।',
  'Enter a sample reading or select a symptom.':'कोई माप भरें या लक्षण चुनें।',
  'A sample vital is outside the accepted entry range.':'एक माप तय सीमा से बाहर है। उसे जाँचें।',
  'Enter a valid assessment date.':'जाँच की सही तारीख भरें।',
  'The demo code expired. Request a new one.':'डेमो कोड की समय-सीमा खत्म हुई। नया कोड लें।',
  'The demo code or login details did not match.':'कोड या लॉगिन की जानकारी मेल नहीं खाती।',
  'Local storage is unavailable. Offline changes cannot be saved on this device.':'इस फ़ोन में ऑफ़लाइन जानकारी सहेजने की सुविधा नहीं है।',
  'Sign in to the same demo profile to sync its queued assessments.':'रुकी जाँचें भेजने के लिए उसी डेमो प्रोफ़ाइल में फिर लॉग इन करें।',
  'Sync did not finish. Offline assessments remain on this device.':'जाँचें अभी नहीं भेजी गईं। वे इस फ़ोन पर सहेजी हैं।',
  'This browser’s active profile changed in another tab. Sign in again here.':'दूसरे टैब में प्रोफ़ाइल बदल गई। यहाँ फिर लॉग इन करें।',
  'The assessment was not sent. Sign in to the correct profile and retry.':'जाँच नहीं भेजी गई। सही प्रोफ़ाइल में लॉग इन करके फिर कोशिश करें।',
  'This browser could not save the assessment offline. Keep the form open and reconnect.':'फ़ोन जाँच नहीं सहेज पाया। फ़ॉर्म खुला रखें और नेटवर्क जोड़ें।',
  'The assessment was saved on this device. Reopen its profile to sync it.':'जाँच फ़ोन पर है। भेजने के लिए वही प्रोफ़ाइल खोलें।',
  'Wait for the current save or sync to finish.':'पहली जाँच सहेजे या भेजे जाने तक रुकें।',
  'The active profile changed.':'खुली प्रोफ़ाइल बदल गई है।',
  'The signed-in profile changed. Reopen the correct demo record first.':'प्रोफ़ाइल बदल गई। पहले सही डेमो रिकॉर्ड खोलें।',
  'Simulation could not be saved. Retry the same drill, or call 108 in a real emergency.':'अभ्यास नहीं सहेजा गया। फिर कोशिश करें। असली इमरजेंसी में 108 मिलाएँ।',
  'Select a listed pickup village. Real GPS is not collected by this demo.':'सूची में से गाँव चुनें। डेमो आपकी GPS लोकेशन नहीं लेता।',
  'Select a demo emergency scenario.':'अभ्यास के लिए एक इमरजेंसी चुनें।',
  'The assessment could not be saved.':'जाँच नहीं सहेजी गई। फिर कोशिश करें।',
  'Explicit consent is required, including a guardian’s name and consent for a child.':'सहमति ज़रूरी है। बच्चे के लिए अभिभावक का नाम और सहमति भी चाहिए।',
  'Enter the child’s demo age, birth weight and last recorded weight.':'बच्चे की डेमो उम्र, जन्म का वज़न और पिछला वज़न भरें।',
  'Enter the demo age and select a blood group.':'डेमो उम्र भरें और खून का ग्रुप चुनें।',
  'Enter gestational weeks or last menstrual date, and pregnancy count.':'गर्भ के हफ़्ते और गर्भ की संख्या भरें।',
  'Enter time since delivery and delivery type.':'प्रसव के बाद के दिन भरें और प्रसव का तरीका चुनें।',
  'Use a fictional demo number, for example 0000000000. Do not enter a real phone number.':'0000000000 जैसा डेमो नंबर भरें। किसी का असली नंबर न डालें।',
  'Enter a demo alias and select a village.':'काल्पनिक नाम भरें और गाँव चुनें।',
  'Could not request a demo code. Try again once online.':'डेमो कोड नहीं मिला। नेटवर्क जोड़कर फिर कोशिश करें।',
  'Verification did not finish. Request a fresh demo code if needed.':'कोड की जाँच पूरी नहीं हुई। ज़रूरत हो तो नया कोड लें।',
  'Registration could not be confirmed. Reconnect and try again.':'प्रोफ़ाइल बनने की पुष्टि नहीं हुई। नेटवर्क जोड़कर फिर कोशिश करें।',
};
export function localizeMessage(value:string,lang:Lang,fallback='यह काम नहीं हुआ। फिर कोशिश करें।'){return !value||lang==='en'?value:(known[value]??fallback);}
