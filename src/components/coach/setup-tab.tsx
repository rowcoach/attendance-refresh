import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  getQrCodes,
  createQrCode,
  createLocation,
  deleteLocation,
  createGroup,
  deleteGroup,
  updateTeamSettings,
} from "@/lib/setup.functions";
import { QrImage } from "@/components/tap/qr-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Group = { id: string; name: string; is_default: boolean };

export function SetupTab({ team, groups }: { team: any; groups: Group[] }) {
  const fetchQr = useServerFn(getQrCodes);
  const addQr = useServerFn(createQrCode);
  const addLocation = useServerFn(createLocation);
  const removeLocation = useServerFn(deleteLocation);
  const addGroup = useServerFn(createGroup);
  const removeGroup = useServerFn(deleteGroup);
  const saveSettings = useServerFn(updateTeamSettings);
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["qr"], queryFn: () => fetchQr({}) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["qr"] });
    queryClient.invalidateQueries({ queryKey: ["coach-context"] });
  };

  const [groupName, setGroupName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState(false);

  const settings = useMutation({
    mutationFn: (input: any) => saveSettings({ data: input }),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  async function captureLocation() {
    if (!locationName.trim()) return;
    if (!navigator.geolocation) {
      toast.error("This device cannot share its location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await addLocation({
            data: {
              name: locationName.trim(),
              label: locationName.trim(),
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
          });
          setLocationName("");
          refresh();
          toast.success("Location pinned and QR code created.");
        } catch {
          toast.error("Could not save that location.");
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        toast.error("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  return (
    <div className="space-y-6">
      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Team settings</h2>
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="gps">Require GPS at locations</Label>
            <Switch
              id="gps"
              checked={Boolean(team?.gps_enabled)}
              onCheckedChange={(value) => settings.mutate({ gpsEnabled: value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="punct">Show punctuality points</Label>
            <Switch
              id="punct"
              checked={Boolean(team?.punctuality_enabled)}
              onCheckedChange={(value) => settings.mutate({ punctualityEnabled: value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Team color</Label>
            <Input
              type="color"
              className="h-10 w-20 p-1"
              defaultValue={team?.team_color ?? "#111111"}
              onBlur={(e) => settings.mutate({ teamColor: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Groups</h2>
        <ul className="mt-2 divide-y divide-border">
          {groups.map((group) => (
            <li key={group.id} className="flex items-center justify-between py-2">
              <span>{group.name}</span>
              {group.is_default ? (
                <span className="label-caps text-xs text-muted-foreground">Default</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await removeGroup({ data: { groupId: group.id } });
                    refresh();
                  }}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Varsity"
            maxLength={40}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <Button
            disabled={!groupName.trim()}
            onClick={async () => {
              try {
                await addGroup({ data: { name: groupName.trim() } });
                setGroupName("");
                refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not add group.");
              }
            }}
          >
            Add
          </Button>
        </div>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Locations</h2>
        <ul className="mt-2 divide-y divide-border">
          {(data?.locations ?? []).map((location: any) => (
            <li key={location.id} className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium">{location.name}</p>
                <p className="data-num text-xs text-muted-foreground">
                  {Number(location.latitude).toFixed(5)}, {Number(location.longitude).toFixed(5)}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  await removeLocation({ data: { locationId: location.id } });
                  refresh();
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Main gym"
            maxLength={60}
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
          <Button disabled={busy || !locationName.trim()} onClick={captureLocation}>
            Pin here
          </Button>
        </div>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase leading-none">QR codes</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              await addQr({ data: { type: "adhoc", groupId: null, expiresInHours: 24 } });
              refresh();
            }}
          >
            New ad-hoc code
          </Button>
        </div>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(data?.codes ?? []).map((code: any) => {
            const url = `${origin}/s/${code.token}`;
            const location = (data?.locations ?? []).find((l: any) => l.id === code.location_id);
            return (
              <div key={code.id} className="flex flex-col items-center gap-2 text-center">
                <QrImage value={url} />
                <p className="label-caps text-xs">
                  {code.type} {location ? `· ${location.name}` : ""}
                </p>
                <p className="data-num break-all text-[10px] text-muted-foreground">{url}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}