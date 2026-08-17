import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getAthleteSessions } from "@/lib/athlete.functions";
import { getDeviceToken } from "@/lib/device";
import { formatDate, formatTime } from "@/lib/format";
import { formatPoints } from "@/lib/scoring";
import { Screen, ScreenHeader, StatusPill } from "@/components/tap/shell";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My attendance log — TAP4Teams" },
      {
        name: "description",
        content: "Every session you scanned into, with times and punctuality points.",
      },
      { property: "og:title", content: "My attendance log — TAP4Teams" },
      { property: "og:description", content: "See your session-by-session attendance record." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const fetchSessions = useServerFn(getAthleteSessions);
  const [deviceToken, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(getDeviceToken());
    setReady(true);
  }, []);

  const { data } = useQuery({
    queryKey: ["athlete-sessions", deviceToken],
    queryFn: () => fetchSessions({ data: { deviceToken: deviceToken! } }),
    enabled: Boolean(deviceToken),
  });

  if (!ready) return null;

  if (!deviceToken || data?.signedIn === false) {
    return (
      <Screen>
        <div className="-mx-4">
          <ScreenHeader title="Not signed up" />
        </div>
        <p className="mt-6 text-muted-foreground">
          Scan your team's signup QR code to see your attendance log.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader
          title="My log"
          subtitle={data?.team?.name ?? ""}
          color={data?.team?.team_color}
          right={
            <Link to="/" className="label-caps text-xs text-muted-foreground underline">
              Back
            </Link>
          }
        />
      </div>
      <ul className="card-hairline mt-6 divide-y divide-border rounded-xl">
        {(data?.rows ?? []).map((row: any) => (
          <li key={row.id} className="flex items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.sessions?.name ?? "Session"}</p>
              <p className="data-num text-xs text-muted-foreground">
                {row.sessions ? formatDate(row.sessions.scheduled_time) : ""}
                {row.scan_time ? ` · in at ${formatTime(row.scan_time)}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusPill status={row.status} />
              {data?.team?.punctuality_enabled && row.punctuality_visible !== false ? (
                <span className="data-num text-xs">
                  {formatPoints(Number(row.punctuality_points ?? 0))}
                </span>
              ) : null}
            </div>
          </li>
        ))}
        {(data?.rows ?? []).length === 0 ? (
          <li className="p-6 text-center text-muted-foreground">No sessions logged yet.</li>
        ) : null}
      </ul>
    </Screen>
  );
}