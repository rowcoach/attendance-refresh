import { createFileRoute } from "@tanstack/react-router";
import { Screen, ScreenHeader } from "@/components/tap/shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — TAP4Teams" },
      {
        name: "description",
        content:
          "TAP4Teams terms of service for coaches and athletes using QR code attendance tracking.",
      },
      { property: "og:title", content: "Terms of Service — TAP4Teams" },
      {
        property: "og:description",
        content:
          "TAP4Teams terms of service for coaches and athletes using QR code attendance tracking.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader title="Terms of Service" />
      </div>
      <article className="card-hairline mt-6 space-y-4 rounded-xl p-5 text-sm leading-relaxed text-foreground">
        <p className="text-muted-foreground">Effective August 2026</p>
        <p>
          TAP4Teams provides attendance tracking for sports teams via QR code check-in. By
          registering, you agree to provide accurate information and to use the app only for
          legitimate team attendance purposes.
        </p>
        <p>
          Athletes agree to receive SMS verification codes and team messages; reply STOP at any time
          to opt out (note: opting out of SMS prevents receiving team announcements and
          re-verification codes).
        </p>
        <p>
          The service is provided "as is" without warranty. Attendance records are maintained by each
          team's coaches, who may correct or override records.
        </p>
        <p>TAP4Teams may suspend accounts used abusively.</p>
        <p>Questions: support@tapforteams.com.</p>
      </article>
    </Screen>
  );
}
