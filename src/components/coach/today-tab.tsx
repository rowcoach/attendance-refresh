import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getDailyView, setAttendance } from "@/lib/coach.functions";
import { formatTime } from "@/lib/format";
import { formatPoints } from "@/lib/scoring";
import { StatusPill } from "@/components/tap/shell";
import { Button } from "@/components/ui/button";

type Group = { id: string; name: string };

export function TodayTab({ groups }: { groups: Group[] }) {
  const fetchDaily = useServerFn(getDailyView);
  const saveAttendance = useServerFn(setAttendance);
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["daily", groupId],
    queryFn: () => fetchDaily({ data: { groupId } }),
    refetchInterval: 20000,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      userId: string;
      sessionId: string;
      status: "present" | "excused" | "unexcused";
    }) => saveAttendance({ data: { ...input, points: null } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily"] }),
    onError: () => toast.error("Could not save that change."),
  });

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;
  const sessions = data?.sessions ?? [];
  if (!sessions.length) {
    return (
      <p className="card-hairline mt-4 rounded-xl p-6 text-center text-muted-foreground">
        No sessions scheduled today.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={groupId === null} onClick={() => setGroupId(null)} label="All" />
        {groups.map((group) => (
          <FilterChip
            key={group.id}
            active={groupId === group.id}
            onClick={() => setGroupId(group.id)}
            label={group.name}
          />
        ))}
      </div>

      {sessions.map((session: any) => {
        const rows = (data?.athletes ?? []).map((athlete: any) => {
          const record = (data?.attendance ?? []).find(
            (a: any) => a.session_id === session.id && a.user_id === athlete.id,
          );
          return { athlete, record };
        });
        const bucket = (status: string | null) =>
          rows.filter((row) => (row.record?.status ?? null) === status);

        return (
          <section key={session.id} className="card-hairline rounded-xl p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display text-2xl uppercase leading-none">{session.name}</h2>
              <span className="data-num text-sm">{formatTime(session.scheduled_time)}</span>
            </div>
            {session.location_reference ? (
              <p className="label-caps text-muted-foreground">{session.location_reference}</p>
            ) : null}

            <Bucket title="Here" rows={bucket("present")} mutate={mutation} sessionId={session.id} />
            <Bucket title="Not yet" rows={bucket(null)} mutate={mutation} sessionId={session.id} />
            <Bucket
              title="Excused"
              rows={bucket("excused")}
              mutate={mutation}
              sessionId={session.id}
            />
            <Bucket
              title="Unexcused"
              rows={bucket("unexcused")}
              mutate={mutation}
              sessionId={session.id}
            />
          </section>
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`label-caps rounded-full border px-3 py-1 text-xs ${
        active ? "border-foreground bg-foreground text-background" : "border-border text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Bucket({
  title,
  rows,
  mutate,
  sessionId,
}: {
  title: string;
  rows: { athlete: any; record: any }[];
  mutate: { mutate: (input: any) => void };
  sessionId: string;
}) {
  return (
    <div className="mt-4">
      <div className="label-caps flex items-center justify-between border-b border-border pb-1 text-muted-foreground">
        <span>{title}</span>
        <span className="data-num">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(({ athlete, record }) => (
            <li key={athlete.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {athlete.first_name} {athlete.last_name}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <StatusPill status={record?.status ?? "pending"} />
                  {record?.scan_time ? (
                    <span className="data-num text-xs text-muted-foreground">
                      {formatTime(record.scan_time)}
                    </span>
                  ) : null}
                  {record ? (
                    <span className="data-num text-xs">
                      {formatPoints(Number(record.punctuality_points ?? 0))}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                {(["present", "excused", "unexcused"] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={record?.status === status ? "default" : "outline"}
                    onClick={() => mutate.mutate({ userId: athlete.id, sessionId, status })}
                  >
                    {status[0]!.toUpperCase()}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}