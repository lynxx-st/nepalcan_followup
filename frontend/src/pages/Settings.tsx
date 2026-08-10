import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { settingsApi } from '../services/api';
import { Settings as SettingsIcon, Save, Truck } from 'lucide-react';

const FIELDS = [
  { key: 'logisticsFollowupHours', label: 'Logistics Follow-up Hours', desc: 'Hours after which a logistics followup task is created for a non-picked-up processing order', type: 'number' },
  { key: 'logisticsFollowupSlaMinutes', label: 'Logistics Follow-up SLA (min)', desc: 'SLA in minutes for logistics followup tasks. Past this = overdue.', type: 'number' },
  { key: 'customerConfirmationSlaMinutes', label: 'Customer Confirmation SLA (min)', desc: 'Customer confirmation task must be completed within this time. Past this = overdue.', type: 'number' },
  { key: 'vendorCallSlaMinutes', label: 'Vendor Call SLA (min)', desc: 'Vendor call task must be completed within this time. Past this = overdue.', type: 'number' },
  { key: 'cancelledRecoverySlaMinutes', label: 'Cancelled Recovery SLA (min)', desc: 'Recovery attempt for cancelled orders — SLA in minutes. Task turns critical past this.', type: 'number' },
  { key: 'reviewCallSlaMinutes', label: 'Review Call SLA (min)', desc: 'Review call for delivered orders — SLA in minutes (default 24h). Task overdue past this.', type: 'number' },
  { key: 'reviewFollowupDelayHours', label: 'Review Follow-up Delay (Hours)', desc: 'After how many hours does the order come up in pending review calls after being delivered.', type: 'number' },
  { key: 'pendingReviewStartDate', label: 'Pending Review Start Date', desc: 'Orders placed before this date are hidden from After Delivery → Pending Review Calls. Leave empty to show all.', type: 'date' },
  { key: 'returnCustomerResponseSlaMinutes', label: 'Return Customer Response SLA (min)', desc: 'SLA in minutes for contacting customer after return request is initiated.', type: 'number' },
  { key: 'returnVendorResponseSlaMinutes', label: 'Return Vendor Response SLA (min)', desc: 'SLA in minutes for obtaining vendor response/approval for return.', type: 'number' },
  { key: 'escalationSlaMinutes', label: 'Escalation SLA (min)', desc: 'SLA in minutes for escalation tasks.', type: 'number' },
  { key: 'priorityAmountThreshold', label: 'Priority Amount Threshold (Rs)', desc: 'Orders with total amount above this value get priority bumped one level (e.g. medium → high).', type: 'number' },
  { key: 'shippedSlaFromCreationHours', label: 'Shipped SLA — From Creation (hours)', desc: 'SLA hours for shipped orders starting from order creation time.', type: 'number' },
  { key: 'shippedSlaFromPickupHours', label: 'Shipped SLA — From Pickup Collected (hours)', desc: 'SLA hours for shipped non-heavy logistics orders after pickup collected.', type: 'number' },
  { key: 'commerceApiBase', label: 'Commerce API Base URL', desc: 'Base URL for the external commerce API (e.g. https://commerce.thecanbrand.com/api). Used for logistics comments and delivery zone group fetching.', type: 'text' },
  { key: 'commentSlaThresholdMinutes', label: 'Comment SLA Threshold (min)', desc: 'Minutes after which the SLA is considered breached and the comment button appears on shipped orders.', type: 'number' },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then((res: any) => {
      setValues(res.data || {});
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load settings');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update(values);
      toast.success('Settings saved — next sync will use new values');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-[#737373] text-lg">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in pb-16 sm:pb-0">
      <div className="card-blueprint p-6">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-[#0a0a0a] text-white flex items-center justify-center shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-[#0a0a0a]">System Settings</h1>
            <p className="text-xs text-[#737373] mt-1">Configure follow-up rules, SLAs, and thresholds. Changes apply on next sync.</p>
          </div>
        </div>
      </div>

      <section className="card-blueprint p-6 space-y-6">
        <div className="border-b border-[#e5e5e5] pb-4">
          <h2 className="text-lg font-bold text-[#0a0a0a] flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#737373]" />
            Delivery Zones
          </h2>
          <p className="text-xs text-[#737373] mt-1">Branch lists are fetched from the commerce API at setup (seed). SLA hours apply to shipped orders per zone.</p>
        </div>
        {(Array.isArray(values.deliveryZones) ? values.deliveryZones : []).map((zone: any) => (
          <div key={zone.key} className="border border-[#e5e5e5] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0a0a0a]">{zone.label}</span>
              <span className="text-xs text-[#737373]">{Array.isArray(zone.branches) ? zone.branches.length : 0} branches</span>
            </div>
            <div>
              <p className="text-xs text-[#737373] mb-1">Expected delivery SLA (hours)</p>
              <input
                type="number"
                value={zone.slaHours ?? ''}
                onChange={(e) => setValues((v: any) => ({
                  ...v,
                  deliveryZones: (v.deliveryZones || []).map((z: any) => z.key === zone.key ? { ...z, slaHours: Number(e.target.value) } : z),
                }))}
                className="input-blueprint w-full"
              />
            </div>
          </div>
        ))}
      </section>

      <section className="card-blueprint p-6 space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-bold text-[#0a0a0a] mb-1">{field.label}</label>
            <p className="text-xs text-[#737373] mb-2">{field.desc}</p>
            <input
              type={field.type}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v: any) => ({ ...v, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
              className="input-blueprint w-full"
            />
          </div>
        ))}
      </section>

      <button onClick={handleSave} disabled={saving}
        className="btn-primary w-full py-4 disabled:opacity-50 cursor-pointer">
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}