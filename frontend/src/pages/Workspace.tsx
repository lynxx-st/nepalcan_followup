import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useSearchParams } from "react-router-dom";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";

import api, { attendanceApi } from "../services/api";

import "./workspace.css";

type Row = Record<string, any>;

const request = async (path: string, data?: any, method = "get") => {
  const result: any = await (api as any)[method](
    `/v1/workspace${path}`,
    ...(method === "get" ? [] : [data]),
  );
  return result.data;
};

const problem = (e: any) =>
  e?.response?.data?.error?.message ||
  "Could not save. Your changes are still here. Please retry.";

const time = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Asia/Kathmandu",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No deadline";

const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const title: Row = {
  "vendor-call": "Confirm stock with vendor",
  "vendor-delay": "Follow up vendor dispatch",
  "customer-confirmation": "Confirm customer order",
  "review-call": "Collect customer review",
  "logistics-followup": "Check delivery progress",
  escalation: "Resolve an escalation",
  "order-check": "Check order details",
  "return-followup": "Follow up return",
};

const outcomes = [
  ["customer-confirmed", "Customer confirmed"],
  ["vendor-accepted", "Stock available"],
  ["vendor-rejected", "Stock unavailable"],
  ["vendor-delayed", "Vendor needs more time"],
  ["no-answer", "No answer"],
  ["call-later", "Callback requested"],
  ["wrong-number", "Wrong number"],
  ["review-collected", "Review collected"],
  ["return-customer-confirmed", "Customer confirmed return"],
  ["return-customer-rejected", "Customer declined return"],
  ["return-vendor-accepted", "Vendor accepted return"],
  ["return-vendor-rejected", "Vendor declined return"],
  ["resolved", "Resolved"],
  ["other", "Needs another follow-up"],
];

function contact(t: Row, party?: string) {
  const o = t.order || {},
    vendor = party
      ? party === "vendor"
      : ["vendor-call", "vendor-delay"].includes(t.type) ||
        (t.type === "logistics-followup" &&
          o.workflowStage === "confirmed_unprocessed") ||
        (t.type === "return-followup" && o.workflowStage === "vendor_response");
  const person = vendor ? o.vendor : o.customer;
  return {
    name:
      typeof person === "string"
        ? person
        : person?.name ||
          o.customerProfile?.name ||
          (vendor ? "Vendor" : "Customer"),
    phone: vendor
      ? o.vendor?.phone || t.vendorPhone
      : o.customer?.phone || o.customerProfile?.phone || t.customerPhone,
    vendor,
  };
}

function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <p className="work-error" role="alert">
      {message}
    </p>
  ) : null;
}

export default function Workspace({
  mode = "tasks",
}: {
  mode?: "tasks" | "reviews" | "returns" | "team";
}) {
  const [tasks, setTasks] = useState<Row[]>([]),
    [me, setMe] = useState<Row>(),
    [shift, setShift] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [search, setSearch] = useState("");

  const [params, setParams] = useSearchParams();
  const selected = params.get("task"),
    tab = params.get("view") || "now";

  const load = useCallback(async () => {
    try {
      const [rows, user, attendance] = await Promise.all([
        request(mode === "team" ? "/tasks?team=true" : "/tasks"),
        request("/me"),
        attendanceApi.getStatus() as any,
      ]);
      setTasks(rows);
      setMe(user);
      setShift(attendance.data?.isCheckedIn);
      setError("");
    } catch (e) {
      setError(problem(e));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        const future =
          t.nextAttemptAt && new Date(t.nextAttemptAt) > new Date();

        const match =
          tab === "done"
            ? t.status === "completed" &&
              t.completedAt &&
              new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kathmandu",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(t.completedAt)) === today()
            : t.status !== "completed" &&
              (tab === "callbacks"
                ? !!t.nextAttemptAt
                : tab === "waiting"
                  ? !!future
                  : !future);

        return (
          match &&
          (mode === "reviews"
            ? t.type === "review-call"
            : mode === "returns"
              ? t.type === "return-followup"
              : true) &&
          JSON.stringify([
            t.orderId,
            t.orderNumber,
            t.order?.orderId,
            contact(t).name,
            t.reason,
            t.assigneeName,
          ])
            .toLowerCase()
            .includes(search.toLowerCase())
        );
      }),
    [tasks, tab, search, mode],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    filtered.forEach((t) => {
      const key = t.groupKey || t._id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return [...map.values()];
  }, [filtered]);

  const current = tasks.find((t) => t._id === selected),
    siblings = current
      ? tasks.filter(
          (t) => t.groupKey === current.groupKey && t.status !== "completed",
        )
      : [];

  const select = (task?: string) =>
    setParams({ view: tab, ...(task ? { task } : {}) });

  async function toggleShift() {
    setBusy(true);
    try {
      await (shift ? attendanceApi.checkOut() : attendanceApi.checkIn());
      await load();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <header className="work-heading">
        <div>
          <p className="eyebrow">Your working day · Nepal time</p>
          <h1>
            {mode === "team"
              ? "Team workload"
              : mode === "reviews"
                ? "Review calls"
                : mode === "returns"
                  ? "Return follow-ups"
                  : "My tasks"}
            <span className="heading-dot">.</span>
          </h1>
          <p>One conversation. A clear next step.</p>
        </div>
        <div className="work-actions">
          <button
            disabled={busy}
            className={shift ? "quiet-button" : "solid-button"}
            onClick={toggleShift}
          >
            {shift ? "End shift" : "Start shift"}
          </button>
          <button
            className="icon-button"
            aria-label="Refresh tasks"
            onClick={load}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </header>

      <ErrorMessage message={error} />

      {me?.training?.noCalls && (
        <div className="work-notice">
          Your first day: check order details and learn the workflow. Calling
          starts after day one.
        </div>
      )}

      {!shift && (
        <div className="work-notice">
          You’re off shift. Start your shift when you’re ready to receive work.
        </div>
      )}

      <div className="work-summary">
        <span>
          <strong>
            {tasks.filter((t) => t.status !== "completed").length}
          </strong>{" "}
          open tasks
        </span>
        <span>
          <strong>
            {
              tasks.filter((t) => t.nextAttemptAt && t.status !== "completed")
                .length
            }
          </strong>{" "}
          callbacks
        </span>
        <span>
          <strong>
            {
              tasks.filter(
                (t) =>
                  t.status !== "completed" &&
                  new Date(t.nextAttemptAt || t.dueAt) < new Date(),
              ).length
            }
          </strong>{" "}
          overdue
        </span>
        {me?.training && (
          <span>
            Level <strong>{me.training.level}</strong> ·{" "}
            {Math.round(me.training.ramp * 100)}% capacity
          </span>
        )}
      </div>

      <div className="work-toolbar">
        <nav aria-label="Task views">
          {[
            ["now", "Do now"],
            ["callbacks", "Callbacks"],
            ["waiting", "Waiting"],
            ["done", "Completed today"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={tab === key}
              onClick={() => setParams({ view: key })}
            >
              {label}
            </button>
          ))}
        </nav>
        <label className="work-search">
          <Search size={17} />
          <input
            aria-label="Search tasks"
            placeholder="Order, person or employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div className={`work-layout ${current ? "has-selection" : ""}`}>
        <section className="work-queue" aria-label="Task queue">
          <div className="queue-caption">
            <span>{groups.length} conversations</span>
            <span>Priority first</span>
          </div>

          {loading ? (
            <div className="work-empty">Loading your work…</div>
          ) : groups.length === 0 ? (
            <div className="work-empty">
              <CheckCheck size={28} />
              <h2>{search ? "No matching tasks" : "Nothing waiting here"}</h2>
              <p>
                {search
                  ? "Try an order number or person’s name."
                  : "New assignments and scheduled follow-ups appear here automatically."}
              </p>
            </div>
          ) : (
            groups.map((group) => {
              const t = group[0],
                person = contact(t),
                overdue = new Date(t.nextAttemptAt || t.dueAt) < new Date();
              return (
                <button
                  className={`conversation ${group.some((x) => x._id === selected) ? "selected" : ""}`}
                  key={t.groupKey || t._id}
                  onClick={() => select(t._id)}
                >
                  <div className="conversation-top">
                    <span className="work-badge">
                      {person.vendor ? "Vendor" : "Customer"}
                      {group.length > 1 ? ` · ${group.length} orders` : ""}
                    </span>
                    <span className={overdue ? "deadline overdue" : "deadline"}>
                      <Clock3 size={13} />
                      {overdue
                        ? "Overdue"
                        : t.nextAttemptAt
                          ? "Callback"
                          : "Due"}{" "}
                      {time(t.nextAttemptAt || t.dueAt)}
                    </span>
                  </div>
                  <h2>{person.name}</h2>
                  <p>{title[t.type] || t.reason}</p>
                  <div className="conversation-bottom">
                    <span>
                      {t.assigneeName || "Unassigned"} ·{" "}
                      {t.order?.orderId ||
                        t.orderNumber ||
                        t.sourceOrder?.orderNumber ||
                        "Order details"}
                    </span>
                    <ChevronRight size={17} />
                  </div>
                </button>
              );
            })
          )}
        </section>
        <section className="work-detail" aria-label="Task details">
          {current ? (
            <TaskPanel
              key={current._id}
              task={current}
              canAssign={["admin", "super-admin", "manager"].includes(me?.role)}
              siblings={siblings}
              onBack={() => select()}
              onSelect={select}
              onSaved={async () => {
                await load();
              }}
            />
          ) : (
            <div className="work-empty detail-empty">
              <Phone size={30} />
              <h2>Start with the next conversation</h2>
              <p>
                Select a task to see the contact, order details, previous calls
                and the next action.
              </p>
              {groups[0] && (
                <button
                  className="solid-button"
                  onClick={() => select(groups[0][0]._id)}
                >
                  Open next task <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TaskPanel({
  task: t,
  canAssign,
  siblings,
  onBack,
  onSelect,
  onSaved,
}: {
  task: Row;
  canAssign: boolean;
  siblings: Row[];
  onBack: () => void;
  onSelect: (id: string) => void;
  onSaved: () => Promise<void>;
}) {
  const [contactParty, setContactParty] = useState("");
  const person = contact(t, contactParty),
    draftKey = `followup-draft:${t._id}`;

  const initial = () => {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey) || "{}");
    } catch {
      return {};
    }
  };

  const [draft, setDraft] = useState<Row>(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [requestId, setRequestId] = useState(() => {
      const key = draftKey + ":request";
      const value = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, value);
      return value;
    });

  useEffect(() => {
    sessionStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draft, draftKey]);

  const [contactLoading, setContactLoading] = useState(false);
  async function loadContact() {
    setContactLoading(true);
    setError("");
    try {
      const result = await request(`/tasks/${t._id}/contact`, {}, "post");
      await onSaved();
      if (!(person.vendor ? result.vendorPhone : result.customerPhone))
        setError(
          "The portal order details do not contain a phone number for this contact.",
        );
    } catch (e) {
      setError(problem(e));
    } finally {
      setContactLoading(false);
    }
  }

  useEffect(() => {
    if (!person.phone && !t.closedAt && t.status !== "completed")
      void loadContact();
  }, [t._id, person.vendor]);

  const [employees, setEmployees] = useState<Row[]>([]),
    [transfer, setTransfer] = useState("");

  useEffect(() => {
    if (canAssign)
      request("/employees")
        .then(setEmployees)
        .catch(() => {});
  }, [canAssign]);

  async function reassign() {
    setBusy(true);
    setError("");
    try {
      await request(`/tasks/${t._id}/assign`, { assigneeId: transfer }, "post");
      setMessage("Assignment updated for the whole vendor group or task.");
      await onSaved();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  const closed = t.status === "completed" || t.closedAt;

  const outcomeOptions = outcomes.filter(([code]) =>
    t.type === "return-followup"
      ? code.startsWith(
          person.vendor ? "return-vendor-" : "return-customer-",
        ) || ["no-answer", "call-later", "wrong-number", "other"].includes(code)
      : code.startsWith("return-")
        ? false
        : t.type === "order-check"
          ? code === "resolved"
          : ["vendor-call", "vendor-delay"].includes(t.type)
            ? !["customer-confirmed", "review-collected", "resolved"].includes(
                code,
              )
            : !code.startsWith("vendor-") &&
              (code !== "customer-confirmed" ||
                t.type === "customer-confirmation") &&
              (code !== "review-collected" || t.type === "review-call") &&
              (code !== "resolved" ||
                !["customer-confirmation", "review-call"].includes(t.type)),
  );

  async function prepare() {
    setBusy(true);
    setError("");
    try {
      await request(`/tasks/${t._id}/start`, {}, "post");
      setMessage("Task started. Open the dialer, then record what happened.");
      await onSaved();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(
        `/tasks/${t._id}/outcome`,
        {
          ...draft,
          contactParty: person.vendor ? "vendor" : "customer",
          applyToGroup:
            person.vendor &&
            siblings.length > 1 &&
            draft.applyToGroup !== false,
          requestId,
          durationMinutes: Number(draft.durationMinutes || 0),
          nextAttemptAt: draft.nextAttemptAt
            ? new Date(draft.nextAttemptAt).toISOString()
            : undefined,
        },
        "post",
      );
      setDraft({});
      sessionStorage.removeItem(draftKey);
      const nextId = crypto.randomUUID();
      setRequestId(nextId);
      sessionStorage.setItem(draftKey + ":request", nextId);
      setMessage("Outcome saved.");
      await onSaved();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="detail-heading">
        <button
          onClick={onBack}
          className="icon-button"
          aria-label="Back to tasks"
        >
          <ArrowLeft size={19} />
        </button>
        <span>{title[t.type] || t.type}</span>
        <span className="work-badge">{closed ? "Closed" : t.priority}</span>
      </div>
      <div className="detail-body">
        <p className="eyebrow">
          {person.vendor ? "Vendor contact" : "Customer contact"}
        </p>
        <h2>{person.name}</h2>
        <p className="contact-number">
          {person.phone ||
            (contactLoading
              ? "Fetching phone number from portal..."
              : "Phone number not available")}
        </p>
        {!person.phone && (
          <button
            className="outline-button"
            disabled={contactLoading}
            onClick={loadContact}
          >
            {contactLoading ? "Loading contact..." : "Retry portal contact"}
          </button>
        )}
        <p>{t.reason}</p>
        {["logistics-followup", "escalation"].includes(t.type) && (
          <label className="field-label">
            Contact for this follow-up
            <select
              value={person.vendor ? "vendor" : "customer"}
              onChange={(e) => setContactParty(e.target.value)}
            >
              <option value="customer">Customer</option>
              <option value="vendor">Vendor</option>
            </select>
          </label>
        )}

        {siblings.length > 1 && (
          <div className="batch-list">
            <h3>One vendor · {siblings.length} open orders</h3>
            <p>
              Discuss these together. Record each order’s result separately.
            </p>
            {siblings.map((s) => (
              <button
                className={s._id === t._id ? "active" : ""}
                key={s._id}
                onClick={() => onSelect(s._id)}
              >
                {s.order?.orderId ||
                  s.orderNumber ||
                  s.sourceOrder?.orderNumber ||
                  s._id}
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        )}

        <dl className="order-facts">
          <div>
            <dt>Order</dt>
            <dd>
              <Link
                to={`/orders/${t.order?.commerceOrderId || t.sourceOrder?.orderId || t.orderId}`}
              >
                {t.order?.orderId ||
                  t.orderNumber ||
                  t.sourceOrder?.orderNumber ||
                  "Open order"}{" "}
                <ArrowUpRight size={13} />
              </Link>
            </dd>
          </div>
          <div>
            <dt>Portal status</dt>
            <dd>{t.order?.orderStatus || "Awaiting sync"}</dd>
          </div>
          <div>
            <dt>Orders section</dt>
            <dd>
              {t.metadata?.returnId || t.order?.workflowStage === "hold"
                ? "Return & Recovery"
                : [
                      "collected_by_logistics",
                      "confirmed_unprocessed",
                      "shipped",
                    ].includes(t.order?.workflowStage)
                  ? "Processing"
                  : ["pending_review", "reviewed"].includes(
                        t.order?.workflowStage,
                      )
                    ? "After Delivery"
                    : "Pre Processing"}
            </dd>
          </div>
          <div>
            <dt>Current step</dt>
            <dd>
              {(
                {
                  pending_confirmation: "Customer confirmation",
                  done: "Vendor follow-up",
                  confirmed_unprocessed: "Awaiting pickup / dispatch",
                  collected_by_logistics: "Logistics follow-up",
                  shipped: "Delivery follow-up",
                  pending_review: "Customer review",
                  customer_response: "Return: customer response",
                  vendor_response: "Return: vendor response",
                  hold: "Resolve order hold",
                  rescheduled: "Scheduled callback",
                } as Record<string, string>
              )[t.order?.workflowStage] || "Check order details"}
            </dd>
          </div>
          <div>
            <dt>Assigned to</dt>
            <dd>{t.assigneeName || "Unassigned"}</dd>
          </div>
          <div>
            <dt>Follow-up</dt>
            <dd>{time(t.nextAttemptAt || t.dueAt)}</dd>
          </div>
        </dl>

        {t.assignmentHistory?.length > 0 && (
          <p className="assignment-reason">
            {t.assignmentHistory.at(-1).reason}
          </p>
        )}

        <ErrorMessage message={error} />
        {message && (
          <p className="work-notice" role="status">
            {message}
          </p>
        )}

        {canAssign && !closed && (
          <div className="form-section">
            <label>
              Transfer {person.vendor ? "vendor group" : "task"}
              <select
                value={transfer}
                onChange={(e) => setTransfer(e.target.value)}
              >
                <option value="">Choose an employee</option>
                {employees
                  .filter((e) => e.isActive && !e.deletedAt)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.open} open
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="quiet-button"
              disabled={busy || !transfer}
              onClick={reassign}
            >
              Transfer assignment
            </button>
          </div>
        )}

        {!closed && (
          <form onSubmit={save} className="outcome-form">
            <h3>Record the outcome</h3>
            <div className="outcome-options">
              {outcomeOptions.map(([value, label]) => (
                <button
                  type="button"
                  aria-pressed={draft.outcome === value}
                  key={value}
                  onClick={() => setDraft({ ...draft, outcome: value })}
                >
                  {draft.outcome === value && <Check size={14} />} {label}
                </button>
              ))}
            </div>
            {person.vendor &&
              siblings.length > 1 &&
              [
                "no-answer",
                "call-later",
                "vendor-delayed",
                "wrong-number",
              ].includes(draft.outcome) && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.applyToGroup !== false}
                    onChange={(e) =>
                      setDraft({ ...draft, applyToGroup: e.target.checked })
                    }
                  />
                  Apply this follow-up to all {siblings.length} vendor orders
                </label>
              )}
            <label>
              {t.type === "review-call" ? "Customer review / notes" : "Notes"}
              <textarea
                rows={3}
                value={draft.notes || ""}
                maxLength={10000}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="What happened? What needs to happen next?"
              />
            </label>
            {[
              "call-later",
              "requested-tomorrow",
              "vendor-delayed",
              "no-answer",
              "wrong-number",
              "other",
            ].includes(draft.outcome) && (
              <label>
                Next follow-up{" "}
                <small>
                  {["no-answer", "wrong-number", "other"].includes(
                    draft.outcome,
                  )
                    ? "(optional; otherwise uses retry interval)"
                    : ""}
                </small>
                <input
                  type="datetime-local"
                  required={[
                    "call-later",
                    "requested-tomorrow",
                    "vendor-delayed",
                  ].includes(draft.outcome)}
                  value={draft.nextAttemptAt || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, nextAttemptAt: e.target.value })
                  }
                />
                <small>Time is entered in your device’s local timezone.</small>
              </label>
            )}
            {t.type !== "order-check" && (
              <label>
                Call duration in minutes <small>(enter after the call)</small>
                <input
                  type="number"
                  min="0"
                  max="480"
                  step="0.5"
                  value={draft.durationMinutes || ""}
                  onChange={(e) =>
                    setDraft({ ...draft, durationMinutes: e.target.value })
                  }
                />
              </label>
            )}
            <div className="task-actions">
              {person.phone && (
                <>
                  {!t.activeUntil || new Date(t.activeUntil) < new Date() ? (
                    <button
                      type="button"
                      className="quiet-button"
                      disabled={busy}
                      onClick={prepare}
                    >
                      <Phone size={17} /> Start call
                    </button>
                  ) : (
                    <a
                      className="quiet-button"
                      href={`tel:${String(person.phone).replace(/[^+\d]/g, "")}`}
                    >
                      <Phone size={17} /> Open dialer
                    </a>
                  )}
                </>
              )}
              <button
                className="solid-button"
                disabled={busy || !draft.outcome}
              >
                {busy ? "Saving…" : "Save outcome"}
              </button>
            </div>
          </form>
        )}

        <section className="call-history">
          <h3>Conversation history</h3>
          {!(t.attempts || []).length ? (
            <p>No attempts recorded yet.</p>
          ) : (
            [...(t.attempts || [])].reverse().map((a: Row) => (
              <article key={a.requestId}>
                <div>
                  <strong>
                    {outcomes.find((o) => o[0] === a.outcome)?.[1] || a.outcome}
                  </strong>
                  <time>{time(a.at)}</time>
                </div>
                <p>{a.notes || "No notes added"}</p>
                <small>
                  {a.actorName} · {a.durationMinutes} min
                  {a.nextAttemptAt ? ` · Next: ${time(a.nextAttemptAt)}` : ""}
                </small>
              </article>
            ))
          )}
        </section>
      </div>
    </>
  );
}

const blankEmployee = () => ({
  name: "",
  username: "",
  email: "",
  password: "",
  role: "staff",
  profile: "casual",
  team: "Follow up",
  isActive: true,
  acceptsTasks: true,
  newlyJoined: false,
  joinedOn: today(),
  leave: [] as Row[],
  unavailableOn: "",
  levelMode: "auto",
  manualLevel: 1,
});

export function Employees() {
  const [rows, setRows] = useState<Row[]>([]),
    [me, setMe] = useState<Row>(),
    [draft, setDraft] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Row>();

  const load = useCallback(async () => {
    try {
      const [members, user] = await Promise.all([
        request("/employees"),
        request("/me"),
      ]);
      setRows(members);
      setMe(user);
    } catch (e) {
      setError(problem(e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const admin = ["admin", "super-admin"].includes(me?.role);

  useEffect(() => {
    if (!draft && !selected) return;

    const previous = document.activeElement as HTMLElement | null;

    const modal = document.querySelector<HTMLElement>('[role="dialog"]');

    const elements = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),select,textarea,a[href]",
        ) || [],
      );

    elements()[0]?.focus();

    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setDraft(null);
        setSelected(undefined);
      }
      if (e.key === "Tab") {
        const items = elements(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [!!draft, !!selected, busy]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(
        `/employees${draft?.id ? `/${draft.id}` : ""}`,
        draft,
        draft?.id ? "put" : "post",
      );
      setDraft(null);
      await load();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft?.id) return;
    setBusy(true);
    try {
      await request(`/employees/${draft.id}`, {}, "delete");
      setDraft(null);
      await load();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <header className="work-heading">
        <div>
          <p className="eyebrow">People & capacity</p>
          <h1>Your team.</h1>
          <p>Clear responsibilities. Room to learn.</p>
        </div>
        {admin && (
          <button
            className="solid-button"
            onClick={() => {
              setError("");
              setDraft(blankEmployee());
            }}
          >
            <Users size={17} /> Add employee
          </button>
        )}
      </header>
      <ErrorMessage message={!draft ? error : ""} />
      <div className="work-toolbar">
        <p>
          {rows.filter((r) => !r.deletedAt).length} employees · Performance over
          the last 30 days
        </p>
        <label className="work-search">
          <Search size={17} />
          <input
            aria-label="Search employees"
            placeholder="Search employees"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="employee-grid">
        {rows
          .filter(
            (r) =>
              !r.deletedAt &&
              `${r.name} ${r.username}`
                .toLowerCase()
                .includes(search.toLowerCase()),
          )
          .map((r) => (
            <article className="employee-card" key={r.id}>
              <div className="employee-top">
                <div className="initials">
                  {r.name
                    ?.split(" ")
                    .map((n: string) => n[0])
                    .slice(0, 2)
                    .join("") || "—"}
                </div>
                <span className="work-badge">
                  {r.isActive
                    ? r.unavailableOn === today()
                      ? "Unavailable today"
                      : "Active"
                    : "Inactive"}
                </span>
              </div>
              <h2>{r.name || r.username || r.email}</h2>
              <p className="capitalize">
                {r.profile || "casual"} ·{" "}
                {r.role === "staff" ? "Employee" : r.role}
              </p>
              <div className="level-row">
                <strong>Level {r.level}</strong>
                <span>
                  {r.levelMode === "manual"
                    ? "Set by manager"
                    : "Updates automatically"}
                </span>
              </div>
              <div className="capacity-track">
                <span style={{ width: `${Math.round(r.ramp * 100)}%` }} />
              </div>
              <p className="small-copy">
                {r.noCalls
                  ? "Day one · no calls"
                  : r.ramp < 1
                    ? `Onboarding day ${r.days} · ${Math.round(r.ramp * 100)}% capacity`
                    : "Normal capacity"}
              </p>
              <div className="employee-metrics">
                <div>
                  <strong>{r.open}</strong>
                  <span>Open</span>
                </div>
                <div>
                  <strong>{r.completed}</strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>{r.calls}</strong>
                  <span>Calls</span>
                </div>
              </div>
              <div className="work-actions">
                <button className="quiet-button" onClick={() => setSelected(r)}>
                  View report
                </button>
                {admin && r.role !== "super-admin" && (
                  <button
                    className="quiet-button"
                    onClick={() => {
                      setError("");
                      setDraft({
                        ...blankEmployee(),
                        ...r,
                        username: r.username || "",
                        email: r.email || "",
                        joinedOn: r.joinedOn || today(),
                      });
                    }}
                  >
                    Edit profile
                  </button>
                )}
              </div>
            </article>
          ))}
      </div>
      {rows.length === 0 && (
        <div className="work-empty">
          <Users size={30} />
          <h2>Build your follow-up team</h2>
          <p>
            Add employees, set their availability and let the queue distribute
            work.
          </p>
        </div>
      )}

      {draft && (
        <div className="work-overlay">
          <section
            className="work-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-title"
          >
            <header>
              <div>
                <p className="eyebrow">Employee profile</p>
                <h2 id="employee-title">
                  {draft.id ? "Edit employee" : "Add to your team"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close employee editor"
                disabled={busy}
                onClick={() => setDraft(null)}
              >
                <X size={21} />
              </button>
            </header>
            <form onSubmit={save}>
              <ErrorMessage message={error} />
              <div className="form-grid">
                {[
                  ["name", "Full name"],
                  ["username", "Login username"],
                  ["email", "Email (optional)"],
                  [
                    "password",
                    draft.id ? "New password (optional)" : "Password",
                  ],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={
                        key !== "email" && !(key === "password" && draft.id)
                      }
                      autoComplete={key === "password" ? "new-password" : "off"}
                      type={
                        key === "password"
                          ? "password"
                          : key === "email"
                            ? "email"
                            : "text"
                      }
                      value={draft[key] || ""}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  Access role
                  <select
                    value={draft.role}
                    onChange={(e) =>
                      setDraft({ ...draft, role: e.target.value })
                    }
                  >
                    <option value="staff">Employee — assigned work</option>
                    <option value="manager">Manager — team oversight</option>
                    <option value="admin">Admin — workspace settings</option>
                  </select>
                </label>
                <label>
                  Employee profile
                  <select
                    value={draft.profile}
                    onChange={(e) =>
                      setDraft({ ...draft, profile: e.target.value })
                    }
                  >
                    {["intern", "casual", "executive"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Team
                  <input
                    value={draft.team || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, team: e.target.value })
                    }
                  />
                </label>
                <label>
                  Joining date
                  <input
                    type="date"
                    required
                    value={draft.joinedOn}
                    onChange={(e) =>
                      setDraft({ ...draft, joinedOn: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-section">
                <h3>Availability & onboarding</h3>
                {[
                  ["isActive", "Account active"],
                  ["acceptsTasks", "Receive task assignments"],
                  ["newlyJoined", "New joiner — gradually increase workload"],
                ].map(([key, label]) => (
                  <label className="check-label" key={key}>
                    <input
                      type="checkbox"
                      checked={!!draft[key]}
                      onChange={(e) =>
                        setDraft({ ...draft, [key]: e.target.checked })
                      }
                    />
                    {label}
                  </label>
                ))}
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={draft.unavailableOn === today()}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        unavailableOn: e.target.checked ? today() : "",
                      })
                    }
                  />
                  Unavailable today
                </label>
                <p className="small-copy">
                  Sunday–Friday workweek. No calls on day one. Capacity grows
                  across five workdays; leave does not count.
                </p>
                <h3>Planned leave</h3>
                {(draft.leave || []).map((l: Row, i: number) => (
                  <div className="leave-row" key={i}>
                    <label>
                      First day off
                      <input
                        type="date"
                        required
                        value={l.from}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            leave: draft.leave.map((v: Row, j: number) =>
                              j === i ? { ...v, from: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Last day off
                      <input
                        type="date"
                        required
                        value={l.until}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            leave: draft.leave.map((v: Row, j: number) =>
                              j === i ? { ...v, until: e.target.value } : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Remove leave period"
                      className="icon-button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          leave: draft.leave.filter(
                            (_: any, j: number) => j !== i,
                          ),
                        })
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      leave: [...draft.leave, { from: "", until: "" }],
                    })
                  }
                >
                  Add leave period
                </button>
              </div>
              <div className="form-grid">
                <label>
                  Employee level
                  <select
                    value={draft.levelMode}
                    onChange={(e) =>
                      setDraft({ ...draft, levelMode: e.target.value })
                    }
                  >
                    <option value="auto">Update automatically</option>
                    <option value="manual">Set manually</option>
                  </select>
                </label>
                {draft.levelMode === "manual" && (
                  <label>
                    Level (1–10)
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={draft.manualLevel}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          manualLevel: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </div>
              <footer>
                {draft.id && (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={busy}
                    onClick={remove}
                  >
                    Remove employee
                  </button>
                )}
                <button className="solid-button" disabled={busy}>
                  {busy ? "Saving…" : "Save employee"}
                </button>
              </footer>
              <p className="small-copy">
                Removing an employee disables access and transfers open work.
                Their history stays in reports.
              </p>
            </form>
          </section>
        </div>
      )}

      {selected && (
        <div className="work-overlay">
          <section
            className="work-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
          >
            <header>
              <h2 id="report-title">{selected.name} · Report</h2>
              <button
                className="icon-button"
                aria-label="Close report"
                onClick={() => setSelected(undefined)}
              >
                <X />
              </button>
            </header>
            <div className="report-grid">
              {[
                ["Calls recorded", selected.calls],
                ["Connected calls", selected.connected],
                [
                  "Connection rate",
                  selected.connectionRate === null
                    ? "No calls"
                    : `${selected.connectionRate}%`,
                ],
                ["Completed tasks", selected.completed],
                ["Overdue tasks", selected.overdue],
                ["Call handling time", `${selected.handlingMinutes} min`],
                [
                  "Median time to resolve",
                  selected.medianResolutionMinutes === null
                    ? "Not enough data"
                    : `${selected.medianResolutionMinutes} min`,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p>
              Level {selected.level} · {selected.days} workdays since joining.
              Automatic level: {selected.automaticLevel}. Ten completed tasks
              add one experience level, subject to the level cap.
            </p>
            <p className="small-copy">
              Call duration is entered by the employee. No-answer attempts do
              not reduce the level. Handling time excludes waiting. Time to
              resolve includes waiting and starts at the most recent assignment.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export function Automation() {
  const [data, setData] = useState<Row>(),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const fresh = await request("/automation");
      setData((current) =>
        current ? { ...fresh, settings: current.settings } : fresh,
      );
    } catch (e) {
      setError(problem(e));
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);
  async function act(path: string, body?: any, method = "post") {
    setBusy(true);
    setError("");
    try {
      await request(path, body, method);
      setMessage(
        path === "/sync"
          ? "Sync completed."
          : path === "/rebalance"
            ? "Assignments updated."
            : "Settings saved.",
      );
      await load();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <header className="work-heading">
        <div>
          <p className="eyebrow">Workspace automation</p>
          <h1>Keep work moving.</h1>
          <p>Portal updates, fair assignments and timely follow-ups.</p>
        </div>
        <button
          disabled={busy}
          className="solid-button"
          onClick={() => act("/sync")}
        >
          {busy ? "Working…" : "Sync now"}
        </button>
      </header>
      <ErrorMessage message={error} />
      {message && (
        <p className="work-notice" role="status">
          {message}
        </p>
      )}
      {data && (
        <div className="automation-grid">
          <section className="settings-card">
            <h2>Sync health</h2>
            <dl className="order-facts">
              <div>
                <dt>Last successful sync</dt>
                <dd>
                  {data.status?.lastSuccessAt
                    ? time(data.status.lastSuccessAt)
                    : "No successful run yet"}
                </dd>
              </div>
              <div>
                <dt>Current state</dt>
                <dd>
                  {data.status?.running
                    ? "Running"
                    : data.status?.error
                      ? "Needs attention"
                      : "Ready"}
                </dd>
              </div>
            </dl>
            {data.status?.orders !== undefined && (
              <p className="small-copy">
                Last run: {data.status.orders} orders and{" "}
                {data.status.returns || 0} returns.{" "}
                {data.status.contactFailures
                  ? `${data.status.contactFailures} contact lookups will retry.`
                  : ""}
              </p>
            )}
            {data.status?.error && <ErrorMessage message={data.status.error} />}
            <h3>Connect cron-job.org</h3>
            <p>
              Run every minute using <strong>POST</strong>.
            </p>
            <code className="endpoint">
              {window.location.origin}
              {data.endpoint}
            </code>
            <p>
              Set the Authorization header to{" "}
              <code>Bearer YOUR_CRON_SECRET</code>, using the same secret
              configured on your server.
            </p>
            <p className="small-copy">
              {data.cronConfigured
                ? "Cron secret is configured."
                : "Configure CRON_SECRET on the server first (at least 24 characters)."}
            </p>
          </section>
          <section className="settings-card">
            <h2>Assignment rules</h2>
            <p>
              Vendor coordination stays together. Started work is protected;
              missed follow-ups can transfer.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                act("/automation", data.settings, "put");
              }}
            >
              <label>
                Grace period after a missed deadline (minutes)
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={data.settings.graceMinutes}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: {
                        ...data.settings,
                        graceMinutes: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label>
                Retry after no answer (minutes)
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={data.settings.retryMinutes}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: {
                        ...data.settings,
                        retryMinutes: Number(e.target.value),
                      },
                    })
                  }
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={data.settings.requireCheckIn}
                  onChange={(e) =>
                    setData({
                      ...data,
                      settings: {
                        ...data.settings,
                        requireCheckIn: e.target.checked,
                      },
                    })
                  }
                />
                Only assign to employees on shift
              </label>
              <button disabled={busy} className="solid-button">
                Save rules
              </button>
            </form>
            <button
              disabled={busy}
              className="quiet-button"
              onClick={() => act("/rebalance")}
            >
              Balance available work now
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

export function Archive() {
  const [rows, setRows] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [search, setSearch] = useState("");
  useEffect(() => {
    request("/archive")
      .then(setRows)
      .catch((e) => setError(problem(e)));
  }, []);
  return (
    <div className="workspace">
      <header className="work-heading">
        <div>
          <p className="eyebrow">Completed & closed work</p>
          <h1>Work history.</h1>
          <p>
            Recent 500 records. Closed reviews and order follow-ups stay
            available here.
          </p>
        </div>
      </header>
      <ErrorMessage message={error} />
      <label className="work-search">
        <Search size={17} />
        <input
          aria-label="Search history"
          placeholder="Search order, review or employee"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="archive-list">
        {rows
          .filter((r) =>
            JSON.stringify([
              r.orderNumber,
              r.assigneeName,
              r.attempts,
              r.closedReason,
            ])
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((r) => (
            <article key={r._id}>
              <div>
                <h3>
                  {r.orderNumber || r.sourceOrder?.orderNumber || r.taskNumber}
                </h3>
                <p>
                  {title[r.type] || r.type} · {r.assigneeName}
                </p>
              </div>
              <span className="work-badge">
                {r.closedReason || "Completed"}
              </span>
              <p>
                {r.attempts?.at(-1)?.notes ||
                  r.metadata?.legacy?.review ||
                  r.metadata?.legacy?.notes}
              </p>
              <small>{time(r.completedAt || r.closedAt)}</small>
            </article>
          ))}
      </div>
    </div>
  );
}
