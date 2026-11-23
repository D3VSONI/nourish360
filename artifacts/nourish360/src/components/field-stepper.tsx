import { useId } from 'react';
import { Minus,Plus } from 'lucide-react';
import { useLang } from '@/lib/i18n';

type Props={label:string;unit?:string;value:string;onChange:(value:string)=>void;step?:number;min:number;max:number;start?:number;testId?:string};
export function FieldStepper({label,unit,value,onChange,step=1,min,max,start=min,testId}:Props){
  const id=useId();const {tr}=useLang();
  function shift(direction:1|-1){const n=value===''?start:Number(value)+direction*step;if(Number.isFinite(n))onChange(String(Math.max(min,Math.min(max,Math.round(n*100)/100))));}
  return <div className="min-w-0 rounded-2xl border bg-white p-3">
    <label htmlFor={id} className="mb-2 block text-sm font-bold">{label}{unit&&<span className="ml-1 font-normal text-muted-foreground">({unit})</span>}</label>
    <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] gap-2">
      <button type="button" className="grid min-h-[52px] place-items-center rounded-xl border bg-background text-primary" aria-label={`${tr('Decrease','कम करें')} ${label}`} onClick={()=>shift(-1)}><Minus size={20}/></button>
      <input id={id} type="number" inputMode={step===1?'numeric':'decimal'} min={min} max={max} step={step} data-testid={testId} value={value} onChange={e=>onChange(e.target.value)} placeholder="—" className="min-h-[52px] w-full min-w-0 rounded-xl border bg-background px-1 text-center text-xl font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"/>
      <button type="button" className="grid min-h-[52px] place-items-center rounded-xl border bg-accent text-primary" aria-label={`${tr('Increase','बढ़ाएँ')} ${label}`} onClick={()=>shift(1)}><Plus size={20}/></button>
    </div>
  </div>;
}
