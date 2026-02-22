import { Bird, Scan, FileText, Settings } from "lucide-react";
import { navItems, userProfile } from "@/data/mockData";
import { NavLink } from "@/components/NavLink";

const iconMap: Record<string, React.ElementType> = {
  Scan, FileText, Settings,
};

export function AppSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-border/40 bg-sidebar p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
          <Bird className="w-5 h-5 text-primary" />
        </div>
        <span className="font-display text-lg font-bold text-foreground tracking-tight">Maverick</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          return (
            <NavLink
              key={item.title}
              to={item.url}
              end
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              activeClassName="bg-primary/10 text-primary font-medium"
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span>{item.title}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-border/40 pt-4 mt-4">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
            {userProfile.avatar}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{userProfile.name}</p>
            <p className="text-xs text-muted-foreground">{userProfile.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
