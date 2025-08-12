import { DatabaseZap } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2" aria-label="DB Refactor Toolkit Logo">
       <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
        <DatabaseZap className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="font-bold text-lg font-headline">DBRefactor</span>
    </div>
  );
}
