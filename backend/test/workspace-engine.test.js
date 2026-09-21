const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../modules/workspace/engine");
const now = new Date("2026-09-21T06:00:00Z");
const member = (_id, extra = {}) => ({
  _id,
  name: _id,
  isActive: true,
  profile: "casual",
  joinedOn: "2026-08-01",
  ...extra,
});
const task = (_id, extra = {}) => ({
  _id,
  status: "pending",
  type: "customer-confirmation",
  priority: "medium",
  createdAt: now,
  dueAt: new Date(+now + 3600000),
  ...extra,
});
test("vendor coordination stays together and groups divide fairly", () => {
  const tasks = Array.from({ length: 12 }, (_, i) =>
    task(String(i), {
      type: "vendor-call",
      vendorKey: `v${Math.floor(i / 3)}`,
    }),
  );
  const changes = E.allocate(tasks, [member("a"), member("b")], now);
  for (let i = 0; i < 4; i++)
    assert.equal(
      new Set(
        changes
          .filter((c) => Math.floor(Number(c.taskId) / 3) === i)
          .map((c) => c.assigneeId),
      ).size,
      1,
    );
  assert.equal(changes.filter((c) => c.assigneeId === "a").length, 6);
});
test("new orders join the employee already coordinating that vendor", () => {
  const changes = E.allocate(
    [
      task("1", {
        type: "vendor-call",
        vendorKey: "v",
        assigneeId: "b",
        attempts: [{ outcome: "no-answer" }],
      }),
      task("2", { type: "vendor-call", vendorKey: "v" }),
    ],
    [member("a"), member("b")],
    now,
  );
  assert.equal(changes.find((c) => c.taskId === "2").assigneeId, "b");
});
test("leave moves the whole vendor group", () => {
  const tasks = ["1", "2"].map((n) =>
    task(n, { type: "vendor-call", vendorKey: "v", assigneeId: "a" }),
  );
  const changes = E.allocate(
    tasks,
    [
      member("a", { leave: [{ from: "2026-09-21", until: "2026-09-22" }] }),
      member("b"),
    ],
    now,
  );
  assert.equal(changes.length, 2);
  assert.ok(changes.every((c) => c.assigneeId === "b"));
});
test("Saturday and planned leave do not advance onboarding", () => {
  const m = member("a", {
    joinedOn: "2026-09-18",
    newlyJoined: true,
    leave: [{ from: "2026-09-20", until: "2026-09-20" }],
  });
  assert.equal(E.workdays(m, now), 2);
  assert.equal(E.profile(m, now).ramp, 0.4);
  assert.equal(
    E.eligible(
      member("a", { newlyJoined: true, joinedOn: "2026-09-21" }),
      task("t"),
      now,
    ),
    false,
  );
  assert.equal(
    E.eligible(
      member("a", { newlyJoined: true, joinedOn: "2026-09-21" }),
      task("t", { type: "order-check" }),
      now,
    ),
    true,
  );
});
test("a missed untouched deadline transfers; an unanswered call waits for retry", () => {
  const old = new Date(+now - 7200000),
    people = [member("a"), member("b")];
  assert.equal(
    E.allocate(
      [task("t", { assigneeId: "a", dueAt: old, assignedAt: old })],
      people,
      now,
    )[0].assigneeId,
    "b",
  );
  assert.deepEqual(
    E.allocate(
      [
        task("t", {
          assigneeId: "a",
          dueAt: old,
          assignedAt: old,
          attempts: [{ outcome: "no-answer" }],
          nextAttemptAt: new Date(+now + 7200000),
        }),
      ],
      people,
      now,
    ),
    [],
  );
});
test("active calls and manual ownership survive balancing", () => {
  assert.deepEqual(
    E.allocate(
      [task("t", { assigneeId: "b", activeUntil: new Date(+now + 600000) })],
      [member("a"), member("b")],
      now,
    ),
    [],
  );
  assert.deepEqual(
    E.allocate(
      [task("t", { assigneeId: "b", manualAssignment: true })],
      [member("a"), member("b")],
      now,
    ),
    [],
  );
});
test("shift and team eligibility apply before workload scoring", () => {
  assert.equal(
    E.allocate(
      [task("t", { metadata: { team: "Returns" } })],
      [
        member("a", { checkedIn: true, team: "Sales" }),
        member("b", { checkedIn: false, team: "Returns" }),
      ],
      now,
      { requireCheckIn: true },
    ).length,
    0,
  );
});
test("manual levels remain fixed as experience grows", () => {
  assert.equal(
    E.profile(member("a", { levelMode: "manual", manualLevel: 4 }), now, 1000)
      .level,
    4,
  );
  assert.equal(E.profile(member("a"), now, 1000).level, 9);
});
test("work already handled today counts toward fair allocation", () => {
  const changes = E.allocate(
    [task("t")],
    [member("a", { workToday: 8 }), member("b", { workToday: 1 })],
    now,
  );
  assert.equal(changes[0].assigneeId, "b");
});
