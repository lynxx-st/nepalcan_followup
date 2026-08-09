import { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Send, StickyNote } from 'lucide-react';

const actorInitials = (name: string): string =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

export default function OrderNotes({ notes, onAddNote }: { notes: any[]; onAddNote: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onAddNote(trimmed);
      setText('');
      toast.success('Note added');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setSaving(false);
    }
  };

  const sorted = [...(notes || [])].reverse();

  return (
    <div className="card-blueprint p-4 space-y-3 bg-[#ffffff]">
      <h3 className="text-xs font-bold text-[#0a0a0a] flex items-center justify-between gap-2 uppercase tracking-wider border-b border-[#e5e5e5] pb-2">
        <span className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[#dc3545]" />
          Order Notes & Audit Log
        </span>
        {sorted.length > 0 && (
          <span className="text-[10px] font-bold text-[#737373] bg-[#f5f5f5] rounded-full px-2 py-0.5">
            {sorted.length}
          </span>
        )}
      </h3>

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="text"
          value={text}
          disabled={saving}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type note or call summary..."
          className="input-blueprint flex-1 text-xs"
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          className="btn-primary text-xs px-4 py-1.5 cursor-pointer disabled:opacity-50 min-h-[44px]"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Add Note</span>
        </button>
      </form>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">
        {sorted.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-[#737373] py-2">
            <StickyNote className="w-3.5 h-3.5" />
            No notes recorded yet.
          </p>
        ) : (
          sorted.map((n: any, idx: number) => {
            const actor = n.actorName || n.actor || 'System';
            const isSystem = actor === 'System';
            const at = n.createdAt ? new Date(n.createdAt) : new Date();
            return (
              <div key={n._id || idx} className="bg-[#fafafa] border border-[#e5e5e5] p-2.5 rounded-xl flex gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isSystem ? 'bg-[#f5f5f5] text-[#737373]' : 'bg-[#0a0a0a] text-[#ffffff]'
                }`}>
                  {actorInitials(actor)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-semibold text-[#0a0a0a]">
                      {actor}
                    </p>
                    <p className="text-[10px] text-[#737373] shrink-0" title={at.toLocaleString()}>
                      {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {at.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-xs text-[#0a0a0a] mt-0.5 break-words whitespace-pre-wrap">{n.note || n.comment}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}