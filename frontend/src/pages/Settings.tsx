import { useState, useEffect } from "react";
import { toast } from "sonner";
import { settingsApi } from "../services/api";
import { Settings as SettingsIcon, Save, Truck } from "lucide-react";

const FIELDS = [
  {
    key: "logisticsFollowupHours",
    label: "Logistics Follow-up Hours",
    desc: "Hours after which a logistics followup task is created for a non-picked-up processing order",
    type: "number",
  },
  {
    key: "logisticsFollowupSlaMinutes",
    label: "Logistics Follow-up SLA (min)",
    desc: "SLA in minutes for logistics followup tasks. Past this = overdue.",
    type: "number",
  },
  {
    key: "customerConfirmationSlaMinutes",
    label: "Customer Confirmation SLA (min)",
    desc: "Customer confirmation task must be completed within this time. Past this = overdue.",
    type: "number",
  },
  {
    key: "vendorCallSlaMinutes",
    label: "Vendor Call SLA (min)",
    desc: "Vendor call task must be completed within this time. Past this = overdue.",
    type: "number",
  },
  {
    key: "cancelledRecoverySlaMinutes",
    label: "Cancelled Recovery SLA (min)",
    desc: "Recovery attempt for cancelled orders — SLA in minutes. Task turns critical past this.",
    type: "number",
  },
  {
    key: "reviewCallSlaMinutes",
    label: "Review Call SLA (min)",
    desc: "Review call for delivered orders — SLA in minutes (default 24h). Task overdue past this.",
    type: "number",
  },
  {
    key: "reviewFollowupDelayHours",
    label: "Review Follow-up Delay (Hours)",
    desc: "After how many hours does the order come up in pending review calls after being delivered.",
    type: "number",
  },
  {
    key: "pendingReviewStartDate",
    label: "Pending Review Start Date",
    desc: "Orders placed before this date are hidden from After Delivery → Pending Review Calls. Leave empty to show all.",
    type: "date",
  },
  {
    key: "returnCustomerResponseSlaMinutes",
    label: "Return Customer Response SLA (min)",
    desc: "SLA in minutes for contacting customer after return request is initiated.",
    type: "number",
  },
  {
    key: "returnVendorResponseSlaMinutes",
    label: "Return Vendor Response SLA (min)",
    desc: "SLA in minutes for obtaining vendor response/approval for return.",
    type: "number",
  },
  {
    key: "escalationSlaMinutes",
    label: "Escalation SLA (min)",
    desc: "SLA in minutes for escalation tasks.",
    type: "number",
  },
  {
    key: "priorityAmountThreshold",
    label: "Priority Amount Threshold (Rs)",
    desc: "Orders with total amount above this value get priority bumped one level (e.g. medium → high).",
    type: "number",
  },
  {
    key: "shippedSlaFromCreationHours",
    label: "Shipped SLA — From Creation (hours)",
    desc: "SLA hours for shipped orders starting from order creation time.",
    type: "number",
  },
  {
    key: "shippedSlaFromPickupHours",
    label: "Shipped SLA — From Pickup Collected (hours)",
    desc: "SLA hours for shipped non-heavy logistics orders after pickup collected.",
    type: "number",
  },
  {
    key: "commerceApiBase",
    label: "Commerce API Base URL",
    desc: "Base URL for the external commerce API (e.g. https://commerce.thecanbrand.com/api). Used for logistics comments and delivery zone group fetching.",
    type: "text",
  },
  {
    key: "commentSlaThresholdMinutes",
    label: "Comment SLA Threshold (min)",
    desc: "Minutes after which the SLA is considered breached and the comment button appears on shipped orders.",
    type: "number",
  },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    settingsApi
      .get()
      .then((res: any) => {
        setValues(res.data || {});
        setSaved(res.data || {});
        setLoading(false);
      })
      .catch(() => {
        setLoadFailed(true);
        setError("Settings could not be loaded. Reload this page before editing.");
        setLoading(false);
      });
  }, []);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || loadFailed) return;
    // Read committed browser inputs, including a date typed immediately before Save.
    const form = new FormData(event.currentTarget);
    const next = { ...values };
    for (const field of [...FIELDS, { key: "pendingWorkStartDate", type: "date" }, { key: "confirmationOrder", type: "text" }]) {
      const raw = String(form.get(field.key) ?? "");
      next[field.key] = field.type === "number" && raw !== "" ? Number(raw) : raw;
    }
    if (Array.isArray(values.deliveryZones)) next.deliveryZones = values.deliveryZones.map((zone: any) => ({ ...zone, slaHours: Number(form.get(`zone-${zone.key}`)) }));
    const changes = Object.fromEntries(Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(saved[key]) && !(saved[key] === undefined && value === "")));
    setError("");
    setMessage("");
    if (!Object.keys(changes).length) { setMessage("No changes to save."); return; }
    setSaving(true);
    try {
      const result: any = await settingsApi.update(changes);
      setValues(result.data);
      setSaved(result.data);
      setMessage("Settings saved. Your work queues will use these values on refresh.");
      toast.success("Settings saved");
      window.dispatchEvent(new Event("orders-updated"));
    } catch (e: any) {
      const reason = e?.response?.data?.error?.message || "Could not reach the server. Your edits are still here; try saving again.";
      setError(reason);
      toast.error(reason);
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#737373] text-lg">
        Loading settings...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="max-w-3xl mx-auto space-y-6 animate-in pb-24">
      <fieldset disabled={saving || loadFailed} className="space-y-6 min-w-0">
      <div className="card-blueprint p-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#0a0a0a]">
              System Settings
            </h1>
            <p className="text-xs text-[#737373] mt-1">
              Configure follow-up rules, SLAs, and thresholds. Save your changes below.
            </p>
          </div>
        </div>
      </div>

      <section className="card-blueprint p-6 space-y-3">
        <h2 className="text-lg font-bold">Pending work window</h2>
        <p className="text-sm text-[#737373]">Show pending work for orders placed on or after this date across My Tasks, Orders, Reviews, Returns and team workload. The date starts at midnight in Nepal.</p>
        <label htmlFor="pending-work-start" className="block text-sm font-bold">Start from order date</label>
        <div className="flex gap-3 flex-wrap"><input id="pending-work-start" name="pendingWorkStartDate" type="date" className="input-blueprint" value={values.pendingWorkStartDate || ""} onChange={e => setValues(v => ({ ...v, pendingWorkStartDate: e.target.value }))} /><button type="button" className="btn-outline" onClick={() => setValues(v => ({ ...v, pendingWorkStartDate: "" }))}>Show all dates</button></div>
        <p className="text-xs text-[#737373]">{values.pendingWorkStartDate ? `Pending work before ${values.pendingWorkStartDate} will be hidden and excluded from assignment.` : "All pending work is included."} Completed work and call history are kept. Save changes to apply; clearing this date restores older pending work.</p>
      </section>

      <section className="card-blueprint p-6 space-y-3">
        <h2 className="text-lg font-bold">Pre Processing</h2>
        <label htmlFor="confirmation-order" className="block text-sm font-bold">
          Who should we confirm with first?
        </label>
        <select
          id="confirmation-order"
          name="confirmationOrder"
          className="input-blueprint w-full"
          value={values.confirmationOrder || "customer_first"}
          onChange={(e) =>
            setValues((v) => ({ ...v, confirmationOrder: e.target.value }))
          }
        >
          <option value="customer_first">Customer first</option>
          <option value="vendor_first">
            Vendor first — confirm stock availability
          </option>
        </select>
        <p className="text-sm text-[#737373]">
          Both confirmations are required before dispatch. Completed
          confirmations stay recorded. Processing, After Delivery, and return
          follow-up are unaffected.
        </p>
      </section>

      <section className="card-blueprint p-6 space-y-6">
        <div className="border-b border-[#e5e5e5] pb-4">
          <h2 className="text-lg font-bold text-[#0a0a0a] flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#737373]" />
            Delivery Zones
          </h2>
          <p className="text-xs text-[#737373] mt-1">
            Branch lists are fetched from the commerce API at setup (seed). SLA
            hours apply to shipped orders per zone.
          </p>
        </div>
        {(Array.isArray(values.deliveryZones) ? values.deliveryZones : []).map(
          (zone: any) => (
            <div
              key={zone.key}
              className="border border-[#e5e5e5] rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#0a0a0a]">
                  {zone.label}
                </span>
                <span className="text-xs text-[#737373]">
                  {Array.isArray(zone.branches) ? zone.branches.length : 0}{" "}
                  branches
                </span>
              </div>
              <div>
                <p className="text-xs text-[#737373] mb-1">
                  Expected delivery SLA (hours)
                </p>
                <input
                  type="number"
                  name={`zone-${zone.key}`}
                  min="0"
                  required
                  value={zone.slaHours ?? ""}
                  onChange={(e) =>
                    setValues((v: any) => ({
                      ...v,
                      deliveryZones: (v.deliveryZones || []).map((z: any) =>
                        z.key === zone.key
                          ? { ...z, slaHours: Number(e.target.value) }
                          : z,
                      ),
                    }))
                  }
                  className="input-blueprint w-full"
                />
              </div>
            </div>
          ),
        )}
      </section>

      <section className="card-blueprint p-6 space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label htmlFor={field.key} className="block text-sm font-bold text-[#0a0a0a] mb-1">
              {field.label}
            </label>
            <p className="text-xs text-[#737373] mb-2">{field.desc}</p>
            <input
              id={field.key}
              name={field.key}
              type={field.type}
              min={field.type === "number" ? 0 : undefined}
              step={field.type === "number" ? "any" : undefined}
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((v: any) => ({
                  ...v,
                  [field.key]:
                    field.type === "number"
                      ? Number(e.target.value)
                      : e.target.value,
                }))
              }
              className="input-blueprint w-full"
            />
          </div>
        ))}
      </section>

      </fieldset>
      <div className="sticky bottom-20 sm:bottom-4 z-20 rounded-2xl border border-[#e5e5e5] bg-white p-3 shadow-sm">
      {error && <p role="alert" className="text-sm text-red-700 mb-3">{error}</p>}
      {message && <p role="status" className="text-sm text-[#525252] mb-3">{message}</p>}
      <button
        type="submit"
        disabled={saving || loadFailed}
        className="btn-primary w-full py-4 disabled:opacity-50 cursor-pointer"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving..." : "Save Settings"}
      </button>
      </div>
    </form>
  );
}
