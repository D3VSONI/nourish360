import { useEffect,useRef,useState,type FormEvent } from 'react';
import { Link,useLocation,useParams } from 'wouter';
import { ArrowLeft,Clipboard,Info,Loader2,MessageSquare,PhoneCall,Printer } from 'lucide-react';
import { useRegisterPatient,useSendOtp,useVerifyOtp,type Challenge,type ClinicalProfile,type PatientType,type RegistrationInputChannel } from '@workspace/api-client-react';
import { villages } from '@workspace/nourish-logic';
import { errorMessage,slugToRole,useApp } from '@/lib/store';
import { local,localizeMessage,roleLabel,saved,useLang,villageName } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { FieldStepper } from '@/components/field-stepper';
import { RoleArt } from '@/components/role-art';
import { Listen } from '@/components/listen';
import NotFound from '@/pages/not-found';

const PHONE_RE=/^(?:\+91)?00000\d{5}$/;
const PREVIEW_OTP=import.meta.env.DEV;
const OTP_LENGTH=PREVIEW_OTP?4:6;
const SAMPLE:Record<PatientType,{name:string;profile:ClinicalProfile;guardian?:string}>={
 CHILD:{name:'Kavya Sharma',guardian:'Sunita Sharma',profile:{dob_months:14,birth_weight_kg:2.6,last_weight_kg:8.4}},
 PREGNANT_LADY:{name:'Rekha Verma',profile:{age:24,gestational_weeks:26,blood_group:'B+',gravida:2}},
 MOTHER:{name:'Pooja Kumari',profile:{age:27,days_postpartum:9,delivery_type:'Normal',blood_group:'O+'}},
};
const RETURNING_PROFILES=[
 {id:'1',phone:'0000000001',label:'Kavya · Child'},
 {id:'2',phone:'0000000002',label:'Rekha · Pregnancy'},
 {id:'3',phone:'0000000003',label:'Pooja · Postpartum'},
  {id:'4',phone:'0000000004',label:'Aarav · Child'},
  {id:'5',phone:'0000000005',label:'Meera · Pregnancy'},
  {id:'6',phone:'0000000006',label:'Sana · Postpartum'},
  {id:'7',phone:'0000000007',label:'Nisha · Pregnancy'},
] as const;
const chip=(on:boolean)=>`tap w-full ${on?'border-primary bg-accent text-primary':'bg-white'}`;
function Channel({value,onChange}:{value:RegistrationInputChannel;onChange:(c:RegistrationInputChannel)=>void}){
  const {tr}=useLang();const help=PREVIEW_OTP?tr('Enter 1234 in this local preview. No message or call is sent.','इस लोकल पूर्वावलोकन में 1234 भरें। कोई मैसेज या कॉल नहीं जाती।'):tr('SMS and voice delivery are not configured.','SMS और फ़ोन कॉल से कोड भेजने की सुविधा सेट नहीं है।');return <fieldset><legend className="mb-2 font-bold">{tr('Verification method','कोड पाने का तरीका')}</legend><div className="grid grid-cols-2 gap-2">{(['sms','call'] as const).map(c=><button key={c} type="button" className={`${chip(value===c)} gap-2`} data-testid={`button-channel-${c}`} aria-pressed={value===c} onClick={()=>onChange(c)}>{c==='sms'?<MessageSquare size={18}/>:<PhoneCall size={18}/>} {c==='sms'?tr('SMS','मैसेज'):tr('Voice call','फ़ोन कॉल')}</button>)}</div><p className="mt-2 text-xs text-muted-foreground">{help}</p></fieldset>;
}
export default function Auth(){const {role:slug}=useParams<{role:string}>();const role=slugToRole(slug);return role?<Intake key={role} role={role}/>:<NotFound/>;}
function Intake({role}:{role:PatientType}){
 const {setRole,adoptRecord,online}=useApp();const {tr,lang}=useLang();const {toast}=useToast();const [,navigate]=useLocation();
 const register=useRegisterPatient(),sendOtp=useSendOtp(),verify=useVerifyOtp();
 const [tab,setTab]=useState<'new'|'login'>('new'),[channel,setChannel]=useState<RegistrationInputChannel>('sms');
 const sample=SAMPLE[role];const [name,setName]=useState(sample.name),[phone,setPhone]=useState('0000000000'),[village,setVillage]=useState(villages[0]!.name);
 const [guardian,setGuardian]=useState(sample.guardian??''),[guardianConsent,setGuardianConsent]=useState(false),[consent,setConsent]=useState(false);
 const [profile,setProfile]=useState<ClinicalProfile>(sample.profile),[hid,setHid]=useState(''),[loginPhone,setLoginPhone]=useState('');
 const [challenge,setChallenge]=useState<Challenge|null>(null),[code,setCode]=useState(''),[err,setErr]=useState('');
 const idInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{setRole(role);},[role,setRole]);
 const phoneOk=PHONE_RE.test(phone);const canRegister=name.trim().length>=2&&phoneOk&&!!village&&consent&&(role!=='CHILD'||(guardian.trim().length>=2&&guardianConsent));
 const registerNow=(e:FormEvent)=>{
  e.preventDefault();setErr('');if(!canRegister||!online)return;
  register.mutate({data:{patient_type:role,full_name:name.trim(),phone_number:phone,village,consent,channel,profile,...(role==='CHILD'?{guardian_name:guardian.trim(),guardian_consent:guardianConsent}:{})}},{onSuccess:c=>{setChallenge(c);setCode('');toast({title:local(saved,lang),description:PREVIEW_OTP?tr('Enter 1234 to open this profile.','यह प्रोफ़ाइल खोलने के लिए 1234 भरें।'):tr('Enter the verification code to open your profile.','अपनी प्रोफ़ाइल खोलने के लिए सत्यापन कोड भरें।')});},onError:e=>setErr(errorMessage(e,'Registration could not be confirmed. Reconnect and try again.'))});
 };
 const loginNow=(e:FormEvent)=>{e.preventDefault();setErr('');if(!online)return;sendOtp.mutate({data:{health_id:hid.trim().toUpperCase(),phone_number:loginPhone,channel}},{onSuccess:c=>{setChallenge(c);setCode('');},onError:e=>setErr(errorMessage(e,'Could not request a one-time code. Try again online.'))});};
 const verifyNow=(e:FormEvent)=>{e.preventDefault();if(!challenge||!online)return;setErr('');verify.mutate({data:{health_id:challenge.health_id,challenge_id:challenge.challenge_id,code}},{onSuccess:async rec=>{await adoptRecord(rec);navigate(rec.visits.length?'/results':'/assess');},onError:e=>setErr(errorMessage(e,'Verification did not finish. Request a new code if needed.'))});};
  const note=tr('This training preview uses sample records. It does not diagnose or contact emergency services.','इस प्रशिक्षण पूर्वावलोकन में नमूना रिकॉर्ड हैं। यह निदान नहीं करता और आपातकालीन सेवाओं से संपर्क नहीं करता।');
 const num=(key:keyof ClinicalProfile,value:string)=>setProfile(p=>({...p,[key]:value===''?undefined:Number(value)}));
 const fields=(key:keyof ClinicalProfile,label:string,min:number,max:number,step=1,testId=String(key))=><FieldStepper key={key} label={label} value={String(profile[key]??'')} onChange={v=>num(key,v)} {...{min,max,step}} testId={`input-${testId}`}/>;
 const copy=async()=>{if(!challenge)return;try{await navigator.clipboard.writeText(challenge.health_id);toast({title:tr('Health ID copied','हेल्थ आईडी कॉपी हुई')});}catch{idInput.current?.focus();idInput.current?.select();toast({title:tr('Health ID selected. Use your phone’s copy action.','हेल्थ आईडी चुनी गई है। फ़ोन के कॉपी विकल्प का इस्तेमाल करें।')});}};
 return <div className="mx-auto grid max-w-6xl items-start gap-5 px-4 py-6 md:grid-cols-[260px_minmax(0,1fr)]">
  <aside className="space-y-3"><Link href="/" className="tap gap-2" data-testid="link-back"><ArrowLeft size={18}/>{tr('All roles','सभी विकल्प')}</Link><div className="flex items-center gap-3 md:block"><RoleArt role={role} className="size-16 md:size-28"/><h1 className="font-display text-3xl font-bold">{roleLabel(role,lang)}</h1></div><div className="rounded-2xl border bg-accent/70 p-3 text-sm"><p className="flex gap-2"><Info size={18} className="shrink-0"/>{note}</p><div className="mt-2"><Listen text={note}/></div></div></aside>
  <section className="panel min-w-0 p-4 sm:p-6">
   {challenge?<form key="verify" onSubmit={verifyNow} className="space-y-4">
      <h2 className="text-2xl font-bold">{tr(`Enter the ${OTP_LENGTH}-digit code`,`${OTP_LENGTH} अंकों का कोड भरें`)}</h2>
      <div className="rounded-2xl border border-primary bg-accent p-4" id="print-health-id"><label htmlFor="copyable-health-id" className="block font-bold">{tr('Health ID','हेल्थ आईडी')}</label><input ref={idInput} id="copyable-health-id" readOnly value={challenge.health_id} className="w-full bg-transparent font-mono text-xl font-bold text-primary" data-testid="text-health-id"/><div className="mt-2 flex flex-wrap gap-2 print:hidden"><button type="button" onClick={()=>void copy()} className="tap gap-2"><Clipboard size={18}/>{tr('Copy ID','आईडी कॉपी करें')}</button><button type="button" onClick={()=>window.print()} className="tap gap-2"><Printer size={18}/>{tr('Print ID','आईडी प्रिंट करें')}</button></div></div>
      <label className="block font-bold">{tr('One-time code','एक बार का कोड')}<input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,OTP_LENGTH))} inputMode="numeric" autoComplete="off" maxLength={OTP_LENGTH} placeholder={'·'.repeat(OTP_LENGTH)} data-testid="input-otp" className="field mt-2 w-full text-center font-mono text-xl tracking-widest"/></label>
     {err&&<p role="alert" className="font-semibold text-red-800">{localizeMessage(err,lang)}</p>}
      <div className="flex flex-wrap gap-2"><button type="button" onClick={()=>{setChallenge(null);setErr('');}} className="tap" data-testid="button-otp-back">{tr('Back','वापस')}</button><button disabled={code.length!==OTP_LENGTH||verify.isPending||!online} className="tap tap-primary flex-1 gap-2" data-testid="button-verify">{verify.isPending&&<Loader2 size={18} className="animate-spin"/>}{tr('Verify and continue','कोड जाँचें और आगे बढ़ें')}</button></div>
   </form>:<>
    <div className="mb-5 grid grid-cols-2 gap-2" aria-label={tr('Profile options','प्रोफ़ाइल के विकल्प')}>{(['new','login'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>{setTab(t);setErr('');}} data-testid={`tab-${t}`} className={chip(tab===t)}>{t==='new'?tr('New registration','नई प्रोफ़ाइल'):tr('Returning user','पुरानी प्रोफ़ाइल')}</button>)}</div>
    {tab==='new'?<form key="registration" onSubmit={registerNow} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2"><label className="font-bold">{tr('Patient name','मरीज़ का नाम')}<input value={name} onChange={e=>setName(e.target.value)} maxLength={100} className="field mt-2 w-full" data-testid="input-name"/></label><label className="font-bold">{tr('Phone number','फ़ोन नंबर')}<input value={phone} onChange={e=>setPhone(e.target.value.trim())} inputMode="tel" maxLength={13} className="field mt-2 w-full font-mono" data-testid="input-phone"/>{!phoneOk&&<span className="block text-sm text-red-800">{tr('Use a reserved preview number such as 0000000000. No call or text is sent.','पूर्वावलोकन नंबर डालें, जैसे 0000000000। कोई कॉल या मैसेज नहीं भेजा जाएगा।')}</span>}</label></div>
      <fieldset><legend className="mb-2 font-bold">{tr('Village','गाँव')}</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{villages.map(v=><button key={v.name} type="button" className={chip(village===v.name)} aria-pressed={village===v.name} onClick={()=>setVillage(v.name)} data-testid={`button-intake-village-${v.name}`}>{villageName(v.name,lang)}</button>)}</div></fieldset>
      <div className="grid gap-3 sm:grid-cols-2">{role==='CHILD'?<>{fields('dob_months',tr('Age in months','उम्र (महीने)'),0,60,1,'dob-months')}{fields('birth_weight_kg',tr('Birth weight (kg)','जन्म का वज़न (किलो)'),.2,10,.1,'birth-weight')}{fields('last_weight_kg',tr('Last weight (kg)','पिछला वज़न (किलो)'),.2,50,.1,'last-weight')}</>:fields('age',tr('Age in years','उम्र (साल)'),12,65)}</div>
      {role==='PREGNANT_LADY'&&<div className="space-y-3"><label className="block rounded-2xl border bg-white p-4 font-bold">{tr('Pregnancy weeks','गर्भ के हफ़्ते')} <output htmlFor="pregnancy-weeks" className="ml-1 rounded-lg bg-accent px-2 text-primary">{profile.gestational_weeks??26}</output><input type="range" min={1} max={45} value={profile.gestational_weeks??26} onChange={e=>num('gestational_weeks',e.target.value)} id="pregnancy-weeks" data-testid="input-gest-weeks" className="block h-[52px] w-full accent-primary"/></label><fieldset><legend className="mb-2 font-bold">{tr('Pregnancy count','कितनी बार गर्भ रहा')}</legend><div className="grid grid-cols-3 gap-2">{[1,2,3].map(n=>{const active=n===3?(profile.gravida??1)>=3:profile.gravida===n;return <button key={n} type="button" className={chip(active)} aria-pressed={active} onClick={()=>num('gravida',String(n))}>{n===1?tr('First','पहली'):n===2?tr('Second','दूसरी'):tr('Third or later','तीसरी या अधिक')}</button>;})}</div></fieldset>{(profile.gravida??0)>=3&&fields('gravida',tr('Exact count','सही संख्या'),3,25,1,'gravida')}</div>}
      {role==='MOTHER'&&<>{fields('days_postpartum',tr('Days since birth','प्रसव के बाद के दिन'),0,730,1,'days-pp')}<fieldset><legend className="mb-2 font-bold">{tr('Delivery type','प्रसव का तरीका')}</legend><div className="grid grid-cols-2 gap-2">{(['Normal','C-Section'] as const).map(d=><button key={d} type="button" className={chip(profile.delivery_type===d)} aria-pressed={profile.delivery_type===d} onClick={()=>setProfile(p=>({...p,delivery_type:d}))}>{d==='Normal'?tr('Vaginal','सामान्य प्रसव'):tr('C-section','ऑपरेशन से प्रसव')}</button>)}</div></fieldset></>}
      {role!=='CHILD'&&<fieldset><legend className="mb-2 font-bold">{tr('Blood group','खून का ग्रुप')}</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{['A+','A-','B+','B-','O+','O-','AB+','AB-','Unknown'].map(g=><button key={g} type="button" className={chip(profile.blood_group===g)} aria-pressed={profile.blood_group===g} onClick={()=>setProfile(p=>({...p,blood_group:g}))}>{g==='Unknown'?tr('Not known','पता नहीं'):g}</button>)}</div></fieldset>}
      {role==='CHILD'&&<div className="rounded-2xl border p-3"><label className="font-bold">{tr('Guardian name','अभिभावक का नाम')}<input className="field mt-2 w-full" value={guardian} onChange={e=>setGuardian(e.target.value)} data-testid="input-guardian"/></label><label className="mt-2 flex min-h-[52px] items-center gap-3"><input type="checkbox" className="size-6 shrink-0 accent-primary" checked={guardianConsent} onChange={e=>setGuardianConsent(e.target.checked)} data-testid="checkbox-guardian-consent"/>{tr('I agree on behalf of the child.','मैं बच्चे की ओर से सहमति देता/देती हूँ।')}</label></div>}
      <label className="flex min-h-[52px] items-center gap-3 rounded-2xl border bg-accent p-3"><input type="checkbox" className="size-6 shrink-0 accent-primary" checked={consent} onChange={e=>setConsent(e.target.checked)} data-testid="checkbox-consent"/>{tr('I agree to save this information. I can download or delete it later.','मैं यह जानकारी सहेजने के लिए सहमत हूँ। बाद में इसे डाउनलोड या मिटा सकता/सकती हूँ।')}</label>
      <Channel value={channel} onChange={setChannel}/>{err&&<p role="alert" className="font-semibold text-red-800">{localizeMessage(err,lang)}</p>}
     <button disabled={!canRegister||register.isPending||!online} className="tap tap-primary w-full gap-2" data-testid="button-register">{register.isPending&&<Loader2 size={18} className="animate-spin"/>}{online?tr('Create patient profile','मरीज़ की प्रोफ़ाइल बनाएँ'):tr('Connect to create an ID','आईडी बनाने के लिए नेटवर्क जोड़ें')}</button>
    </form>:<form key="returning" onSubmit={loginNow} className="space-y-4">
      <p className="text-sm font-semibold">{tr('Choose a returning profile','पहले से बनी प्रोफ़ाइल चुनें')}</p>
      <div className="grid gap-2 sm:grid-cols-3">{RETURNING_PROFILES.map(profile=><button key={profile.id} type="button" aria-pressed={hid===profile.id} className={chip(hid===profile.id)} data-testid={`button-returning-profile-${profile.id}`} onClick={()=>{setHid(profile.id);setLoginPhone(profile.phone);setErr('');}}><span className="font-mono font-extrabold">ID {profile.id}</span><span className="block text-xs">{profile.label}</span></button>)}</div>
      <label className="block font-bold">{tr('Health ID','हेल्थ आईडी')}<input className="field mt-2 block w-full font-mono" inputMode="text" placeholder="1" value={hid} onChange={e=>setHid(e.target.value.trim())} data-testid="input-health-id"/></label>
      <label className="block font-bold">{tr('Phone number','फ़ोन नंबर')}<input className="field mt-2 block w-full font-mono" inputMode="tel" placeholder="0000000001" value={loginPhone} onChange={e=>setLoginPhone(e.target.value.trim())} data-testid="input-login-phone"/></label>
      <Channel value={channel} onChange={setChannel}/>{err&&<p role="alert" className="font-semibold text-red-800">{localizeMessage(err,lang)}</p>}
      <button disabled={!/^(?:[1-7]|N360-SNP-[A-Z0-9]{4,8})$/i.test(hid.trim())||!PHONE_RE.test(loginPhone)||sendOtp.isPending||!online} className="tap tap-primary w-full gap-2" data-testid="button-send-otp">{sendOtp.isPending&&<Loader2 size={18} className="animate-spin"/>}{online?tr('Send code','कोड लें'):tr('Connect for a new code','कोड लेने के लिए नेटवर्क जोड़ें')}</button>
    </form>}
   </>}
  </section>
 </div>;
}
