import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getLeaderboards } from "@/lib/coach.functions";
import { formatPoints } from "@/lib/scoring";

export function RanksTab() {
  const fetchBoards = useServerFn(getLeaderboards);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboards"],
    queryFn: () => fetchBoards({}),
  });

  if (isLoading) return <p className="py-10 text-center text-muted-foreground">Loading…</p>;

  const standings = [...(data?.groups ?? [])].sort((a, b) => b.percent - a.percent);

  return (
    <div className="space-y-6">
      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Group standings</h2>
        <ul className="mt-2 divide-y divide-border">
          {standings.map((group, index) => (
            <li key={group.id} className="flex items-center justify-between py-2">
              <span className="font-medium">
                <span className="data-num mr-2 text-muted-foreground">{index + 1}</span>
                {group.name}
              </span>
              <span className="data-num">{group.percent}%</span>
            </li>
          ))}
        </ul>
      </section>

      {(data?.groups ?? []).map((group) => (
        <section key={group.id} className="card-hairline rounded-xl p-4">
          <h2 className="font-display text-2xl uppercase leading-none">{group.name}</h2>
          <ol className="mt-2 divide-y divide-border">
            {group.rows.slice(0, 3).map((row, index) => (
              <li key={row.id} className="flex items-center justify-between py-2">
                <span className="font-medium">
                  <span className="data-num mr-2 text-muted-foreground">{index + 1}</span>
                  {row.name}
                </span>
                <span className="data-num">{formatPoints(row.points)}</span>
              </li>
            ))}
            {group.rows.length === 0 ? (
              <li className="py-2 text-sm text-muted-foreground">No athletes yet.</li>
            ) : null}
          </ol>
        </section>
      ))}
    </div>
  );
}