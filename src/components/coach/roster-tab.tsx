import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getRoster, getAthleteDetail } from "@/lib/coach.functions";
import { moveAthlete } from "@/lib/setup.functions";
import { formatDate, formatTime } from "@/lib/format";
import { formatPoints } from "@/lib/scoring";
import { StatusPill } from "@/components/tap/shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RosterTab() {
  const fetchRoster = useServerFn(getRoster);
  const fetchDetail = useServerFn(getAthleteDetail);
  const move = useServerFn(moveAthlete);
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["roster"], queryFn: () => fetchRoster({}) });
  const detail = useQuery({
    queryKey: ["athlete", openId],
    queryFn: () => fetchDetail({ data: { userId: openId! } }),
    enabled: Boolean(openId),
  });
  const moveMutation = useMutation({
    mutationFn: (input: { userId: string; groupId: string }) => move({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["roster"] }),
    onError: () => toast.error("Could not move that athlete."),
  });

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-3">
      <p className="label-caps text-muted-foreground">
        {data?.seasonName ?? "No active season"} · {data?.sessionCount ?? 0} sessions
      </p>
      <ul className="card-hairline divide-y divide-border rounded-xl">
        {(data?.athletes ?? []).map((athlete: any) => (
          <li key={athlete.id} className="flex items-center justify-between gap-3 p-3">
            <button
              type="button"
              className="min-w-0 text-left"
              onClick={() => setOpenId(athlete.id)}
            >
              <p className="truncate font-medium">
                {athlete.first_name} {athlete.last_name}
                {athlete.is_test_account ? " (test)" : ""}
                {athlete.sms_opt_in ? null : (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                    no SMS
                  </span>
                )}
              </p>
              <p className="data-num text-xs text-muted-foreground">
                {athlete.totals.percent}% · {formatPoints(athlete.totals.points)} pts
              </p>
            </button>
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={athlete.group_id ?? ""}
              onChange={(e) =>
                moveMutation.mutate({ userId: athlete.id, groupId: e.target.value })
              }
            >
              {(data?.groups ?? []).map((group: any) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(openId)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl uppercase">
              {detail.data?.athlete
                ? `${detail.data.athlete.first_name} ${detail.data.athlete.last_name}`
                : "Athlete"}
            </DialogTitle>
          </DialogHeader>
          <ul className="divide-y divide-border">
            {(detail.data?.rows ?? []).map((row: any) => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.sessions?.name ?? "Session"}</p>
                  <p className="data-num text-xs text-muted-foreground">
                    {row.sessions ? formatDate(row.sessions.scheduled_time) : ""}
                    {row.scan_time ? ` · ${formatTime(row.scan_time)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  {row.punctuality_visible !== false ? (
                    <span className="data-num text-xs">
                      {formatPoints(Number(row.punctuality_points ?? 0))}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}