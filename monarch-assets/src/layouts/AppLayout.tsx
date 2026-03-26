import { useCallback, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_KEY = "monarch_sidebar_collapsed";

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-border bg-card/25 lg:flex lg:flex-col",
          collapsed ? "lg:w-[4.5rem]" : "lg:w-64"
        )}
      >
        <SidebarNav collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-xl lg:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" strokeWidth={1.75} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(100vw,280px)] border-r border-border p-0">
              <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link
            to="/"
            className="text-base font-semibold tracking-tight text-foreground"
            onClick={() => setMobileNavOpen(false)}
          >
            Monarch
          </Link>
        </header>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
