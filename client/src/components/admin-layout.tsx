import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { LayoutDashboard, CreditCard, LogOut, Settings, Images, Bell, BellOff } from "lucide-react";
import { usePushNotification } from "@/hooks/use-push-notification";
import { useToast } from "@/hooks/use-toast";
import type { Booking } from "@shared/schema";
const logoImage = "/images/logo.png";

const MAIN_TABS = [
  { id: "dashboard", label: "Dashboard",  icon: LayoutDashboard, url: "/admin/dashboard" },
  { id: "payments",  label: "Pembayaran", icon: CreditCard,      url: "/admin/payments"  },
  { id: "services",  label: "Layanan",    icon: Settings,        url: "/admin/services"  },
  { id: "gallery",   label: "Galeri",     icon: Images,          url: "/admin/gallery"   },
] as const;

const PILL_BG     = "rgba(255,255,255,0.94)";
const PILL_SHADOW = "0 -1px 0 rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06), inset 0 0 0 0.5px rgba(0,0,0,0.07)";
const ACTIVE_BG   = "rgba(20,160,153,0.11)";
const ICON_ACTIVE = "hsl(187,80%,38%)";
const ICON_MUTED  = "rgba(90,105,110,0.55)";

function MobileTabBar({
  pendingCount,
  onLogout,
}: {
  pendingCount: number;
  onLogout: () => void;
}) {
  const [location, setLocation] = useLocation();
  const [bouncing, setBouncing] = useState<string | null>(null);
  const [logoutBouncing, setLogoutBouncing] = useState(false);

  const fire = (id: string, go: () => void) => {
    setBouncing(id);
    setTimeout(() => setBouncing(null), 480);
    go();
  };

  const fireLogout = () => {
    setLogoutBouncing(true);
    setTimeout(() => setLogoutBouncing(false), 480);
    onLogout();
  };

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 md:hidden flex items-end gap-2.5 px-3 mb-3"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* ── Main pill (4 tabs) ── */}
      <div
        className="flex-1 flex items-center rounded-[50px] px-1 py-1.5"
        style={{ background: PILL_BG, boxShadow: PILL_SHADOW }}
      >
        {MAIN_TABS.map((tab) => {
          const isActive = location === tab.url;
          const isBouncing = bouncing === tab.id;
          const badge = tab.id === "payments" ? pendingCount : 0;

          return (
            <button
              key={tab.id}
              data-testid={`mobile-tab-${tab.id}`}
              onClick={() => fire(tab.id, () => setLocation(tab.url))}
              className="flex-1 flex flex-col items-center justify-center relative select-none"
              style={{ WebkitTapHighlightColor: "transparent", minHeight: 50, touchAction: "manipulation" }}
            >
              {/* Active inner pill */}
              <div
                className="absolute inset-x-0.5 rounded-[44px] transition-all duration-200"
                style={{
                  top: -2,
                  bottom: -2,
                  background: isActive ? ACTIVE_BG : "transparent",
                  opacity: isActive ? 1 : 0,
                }}
              />

              {/* Icon */}
              <div
                className={`relative z-10 ${isBouncing ? "tab-icon-bounce" : ""}`}
                style={{ willChange: "transform" }}
              >
                <tab.icon
                  style={{
                    width: 22,
                    height: 22,
                    color: isActive ? ICON_ACTIVE : ICON_MUTED,
                    strokeWidth: isActive ? 2.3 : 1.7,
                    transition: "color 0.18s ease, stroke-width 0.18s ease",
                  }}
                />
                {badge > 0 && (
                  <span
                    className="absolute flex items-center justify-center rounded-full bg-[#FF3B30] text-white"
                    style={{
                      top: -5, right: -6,
                      minWidth: 15, height: 15,
                      fontSize: 8, fontWeight: 700,
                      lineHeight: 1, paddingInline: 2,
                    }}
                  >
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`relative z-10 leading-none mt-1 ${isBouncing ? "tab-label-in" : ""}`}
                style={{
                  fontSize: 9.5,
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: 0.15,
                  color: isActive ? ICON_ACTIVE : ICON_MUTED,
                  transition: "color 0.18s ease",
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Standalone logout circle ── */}
      <button
        data-testid="mobile-tab-logout"
        onClick={fireLogout}
        className="flex items-center justify-center rounded-full select-none shrink-0"
        style={{
          width: 54,
          height: 54,
          background: PILL_BG,
          boxShadow: PILL_SHADOW,
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
      >
        <div
          className={logoutBouncing ? "tab-icon-bounce" : ""}
          style={{ willChange: "transform" }}
        >
          <LogOut
            style={{
              width: 22,
              height: 22,
              color: ICON_MUTED,
              strokeWidth: 1.7,
            }}
          />
        </div>
      </button>
    </nav>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const { isSupported, isSubscribed, isLoading: pushLoading, permission, subscribe, unsubscribe } = usePushNotification();

  const handleBellClick = async () => {
    if (isSubscribed) {
      await unsubscribe();
      toast({ title: "Notifikasi dimatikan", description: "Kamu tidak akan menerima notifikasi booking baru." });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "Notifikasi aktif! 🔔", description: "Kamu akan menerima notifikasi setiap ada booking baru." });
      } else if (permission === "denied") {
        toast({ title: "Notifikasi diblokir", description: "Izinkan notifikasi di pengaturan browser kamu.", variant: "destructive" });
      }
    }
  };

  const { data: allBookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/admin/bookings/all"],
    queryFn: async () => {
      const res = await fetch("/api/admin/bookings/all", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 60000,
  });

  const pendingCount = allBookings.filter((b) => b.status === "pending").length;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-10 w-10 rounded-full" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const menuItems = [
    { title: "Dashboard",  url: "/admin/dashboard", icon: LayoutDashboard, badge: 0 },
    { title: "Pembayaran", url: "/admin/payments",  icon: CreditCard,      badge: pendingCount },
    { title: "Layanan",    url: "/admin/services",  icon: Settings,        badge: 0 },
    { title: "Galeri",     url: "/admin/gallery",   icon: Images,          badge: 0 },
  ];

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="Joel Music Studio" className="h-8 w-8 rounded-md object-contain" />
              <span className="font-semibold text-sm">Joel Music Admin</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => {
                    const isActive = location === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild data-active={isActive} data-testid={`nav-${item.title.toLowerCase()}`}>
                          <Link href={item.url}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{item.title}</span>
                            {item.badge > 0 && (
                              <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white" data-testid={`badge-pending-${item.title.toLowerCase()}`}>
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => logout()} data-testid="nav-logout">
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <SidebarTrigger className="md:flex hidden" data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2 ml-auto">
              {user && (
                <span className="text-sm text-muted-foreground" data-testid="text-admin-username">
                  {user.username}
                </span>
              )}
              {isSupported && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBellClick}
                      disabled={pushLoading || permission === "denied"}
                      data-testid="button-push-toggle"
                      className={isSubscribed ? "text-primary" : "text-muted-foreground"}
                    >
                      {isSubscribed ? <Bell className="h-4 w-4 fill-current" /> : <BellOff className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {permission === "denied"
                      ? "Notifikasi diblokir di browser"
                      : isSubscribed
                      ? "Notifikasi aktif — klik untuk matikan"
                      : "Aktifkan notifikasi booking"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 md:pb-6 pb-28">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar pendingCount={pendingCount} onLogout={logout} />
    </SidebarProvider>
  );
}
