import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { getAthleteHome } from "@/lib/athlete.functions";
import { getDeviceToken } from "@/lib/device";
import { formatTime } from "@/lib/format";
import { formatPoints } from "@/lib/scoring";
import { Screen, ScreenHeader, CoachLink } from "@/components/tap/shell";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const fetchHome = useServerFn(getAthleteHome);
  const [deviceToken, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(getDeviceToken());
    setReady(true);
  }, []);

  const { data } = useQuery({
    queryKey: ["athlete-home", deviceToken],
    queryFn: () => fetchHome({ data: { deviceToken: deviceToken! } }),
    enabled: Boolean(deviceToken),
    refetchInterval: 60000,
  });

  if (!ready) return null;

  if (!deviceToken || data?.signedIn === false) return <Landing />;
  if (!data) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader
          title={`Hi, ${data.me.firstName}`}
          subtitle={`${data.team?.name ?? ""}${data.group ? ` · ${data.group.name}` : ""}`}
          color={data.team?.team_color}
          right={
            <Link to="/history" className="label-caps text-xs text-muted-foreground underline">
              My log
            </Link>
          }
        />
      </div>

      <section className="card-hairline mt-6 rounded-xl p-5 text-center">
        <p className="label-caps text-muted-foreground">Attendance</p>
        <p className="data-num text-6xl leading-none">{data.stats.percent}%</p>
        <p className="data-num mt-2 text-sm text-muted-foreground">
          {data.stats.present} present · {data.stats.excused} excused · {data.stats.unexcused}{" "}
          unexcused
        </p>
        {data.team?.punctuality_enabled ? (
          <p className="data-num mt-3 text-2xl">{formatPoints(data.stats.points)} pts</p>
        ) : null}
        {data.rank ? (
          <p className="label-caps mt-1 text-muted-foreground">Rank #{data.rank} in your group</p>
        ) : null}
      </section>

      <section className="card-hairline mt-4 rounded-xl p-5">
        <h2 className="font-display text-2xl uppercase leading-none">Today</h2>
        {data.today.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing scheduled today.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data.today.map((session: any) => (
              <li key={session.id} className="flex items-center justify-between py-2">
                <span className="font-medium">
                  {session.name}
                  {session.is_cancelled ? " · cancelled" : ""}
                </span>
                <span className="data-num text-sm">{formatTime(session.scheduled_time)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.leaders.length ? (
        <section className="card-hairline mt-4 rounded-xl p-5">
          <h2 className="font-display text-2xl uppercase leading-none">Top of your group</h2>
          <ol className="mt-2 divide-y divide-border">
            {data.leaders.map((leader, index) => (
              <li key={leader.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="data-num mr-2 text-muted-foreground">{index + 1}</span>
                  {leader.name}
                </span>
                <span className="data-num">{formatPoints(leader.points)}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {data.groupStandings.length > 1 ? (
        <section className="card-hairline mt-4 rounded-xl p-5">
          <h2 className="font-display text-2xl uppercase leading-none">Group standings</h2>
          <ul className="mt-2 divide-y divide-border">
            {data.groupStandings.map((group) => (
              <li key={group.id} className="flex items-center justify-between py-2">
                <span>{group.name}</span>
                <span className="data-num">{group.percent}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 text-center">
        <CoachLink />
      </div>
    </Screen>
  );
}

function Landing() {
  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader title="TAP4Teams" subtitle="Team attendance, verified" />
      </div>
      <section className="mt-10 space-y-4">
        <h2 className="font-display text-4xl uppercase leading-none">
          Scan in at practice. That's it.
        </h2>
        <p className="text-muted-foreground">
          Athletes scan the team QR code at the field or gym. Coaches see who's there, who's late
          and who's missing — live, on the same screen.
        </p>
        <div className="card-hairline rounded-xl p-5">
          <h3 className="font-display text-2xl uppercase leading-none">Athletes</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Scan your team's signup QR code to get started. No password, no app store.
          </p>
        </div>
        <div className="card-hairline rounded-xl p-5">
          <h3 className="font-display text-2xl uppercase leading-none">Coaches</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your team, pin your locations, print the QR codes.
          </p>
          <div className="mt-3">
            <CoachLink />
          </div>
        </div>
      </section>
    </Screen>
  );
}
