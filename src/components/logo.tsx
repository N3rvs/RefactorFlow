
import { DatabaseZap } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="DRefactor Logo">
       <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
        <span className="font-bold text-xl text-background">D</span>
      </div>
      <span className="font-bold text-lg font-headline">DRefactor</span>
    </div>
  );
}
