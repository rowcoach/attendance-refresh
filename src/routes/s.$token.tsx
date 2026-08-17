import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  readQrToken,
  requestAthleteCode,
  verifyAthleteCode,
  processScan,
} from "@/lib/athlete.functions";
import { getDeviceToken, setDeviceToken } from "@/lib/device";
import { formatTime } from "@/lib/format";
import { formatPoints } from "@/lib/scoring";
import { Screen, ScreenHeader } from "@/components/tap/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/s/$token")({
  head: () => ({
    meta: [
      { title: "Scan in — TAP4Teams" },
      { name: "description", content: "Scan the team QR code to check in to practice." },
      { property: "og:title", content: "Scan in — TAP4Teams" },
      { property: "og:description", content: "Check in to practice in one tap." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ScanPage,
});

type ScanResult = Awaited<ReturnType<typeof processScan>> | null;

function ScanPage() {
  const { token } = Route.useParams();
  const readToken = useServerFn(readQrToken);
  const scan = useServerFn(processScan);
  const navigate = useNavigate();

  const [result, setResult] = useState<ScanResult>(null);
  const [working, setWorking] = useState(true);

  const info = useQuery({
    queryKey: ["qr-token", token],
    queryFn: () => readToken({ data: { token } }),
  });

  const isSignup = info.data?.found && info.data.qr.type === "signup";
  const deviceToken = typeof window === "undefined" ? null : getDeviceToken();

  async function runScan(lat: number | null, lng: number | null) {
    setWorking(true);
    try {
      const outcome = await scan({ data: { token, deviceToken: deviceToken ?? "", lat, lng } });
      setResult(outcome);
    } catch {
      toast.error("Something went wrong with that scan.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    if (!info.data?.found) {
      if (info.isFetched) setWorking(false);
      return;
    }
    if (isSignup) {
      setWorking(false);
      return;
    }
    if (!deviceToken) {
      setWorking(false);
      return;
    }
    if (info.data.qr.gps_required && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => runScan(position.coords.latitude, position.coords.longitude),
        () => runScan(null, null),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      runScan(null, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.data?.found, isSignup, deviceToken]);

  if (info.isLoading || (working && !isSignup)) {
    return (
      <Screen>
        <div className="flex min-h-[70vh] items-center justify-center">
          <p className="font-display text-3xl uppercase">Checking you in…</p>
        </div>
      </Screen>
    );
  }

  if (!info.data?.found) {
    return (
      <Screen>
        <div className="-mx-4">
          <ScreenHeader title="Code not valid" />
        </div>
        <p className="mt-6 text-muted-foreground">
          This QR code has expired or doesn't belong to a team. Ask your coach for a new one.
        </p>
      </Screen>
    );
  }

  if (isSignup) return <SignupFlow token={token} info={info.data} />;

  if (!deviceToken) {
    return (
      <Screen>
        <div className="-mx-4">
          <ScreenHeader title="Not signed up yet" subtitle={info.data.team?.name ?? ""} />
        </div>
        <p className="mt-6 text-muted-foreground">
          Scan your team's signup QR code first so we know who you are.
        </p>
      </Screen>
    );
  }

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader
          title={headline(result)}
          subtitle={info.data.team?.name ?? ""}
          color={info.data.team?.team_color}
        />
      </div>
      <div className="animate-score mt-8 space-y-3 text-center">
        {result && "time" in result && result.time ? (
          <p className="data-num text-5xl">{formatTime(result.time)}</p>
        ) : null}
        {result && result.result === "checked_in" ? (
          <>
            <p className="label-caps text-muted-foreground">{result.sessionName}</p>
            {result.showPoints ? (
              <p className="data-num text-2xl">{formatPoints(result.points)} pts</p>
            ) : null}
          </>
        ) : null}
        {result && "message" in result && result.message ? (
          <p className="text-muted-foreground">{result.message}</p>
        ) : null}
        {result?.result === "too_far" ? (
          <p className="text-muted-foreground">
            You're not close enough to the location yet. Move closer and scan again.
          </p>
        ) : null}
        {result?.result === "needs_location" ? (
          <Button onClick={() => runScan(null, null)}>Try again with location on</Button>
        ) : null}
        <Button variant="outline" onClick={() => navigate({ to: "/" })}>
          Go to my page
        </Button>
      </div>
    </Screen>
  );
}

function headline(result: ScanResult) {
  switch (result?.result) {
    case "checked_in":
      return "You're in";
    case "already":
      return "Already in";
    case "adhoc":
      return "Scan logged";
    case "logged":
      return "Scan logged";
    case "too_far":
      return "Too far away";
    case "needs_location":
      return "Location needed";
    case "ignored":
      return "Wrong team";
    default:
      return "Scan";
  }
}

function SignupFlow({ token, info }: { token: string; info: any }) {
  const request = useServerFn(requestAthleteCode);
  const verify = useServerFn(verifyAthleteCode);
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "code">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [groupId, setGroupId] = useState<string | null>(info.groups?.[0]?.id ?? null);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await request({ data: { token, firstName, lastName, phone } });
      setStep("code");
      toast.success("We texted you a 6-digit code.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const outcome = await verify({
        data: { token, firstName, lastName, phone, code, groupId, smsOptIn },
      });
      setDeviceToken(outcome.deviceToken);
      toast.success(`Welcome, ${outcome.firstName}.`);
      navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That code didn't work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <div className="-mx-4">
        <ScreenHeader
          title="Join the team"
          subtitle={info.team?.name ?? ""}
          color={info.team?.team_color}
        />
      </div>
      {step === "details" ? (
        <form onSubmit={sendCode} className="card-hairline mt-6 space-y-4 rounded-xl p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                required
                maxLength={50}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                required
                maxLength={50}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Mobile number</Label>
            <Input
              type="tel"
              required
              maxLength={20}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs leading-snug text-muted-foreground">
              We'll text this number a one-time code to verify it's yours. Msg &amp; data rates may
              apply.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
              />
              <span>
                Also send me team announcements from my coach by SMS (practice changes, reminders).
                Message frequency varies. Msg &amp; data rates may apply. Reply STOP to cancel, HELP
                for help.
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              <a href="/privacy" className="underline">
                Privacy Policy
              </a>
              {" · "}
              <a href="/terms" className="underline">
                Terms
              </a>
            </p>
          </div>
          {info.groups?.length && !info.qr.group_id ? (
            <div className="space-y-1.5">
              <Label>Group</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={groupId ?? ""}
                onChange={(e) => setGroupId(e.target.value)}
              >
                {info.groups.map((group: any) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            Text me a code
          </Button>
        </form>
      ) : (
        <form onSubmit={confirm} className="card-hairline mt-6 space-y-4 rounded-xl p-5">
          <div className="space-y-1.5">
            <Label>6-digit code</Label>
            <Input
              required
              inputMode="numeric"
              maxLength={6}
              className="data-num text-center text-2xl"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
            Confirm
          </Button>
        </form>
      )}
    </Screen>
  );
}