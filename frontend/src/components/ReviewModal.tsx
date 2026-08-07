import { useState } from 'react';
import { X, Star, Send } from 'lucide-react';

interface ReviewData {
  text: string;
  platformSatisfied: 'yes' | 'no' | 'other' | '';
  platformSatisfiedOther: string;
  deliverySatisfied: 'yes' | 'no' | 'other' | '';
  deliverySatisfiedOther: string;
  willUseAgain: 'yes' | 'no' | 'other' | '';
  willUseAgainOther: string;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReviewData) => Promise<void>;
  orderId: string;
}

const QUESTIONS = [
  {
    key: 'platformSatisfied',
    label: 'Satisfied with the platform?',
    otherKey: 'platformSatisfiedOther',
  },
  {
    key: 'deliverySatisfied',
    label: 'Satisfied with the delivery?',
    otherKey: 'deliverySatisfiedOther',
  },
  {
    key: 'willUseAgain',
    label: 'Will you use Nepalcan.com again?',
    otherKey: 'willUseAgainOther',
  },
];

export default function ReviewModal({ isOpen, onClose, onSubmit, orderId }: ReviewModalProps) {
  const [data, setData] = useState<ReviewData>({
    text: '',
    platformSatisfied: '',
    platformSatisfiedOther: '',
    deliverySatisfied: '',
    deliverySatisfiedOther: '',
    willUseAgain: '',
    willUseAgainOther: '',
  });
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (key: string, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.text.trim()) return;
    setSaving(true);
    try {
      await onSubmit(data);
      onClose();
    } catch {
      // error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in-fast">
      <div className="bg-[#ffffff] card-blueprint p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#0a0a0a]">Review Order #{orderId}</h3>
          <button onClick={onClose} className="p-1 rounded-xl hover:bg-[#f5f5f5] cursor-pointer">
            <X className="w-4 h-4 text-[#737373]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#0a0a0a] mb-1">Your Review</label>
            <textarea
              value={data.text}
              onChange={e => handleChange('text', e.target.value)}
              rows={3}
              placeholder="Share your experience..."
              className="input-blueprint w-full text-xs resize-none"
              required
            />
          </div>

          {QUESTIONS.map(q => (
            <div key={q.key}>
              <label className="block text-xs font-bold text-[#0a0a0a] mb-2">{q.label}</label>
              <div className="flex gap-2">
                {(['yes', 'no', 'other'] as const).map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleChange(q.key, opt)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      data[q.key] === opt
                        ? opt === 'yes'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : opt === 'no'
                          ? 'bg-red-50 border-red-300 text-red-800'
                          : 'bg-amber-50 border-amber-300 text-amber-800'
                        : 'bg-[#fafafa] border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]'
                    }`}
                  >
                    {opt === 'yes' ? '✓ Yes' : opt === 'no' ? '✗ No' : 'Other'}
                  </button>
                ))}
              </div>
              {data[q.key] === 'other' && (
                <input
                  type="text"
                  value={data[q.otherKey]}
                  onChange={e => handleChange(q.otherKey, e.target.value)}
                  placeholder="Please specify..."
                  className="input-blueprint w-full mt-2 text-xs"
                />
              )}
            </div>
          ))}

          <div className="pt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-4 py-2 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !data.text.trim()}
              className="btn-primary text-xs px-4 py-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Submit Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}