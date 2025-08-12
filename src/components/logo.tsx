import { DatabaseZap } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center" aria-label="DB Refactor Toolkit Logo">
       <div className="w-8 h-8 mr-2 bg-blue-600 rounded-md flex items-center justify-center">
        <DatabaseZap className="h-5 w-5 text-white" />
      </div>
      <span className="font-bold text-lg font-headline">DBRefactor</span>
    </div>
  );
}
