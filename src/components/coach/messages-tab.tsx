import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { sendMegaphone, getMessageHistory } from "@/lib/coach.functions";
import { formatDate, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Group = { id: string; name: string };

export function MessagesTab({ groups }: { groups: Group[] }) {
  const send = useServerFn(sendMegaphone);
  const history = useServerFn(getMessageHistory);
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ["messages"], queryFn: () => history({}) });

  const mutation = useMutation({
    mutationFn: () =>
      send({
        data: {
          targetType: groupId ? "group" : "all",
          groupId,
          userIds: [],
          message: message.trim(),
        },
      }),
    onSuccess: (result) => {
      toast.success(`Sent to ${result.recipientCount} athlete(s).`);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <section className="card-hairline rounded-xl p-4">
        <h2 className="font-display text-2xl uppercase leading-none">Megaphone</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGroupId(null)}
            className={`label-caps rounded-full border px-3 py-1 text-xs ${
              groupId === null ? "border-foreground bg-foreground text-background" : "border-border"
            }`}
          >
            Whole team
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setGroupId(group.id)}
              className={`label-caps rounded-full border px-3 py-1 text-xs ${
                groupId === group.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
        <Textarea
          className="mt-3"
          rows={4}
          maxLength={600}
          placeholder="Practice moved to the north field."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="data-num text-xs text-muted-foreground">{message.length}/600</span>
          <Button disabled={!message.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
            Send text
          </Button>
        </div>
      </section>

      <section className="card-hairline rounded-xl p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl uppercase leading-none">History</h2>
          <span className="data-num text-xs text-muted-foreground">
            {data?.monthCount ?? 0} this month
          </span>
        </div>
        <ul className="mt-2 divide-y divide-border">
          {(data?.messages ?? []).map((row: any) => (
            <li key={row.id} className="py-2">
              <p className="text-sm">{row.message_text}</p>
              <p className="data-num text-xs text-muted-foreground">
                {formatDate(row.sent_at)} {formatTime(row.sent_at)} · {row.recipient_count}{" "}
                recipient(s)
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}