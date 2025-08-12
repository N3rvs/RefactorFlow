import { DatabaseZap } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center" aria-label="DB Refactor Toolkit Logo">
      <DatabaseZap className="h-6 w-6 mr-2 text-primary" />
      <span className="font-bold text-lg font-headline">DB Refactor Toolkit</span>
    </div>
  );
}
