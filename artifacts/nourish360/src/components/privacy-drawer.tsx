import { useState } from 'react';
import { useLocation } from 'wouter';
import { Download,Loader2,LogOut,ShieldCheck,Trash2,X } from 'lucide-react';
import { exportRecord,useEndSession,useEraseRecord } from '@workspace/api-client-react';
import { Drawer,DrawerContent,DrawerDescription,DrawerHeader,DrawerTitle } from '@/components/ui/drawer';
import { useApp } from '@/lib/store';
import { useLang } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

export function PrivacyDrawer(){
  const {privacyOpen,setPrivacyOpen,record,queue,forgetLocal,online}=useApp();const {tr}=useLang();const [,navigate]=useLocation();const {toast}=useToast();
  const erase=useEraseRecord(),end=useEndSession();const [exporting,setExporting]=useState(false),[confirm,setConfirm]=useState('');const hid=record?.patient.health_id;
  const dismiss=()=>{setPrivacyOpen(false);setConfirm('');};
  const download=async()=>{
    if(!hid||!online)return;setExporting(true);
    try{const data=await exportRecord(hid,{headers:{'x-nourish-record':hid}});const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${hid}-export.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch{toast({title:tr('Download failed. Try again online.','डाउनलोड नहीं हुआ। नेटवर्क जोड़कर फिर कोशिश करें।')});}finally{setExporting(false);}
  };
  const doErase=()=>{
    if(!hid||!online||confirm!=='ERASE')return;
    erase.mutate({healthId:hid},{onSuccess:async()=>{
      const cleared=await forgetLocal(true).then(()=>true,()=>false);dismiss();navigate('/');toast({title:tr('Demo record deleted','डेमो रिकॉर्ड मिट गया'),description:cleared?undefined:tr('Clear this site’s data to remove any local copy.','फ़ोन की कॉपी हटाने के लिए इस साइट का डेटा साफ़ करें।')});
    },onError:()=>toast({title:tr('Could not confirm deletion. Check your connection.','मिटाने की पुष्टि नहीं हुई। नेटवर्क जाँचें।')})});
  };
  const signOut=()=>{if(!online)return;end.mutate(undefined,{onSuccess:async()=>{const cleared=await forgetLocal().then(()=>true,()=>false);dismiss();navigate('/');if(!cleared)toast({title:tr('Signed out. Clear site data to remove any local copy.','लॉग आउट हो गया। फ़ोन की कॉपी हटाने के लिए साइट डेटा साफ़ करें।')});},onError:()=>toast({title:tr('Could not sign out. Reconnect and retry.','लॉग आउट नहीं हुआ। नेटवर्क जोड़कर फिर कोशिश करें।')})});};
  return <Drawer open={privacyOpen} onOpenChange={open=>open?setPrivacyOpen(true):dismiss()}>
    <DrawerContent className="max-h-[90dvh] overflow-y-auto bg-background"><div className="mx-auto w-full max-w-xl px-4 pb-6">
      <DrawerHeader className="px-0 text-left"><div className="flex items-center justify-between gap-3"><DrawerTitle className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="shrink-0 text-primary"/>{tr('Your data and consent','आपकी जानकारी और सहमति')}</DrawerTitle><button type="button" onClick={dismiss} aria-label={tr('Close','बंद करें')} className="tap size-[52px] p-0"><X size={21}/></button></div><DrawerDescription>{tr('DPDP Act 2023 controls for this synthetic demo.','डेमो जानकारी के लिए डेटा सुरक्षा कानून (DPDP 2023) के विकल्प।')}</DrawerDescription></DrawerHeader>
      {!record?<p className="panel">{tr('No profile is open. Sign in to manage a demo record.','कोई प्रोफ़ाइल नहीं खुली है। डेमो रिकॉर्ड के लिए लॉग इन करें।')}</p>:<div className="space-y-3">
        <div className="panel space-y-1 p-3 text-sm" data-testid="text-privacy-summary"><p className="font-mono font-bold">{hid} · {record.patient.masked_phone}</p><p className="font-bold text-primary">{online?tr('Demo consent: given','डेमो सहमति: दी गई'):tr('Demo consent: last verified','डेमो सहमति: पिछली जाँच के अनुसार')}</p>{record.patient.patient_type==='CHILD'&&<p>{tr('Guardian consent: recorded','अभिभावक की सहमति: दर्ज है')}</p>}<p>{record.visits.length} {tr('visits','जाँचें')} · {queue.length} {tr('waiting to sync','भेजनी बाकी')}</p></div>
        {!online&&<p className="zone zone-amber p-3 text-sm">{tr('Connect to export, delete or sign out.','डाउनलोड, मिटाने या लॉग आउट के लिए नेटवर्क जोड़ें।')}</p>}
        <button type="button" onClick={()=>void download()} disabled={exporting||!online} className="tap tap-primary w-full justify-start gap-3" data-testid="button-export">{exporting?<Loader2 size={20} className="animate-spin"/>:<Download size={20}/>} {tr('Download my health JSON','मेरी स्वास्थ्य जानकारी डाउनलोड करें (JSON)')}</button>
        <button type="button" onClick={signOut} disabled={end.isPending||!online} className="tap w-full justify-start gap-3" data-testid="button-sign-out"><LogOut size={20}/> {tr('Sign out','लॉग आउट करें')}</button>
        {queue.length>0&&<p className="text-sm text-muted-foreground">{tr('Pending visits stay here until this profile signs in again.','बाकी जाँचें इस फ़ोन में रहेंगी। इसी प्रोफ़ाइल में फिर लॉग इन करने पर भेजी जाएँगी।')}</p>}
        <div className="zone zone-red p-3"><p className="flex items-center gap-2 font-bold"><Trash2 size={19}/> {tr('Delete my data','मेरी जानकारी मिटाएँ')}</p><p className="mt-1 text-sm">{tr('This permanently removes the demo profile, visits, pending visits and its practice bookings. Type ERASE to confirm.','इससे डेमो प्रोफ़ाइल, जाँचें, बाकी जाँचें और अभ्यास बुकिंग हमेशा के लिए मिटेंगी। पुष्टि के लिए ERASE लिखें।')}</p><div className="mt-3 flex gap-2"><input value={confirm} onChange={e=>setConfirm(e.target.value.toUpperCase())} placeholder="ERASE" aria-label={tr('Type ERASE to confirm','पुष्टि के लिए ERASE लिखें')} data-testid="input-erase-confirm" className="field min-w-0 flex-1 font-mono"/><button type="button" onClick={doErase} disabled={confirm!=='ERASE'||erase.isPending||!online} className="tap tap-red" data-testid="button-erase">{erase.isPending?tr('Deleting…','मिटा रहे हैं…'):tr('Delete','मिटाएँ')}</button></div></div>
      </div>}
    </div></DrawerContent>
  </Drawer>;
}
