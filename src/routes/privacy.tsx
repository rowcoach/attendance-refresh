import { createFileRoute } from "@tanstack/react-router";
import { Screen, ScreenHeader } from "@/components/tap/shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — TAP4Teams" },
      {
        name: "description",
        content:
          "TAP4Teams privacy policy: how we collect, use, and protect team attendance and SMS data.",
      },
      { property: "og:title", content: "Privacy Policy — TAP4Teams" },
      {
        property: "og:description",
        content:
          "TAP4Teams privacy policy: how we collect, use, and protect team attendance and SMS data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader title="Privacy Policy" />
      </div>
      <article className="card-hairline mt-6 space-y-4 rounded-xl p-5 text-sm leading-relaxed text-foreground">
        <p className="text-muted-foreground">Effective August 2026</p>
        <p>
          TAP4Teams is a team attendance application. We collect the information athletes and coaches
          provide at registration (name, mobile number, team and group membership) and attendance
          records created when athletes scan team QR codes (timestamp, location check-in).
        </p>
        <p>
          This information is used only to operate the app: verifying identity, recording
          attendance, and delivering team messages sent by the team's coach.
        </p>
        <p>
          We use SMS to send one-time verification codes and coach announcements. Message frequency
          varies; message and data rates may apply. Reply STOP to stop receiving messages or HELP for
          help.
        </p>
        <p>
          No mobile information will be shared with third parties or affiliates for marketing or
          promotional purposes. Text messaging originator opt-in data and consent are not shared with
          any third parties. We do not sell personal information.
        </p>
        <p>
          Data is stored securely and retained while the team account is active. Coaches can
          deactivate an athlete at any time, and athletes may request removal of their information by
          contacting their coach or support@tapforteams.com.
        </p>
      </article>
    </Screen>
  );
}
