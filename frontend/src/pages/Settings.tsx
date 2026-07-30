import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { settingsApi } from '../services/api';
import { Settings, Save } from 'lucide-react';

const FIELDS = [
  { key: 'logisticsFollowupHours', label: 'Logistics Follow-up Hours', desc: 'Hours after which a Processing order with no logistics pickup gets a logistics-followup task', type: 'number' },
  { key: 'logisticsFollowupSlaMinutes', label: 'Logistics Follow-up SLA (min)', desc: 'SLA in minutes for logistics followup tasks. Past this = overdue.', type: 'number' },
  { key: 'customerConfirmationSlaMinutes', label: 'Customer Confirmation SLA (min)', desc: 'Customer confirmation task must be completed within this time. Past this = overdue.', type: 'number' },
  { key: 'vendorCallSlaMinutes', label: 'Vendor Call SLA (min)', desc: 'Vendor call task must be completed within this time. Past this = overdue.', type: 'number' },
  { key: 'cancelledRecoverySlaMinutes', label: 'Cancelled Recovery SLA (min)', desc: 'Recovery attempt for cancelled orders — SLA in minutes. Task turns critical past this.', type: 'number' },
  { key: 'reviewCallSlaMinutes', label: 'Review Call SLA (min)', desc: 'Review call for delivered orders — SLA in minutes (default 24h). Task overdue past this.', type: 'number' },
  { key: 'escalationSlaMinutes', label: 'Escalation SLA (min)', desc: 'SLA in minutes for escalation tasks.', type: 'number' },
  { key: 'priorityAmountThreshold', label: 'Priority Amount Threshold (Rs)', desc: 'Orders with total amount above this Rs value get priority bumped one level (e.g. medium → high).', type: 'number' },
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
    return <div className="flex items-center justify-center h-64 text-slate-500 text-lg">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in">
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white rounded-2xl p-6 border border-indigo-500 shadow-lg">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6" />
          <div>
            <h1 className="text-2xl font-black">System Settings</h1>
            <p className="text-sm text-indigo-200 mt-1">Configure follow-up rules, SLAs, and thresholds. Changes apply on next sync.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-bold text-slate-900 mb-1">{field.label}</label>
            <p className="text-xs text-slate-500 mb-2">{field.desc}</p>
            <input type={field.type} value={values[field.key] ?? ''} onChange={(e) => setValues(v => ({ ...v, [field.key]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        ))}

        <div className="pt-4 border-t border-slate-200">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all disabled:opacity-50 cursor-pointer w-full sm:w-auto">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
