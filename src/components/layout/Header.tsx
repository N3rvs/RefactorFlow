import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";

export default function Header() {
  const apiUrl = process.env.NEXT_PUBLIC_DBREFACTOR_API || "Not Set";
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Badge variant="outline" className="text-xs">
            Development
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex text-xs">
            API: {apiUrl}
          </Badge>
        </div>
      </div>
    </header>
  );
}
