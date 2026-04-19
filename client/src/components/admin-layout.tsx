import { useEffect } from "react";
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
    { title: "Dashboard", url: "/admin/dashboard", icon: LayoutDashboard, badge: 0 },
    { title: "Pembayaran", url: "/admin/payments", icon: CreditCard, badge: pendingCount },
    { title: "Layanan", url: "/admin/services", icon: Settings, badge: 0 },
    { title: "Galeri", url: "/admin/gallery", icon: Images, badge: 0 },
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
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
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
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
