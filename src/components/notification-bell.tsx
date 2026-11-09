import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { listNotifications } from "@/lib/ops.functions";

/** Unread count, refreshed every minute; opens the notification center. */
export function NotificationBell() {
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications({ data: { limit: 100 } }), refetchInterval: 60000, staleTime: 30000 });
  const unread = (q.data ?? []).filter((n) => !n.read_at).length;
  return (
    <Link to="/notificacoes" aria-label={`Notificações${unread ? `: ${unread} novas` : ""}`} className="relative grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:text-primary">
      <Bell className="h-4 w-4" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">{unread > 99 ? "99+" : unread}</span>}
    </Link>
  );
}
