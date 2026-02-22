import { Bird, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/AppSidebar";

export function MobileHeader() {
  return (
    <header className="lg:hidden flex items-center justify-between p-4 border-b border-border/40">
      <div className="flex items-center gap-2">
        <Bird className="w-5 h-5 text-primary" />
        <span className="font-display text-lg font-bold text-foreground">Maverick</span>
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <button className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <Menu className="w-5 h-5 text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 bg-sidebar border-border/40">
          <AppSidebar />
        </SheetContent>
      </Sheet>
    </header>
  );
}
