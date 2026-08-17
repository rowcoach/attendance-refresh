import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getSessions,
  createSession,
  cancelSession,
  deleteSession,
  getSeasons,
  createSeason,
  activateSeason,
} from "@/lib/setup.functions";
import { formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Group = { id: string; name: string };

export function ScheduleTab({ groups }: { groups: Group[] }) {
  const listSessions = useServerFn(getSessions);
  const addSession = useServerFn(createSession);
  const cancel = useServerFn(cancelSession);
  const remove = useServerFn(deleteSession);
  const listSeasons = useServerFn(getSeasons);
  const addSeason = useServerFn(createSeason);
  const activate = useServerFn(activateSeason);
  const queryClient = useQueryClient();

  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + 60 * 86400000);

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => listSessions({ data: { from: from.toISOString(), to: to.toISOString() } }),
  });
  const seasons = useQuery({ queryKey: ["seasons"], queryFn: () => listSeasons({}) });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["seasons"] });
    queryClient.invalidateQueries({ queryKey: ["coach-context"] });
  };

  const create = useMutation({
    mutationFn: (input: any) => addSession({ data: input }),
    onSuccess: (result) => {
      toast.success(`${result.created} session(s) added.`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const seasonMutation = useMutation({
    mutationFn: (input: any) => addSeason({ data: input }),
    onSuccess: () => {
      toast.success("Season created.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [name, setName] = useState("Practice");
  const [locationReference, setLocationReference] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [expected, setExpected] = useState<string[]>([]);

  const [seasonName, setSeasonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <div className="space-y-6">
      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Seasons</h2>
        <ul className="mt-2 divide-y divide-border">
          {(seasons.data?.seasons ?? []).map((season: any) => (
            <li key={season.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{season.name}</p>
                <p className="data-num text-xs text-muted-foreground">
                  {season.start_date} → {season.end_date}
                </p>
              </div>
              {season.is_active ? (
                <span className="label-caps text-xs text-present">Active</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await activate({ data: { seasonId: season.id } });
                    refresh();
                  }}
                >
                  Activate
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Season name"
            maxLength={60}
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
          />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <Button
          className="mt-2"
          disabled={!seasonName || !startDate || !endDate}
          onClick={() => seasonMutation.mutate({ name: seasonName, startDate, endDate })}
        >
          Add season
        </Button>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">New session</h2>
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Location note</Label>
              <Input
                maxLength={80}
                value={locationReference}
                onChange={(e) => setLocationReference(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date and time</Label>
            <Input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() =>
                  setExpected((prev) =>
                    prev.includes(group.id)
                      ? prev.filter((id) => id !== group.id)
                      : [...prev, group.id],
                  )
                }
                className={`label-caps rounded-full border px-3 py-1 text-xs ${
                  expected.includes(group.id)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border"
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            Repeat weekly
          </label>
          {repeatWeekly ? (
            <Input
              type="date"
              value={repeatEndDate}
              onChange={(e) => setRepeatEndDate(e.target.value)}
            />
          ) : null}
          <Button
            disabled={!scheduledTime || !name}
            onClick={() =>
              create.mutate({
                name,
                locationReference,
                scheduledTime,
                expectedGroupIds: expected,
                repeatWeekly,
                repeatEndDate: repeatWeekly ? repeatEndDate || null : null,
              })
            }
          >
            Add to schedule
          </Button>
        </div>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Upcoming</h2>
        <ul className="mt-2 divide-y divide-border">
          {(sessions.data?.sessions ?? []).map((session: any) => (
            <li key={session.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {session.name}
                  {session.is_cancelled ? " · cancelled" : ""}
                </p>
                <p className="data-num text-xs text-muted-foreground">
                  {formatDate(session.scheduled_time)} · {formatTime(session.scheduled_time)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await cancel({
                      data: { sessionId: session.id, cancelled: !session.is_cancelled },
                    });
                    refresh();
                  }}
                >
                  {session.is_cancelled ? "Restore" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await remove({ data: { sessionId: session.id } });
                    refresh();
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}