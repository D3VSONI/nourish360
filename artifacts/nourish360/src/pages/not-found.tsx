import { TriangleAlert } from 'lucide-react';
import { Link } from 'wouter';
import { useLang } from '@/lib/i18n';

export default function NotFound(){
  const {tr}=useLang();
  return <section className="mx-auto max-w-md px-4 py-14"><div className="panel"><h1 className="flex items-center gap-2 text-2xl font-bold"><TriangleAlert className="shrink-0 text-amber-700"/>{tr('Page not found','पेज नहीं मिला')}</h1><Link href="/" className="tap tap-primary mt-4">{tr('Back to home','मुख्य पेज पर जाएँ')}</Link></div></section>;
}
