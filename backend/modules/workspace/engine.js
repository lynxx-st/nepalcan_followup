const WORK = ["pending", "in-progress", "overdue"];
const dateKey = (value = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
const id = (value) => String(value?._id || value || "");
function workdays(member, now = new Date()) {
  const end = dateKey(now),
    start = member.joinedOn || end;
  let count = 0;
  for (
    let day = new Date(start + "T00:00:00Z");
    day.toISOString().slice(0, 10) <= end;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = day.toISOString().slice(0, 10);
    if (
      day.getUTCDay() !== 6 &&
      !(member.leave || []).some((l) => l.from <= key && l.until >= key)
    )
      count++;
  }
  return count;
}
function profile(member, now = new Date(), completed = 0) {
  const days = workdays(member, now);
  const automaticLevel = Math.min(
    10,
    ({ intern: 1, casual: 3, executive: 5 }[member.profile] || 3) +
      Math.min(2, Math.floor(days / 30)) +
      Math.min(5, Math.floor(completed / 10)),
  );
  const level =
    member.levelMode === "manual"
      ? Math.max(1, Math.min(10, member.manualLevel || 1))
      : automaticLevel;
  const ramp = member.newlyJoined ? Math.min(1, days / 5) : 1;
  return {
    days,
    level,
    automaticLevel,
    ramp,
    noCalls: !!member.newlyJoined && days <= 1,
    capacity: ramp * (0.75 + level * 0.05),
  };
}
function eligible(member, task, now, options = {}) {
  const today = dateKey(now),
    p =
      options.profiles?.get(id(member)) ||
      profile(member, now, member.completedCount || 0);
  if (
    ["admin", "super-admin"].includes(member.role) &&
    member.acceptsTasks !== true
  )
    return false;
  if (
    !member.isActive ||
    member.acceptsTasks === false ||
    member.deletedAt ||
    member.unavailableOn === today ||
    member.joinedOn > today
  )
    return false;
  if ((member.leave || []).some((l) => l.from <= today && l.until >= today))
    return false;
  if (new Date(today + "T00:00:00Z").getUTCDay() === 6) return false;
  if (options.requireCheckIn && !member.checkedIn) return false;
  if (task.metadata?.team && task.metadata.team !== member.team) return false;
  if (
    member.branches?.length &&
    task.metadata?.branch &&
    !member.branches.includes(task.metadata.branch)
  )
    return false;
  if (p.noCalls && task.type !== "order-check") return false;
  if (p.ramp < 1 && !["order-check", "review-call"].includes(task.type))
    return false;
  return p.capacity > 0;
}
function groupKey(task) {
  return ["vendor-call", "vendor-delay"].includes(task.type) && task.vendorKey
    ? `vendor:${task.vendorKey}`
    : `task:${id(task)}`;
}
function effort(task) {
  return (
    (["escalation", "return-followup"].includes(task.type)
      ? 2
      : task.type === "order-check"
        ? 0.5
        : 1) + (task.nextAttemptAt ? 0.5 : 0)
  );
}
function rank(task, now = new Date()) {
  const due = new Date(task.nextAttemptAt || task.dueAt || now).getTime();
  return (
    ({ critical: 400, high: 300, medium: 200, low: 100 }[task.priority] ||
      200) +
    Math.min(300, Math.max(0, (now - due) / 60000)) +
    Math.min(90, Math.max(0, (now - new Date(task.createdAt || now)) / 3600000))
  );
}
function allocate(tasks, members, now = new Date(), options = {}) {
  options = {
    ...options,
    profiles: new Map(
      members.map((m) => [id(m), profile(m, now, m.completedCount || 0)]),
    ),
  };
  const groups = new Map(),
    loads = new Map(members.map((m) => [id(m), Number(m.workToday) || 0])),
    changes = [];
  const grace = (options.graceMinutes ?? 30) * 60000;
  tasks
    .filter((t) => WORK.includes(t.status))
    .forEach((t) => {
      const key = groupKey(t);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    });
  const units = [...groups.values()].sort(
    (a, b) =>
      Math.max(...b.map((t) => rank(t, now))) -
        Math.max(...a.map((t) => rank(t, now))) ||
      id(a[0]).localeCompare(id(b[0])),
  );
  const weight = (group) =>
    Math.max(...group.map(effort)) + (group.length - 1) * 0.25;
  const plans = units.map((group) => {
    const candidates = members.filter((m) =>
      group.every((t) => eligible(m, t, now, options)),
    );
    const attempted = group
      .filter((t) => t.attempts?.length || t.startedAt || t.manualAssignment)
      .sort(
        (a, b) =>
          Number(!!b.manualAssignment) - Number(!!a.manualAssignment) ||
          new Date(b.assignedAt || 0) - new Date(a.assignedAt || 0),
      );
    const protectedTask = group.find((t) => new Date(t.activeUntil || 0) > now);
    const incumbent = candidates.find(
      (m) =>
        id(m) ===
        id(
          protectedTask?.assigneeId ||
            attempted[0]?.assigneeId ||
            group[0].assigneeId,
        ),
    );
    const missed = group.some(
      (t) =>
        new Date(t.nextAttemptAt || t.dueAt || now).getTime() + grace < +now &&
        new Date(t.assignedAt || 0).getTime() + grace < +now &&
        (!t.attempts?.length || t.nextAttemptAt) &&
        !t.manualAssignment,
    );
    const hold = incumbent && (protectedTask || (!missed && attempted.length));
    if (hold)
      loads.set(id(incumbent), loads.get(id(incumbent)) + weight(group));
    return { group, candidates, incumbent, missed, hold, protectedTask };
  });
  const average =
    units.reduce((sum, g) => sum + weight(g), 0) /
    Math.max(
      1,
      members.filter((m) => m.isActive && m.acceptsTasks !== false).length,
    );
  for (const unit of plans) {
    const { group, incumbent, missed, hold, protectedTask } = unit;
    let candidates = unit.candidates.filter(
      (m) =>
        options.profiles.get(id(m)).ramp >= 1 ||
        loads.get(id(m)) + weight(group) <=
          Math.max(1, average * options.profiles.get(id(m)).ramp),
    );
    if (
      missed &&
      !protectedTask &&
      candidates.some((m) => id(m) !== id(incumbent))
    )
      candidates = candidates.filter((m) => id(m) !== id(incumbent));
    candidates.sort(
      (a, b) =>
        (loads.get(id(a)) + weight(group)) /
          options.profiles.get(id(a)).capacity -
          (loads.get(id(b)) + weight(group)) /
            options.profiles.get(id(b)).capacity ||
        Number(id(b) === id(incumbent)) - Number(id(a) === id(incumbent)) ||
        id(a).localeCompare(id(b)),
    );
    const owner = hold ? incumbent : candidates[0];
    if (owner && !hold)
      loads.set(id(owner), loads.get(id(owner)) + weight(group));
    for (const task of group)
      if (id(task.assigneeId) !== id(owner))
        changes.push({
          taskId: id(task),
          previous: id(task.assigneeId),
          assigneeId: owner ? id(owner) : null,
          assigneeName: owner?.name || "",
          reason: !owner
            ? "No eligible employee available"
            : missed
              ? "Follow-up deadline missed; transferred to available capacity"
              : group.length > 1
                ? "Same vendor; one coordinator for all open orders"
                : "Balanced against available employee capacity",
        });
  }
  return changes;
}
module.exports = {
  WORK,
  id,
  dateKey,
  workdays,
  profile,
  eligible,
  groupKey,
  effort,
  rank,
  allocate,
};
