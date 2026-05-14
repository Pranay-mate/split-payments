import { describe, expect, it } from "vitest";
import { entityKey } from "./queue";
import type { QueuedMutation, QueuedPath } from "./db";

function make(
  path: QueuedPath,
  input: Record<string, unknown>,
  clientEventId = "ce-fallback",
): QueuedMutation {
  return {
    clientEventId,
    path,
    input,
    createdAt: Date.now(),
    attempts: 0,
  };
}

describe("entityKey", () => {
  it("buckets all expense paths under the same entity key when they share an id", () => {
    const id = "00000000-0000-0000-0000-0000000000aa";
    const k1 = entityKey(make("expenses.create", { clientEventId: id }, id));
    const k2 = entityKey(make("expenses.update", { id }));
    const k3 = entityKey(make("expenses.delete", { id }));
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);
    expect(k1.startsWith("expense:")).toBe(true);
  });

  it("buckets all personal paths under the same entity key when they share an id", () => {
    const id = "00000000-0000-0000-0000-0000000000bb";
    const k1 = entityKey(make("personal.create", { clientEventId: id }, id));
    const k2 = entityKey(make("personal.update", { id }));
    const k3 = entityKey(make("personal.delete", { id }));
    expect(k1).toBe(k2);
    expect(k2).toBe(k3);
    expect(k1.startsWith("personal-entry:")).toBe(true);
  });

  it("does NOT collide entities across domains even if the ids happen to match", () => {
    const id = "00000000-0000-0000-0000-0000000000cc";
    expect(entityKey(make("expenses.create", { clientEventId: id }, id))).not.toBe(
      entityKey(make("personal.create", { clientEventId: id }, id)),
    );
    expect(
      entityKey(make("settlements.create", { clientEventId: id }, id)),
    ).not.toBe(entityKey(make("comments.add", { clientEventId: id }, id)));
  });

  it("distinct entities of the same domain get distinct keys (so they can run in parallel)", () => {
    const k1 = entityKey(
      make(
        "personal.create",
        { clientEventId: "11111111-1111-1111-1111-111111111111" },
        "11111111-1111-1111-1111-111111111111",
      ),
    );
    const k2 = entityKey(
      make(
        "personal.create",
        { clientEventId: "22222222-2222-2222-2222-222222222222" },
        "22222222-2222-2222-2222-222222222222",
      ),
    );
    expect(k1).not.toBe(k2);
  });

  it("falls back to the queue row's clientEventId when input has neither id nor clientEventId", () => {
    const k = entityKey(make("personal.delete", {}, "row-level-event-id"));
    expect(k).toBe("personal-entry:row-level-event-id");
  });

  it("prefers input.id over input.clientEventId for updates/deletes", () => {
    const k = entityKey(
      make("personal.update", { id: "real-id", clientEventId: "queued-id" }),
    );
    expect(k).toBe("personal-entry:real-id");
  });
});
