import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { getCoachContext, createTeam } from "@/lib/coach.functions";
import { SPORTS } from "@/lib/sports";
import { supabase } from "@/integrations/supabase/client";
import { Screen, ScreenHeader } from "@/components/tap/shell";
import { TodayTab } from "@/components/coach/today-tab";
import { RosterTab } from "@/components/coach/roster-tab";
import { ScheduleTab } from "@/components/coach/schedule-tab";
import { RanksTab } from "@/components/coach/ranks-tab";
import { MessagesTab } from "@/components/coach/messages-tab";
import { SetupTab } from "@/components/coach/setup-tab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Coach dashboard — TAP4Teams" },
      {
        name: "description",
        content: "Live attendance, roster, schedule, rankings and team texts in one place.",
      },
      { property: "og:title", content: "Coach dashboard — TAP4Teams" },
      { property: "og:description", content: "Run practice attendance in real time." },
    ],
  }),
  component: CoachDashboard,
});

const TABS = ["Today", "Roster", "Schedule", "Ranks", "Texts", "Setup"] as const;

function CoachDashboard() {
  const fetchContext = useServerFn(getCoachContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Today");

  const { data, isLoading } = useQuery({
    queryKey: ["coach-context"],
    queryFn: () => fetchContext({}),
  });

  if (isLoading) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!data?.hasTeam) return <CreateTeamForm />;

  const groups = (data.groups ?? []) as any[];

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader
          title={data.team?.name ?? "Team"}
          subtitle={data.season?.name ?? "No active season"}
          color={data.team?.team_color}
          right={
            <button
              type="button"
              className="label-caps text-xs text-muted-foreground underline"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
            >
              Sign out
            </button>
          }
        />
      </div>

      <nav className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto border-b border-border bg-background px-4 py-2">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`label-caps whitespace-nowrap rounded-full px-3 py-1 text-xs ${
              tab === item ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            {item}
          </button>
        ))}
      </nav>

      <main className="mt-4">
        {tab === "Today" ? <TodayTab groups={groups} /> : null}
        {tab === "Roster" ? <RosterTab /> : null}
        {tab === "Schedule" ? <ScheduleTab groups={groups} /> : null}
        {tab === "Ranks" ? <RanksTab /> : null}
        {tab === "Texts" ? <MessagesTab groups={groups} /> : null}
        {tab === "Setup" ? <SetupTab team={data.team} groups={groups} /> : null}
      </main>
    </Screen>
  );
}

function CreateTeamForm() {
  const create = useServerFn(createTeam);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    phone: string;
    teamName: string;
    sport: string;
    teamColor: string;
  }>({
    firstName: "",
    lastName: "",
    phone: "",
    teamName: "",
    sport: SPORTS[0]!,
    teamColor: "#111111",
  });
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await create({ data: form });
      await queryClient.invalidateQueries({ queryKey: ["coach-context"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the team.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader title="Set up your team" subtitle="Takes about a minute" />
      </div>
      <form onSubmit={submit} className="card-hairline mt-6 space-y-4 rounded-xl p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input
              required
              maxLength={50}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input
              required
              maxLength={50}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Mobile number</Label>
          <Input
            type="tel"
            maxLength={20}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Team name</Label>
          <Input
            required
            maxLength={80}
            value={form.teamName}
            onChange={(e) => setForm({ ...form, teamName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Sport</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.sport}
            onChange={(e) => setForm({ ...form, sport: e.target.value })}
          >
            {SPORTS.map((sport) => (
              <option key={sport} value={sport}>
                {sport}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Team color</Label>
          <Input
            type="color"
            className="h-10 w-20 p-1"
            value={form.teamColor}
            onChange={(e) => setForm({ ...form, teamColor: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          Create team
        </Button>
      </form>
    </Screen>
  );
}