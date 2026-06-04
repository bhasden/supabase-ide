import { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { ClearLocalDataCategory } from '../lib/storage';

const CATEGORY_OPTIONS: Array<{
  id: Exclude<ClearLocalDataCategory, 'all'>;
  label: string;
  description: string;
}> = [
  {
    id: 'connections',
    label: 'Connections',
    description: 'Clear connections, API keys, saved tables, filters, and active selection.',
  },
  {
    id: 'tables',
    label: 'Tables',
    description: 'Clear saved table names and columns while keeping connections.',
  },
  {
    id: 'filters',
    label: 'Filters',
    description: 'Clear saved filters and ordering for all saved tables.',
  },
];

interface ClearLocalDataDialogProps {
  onClose: () => void;
  onConfirm: (categories: ClearLocalDataCategory[]) => void;
}

export default function ClearLocalDataDialog({
  onClose,
  onConfirm,
}: ClearLocalDataDialogProps) {
  const [selected, setSelected] = useState<Set<Exclude<ClearLocalDataCategory, 'all'>>>(
    new Set()
  );
  const allSelected = CATEGORY_OPTIONS.every((option) => selected.has(option.id));
  const hasSelection = selected.size > 0;

  const toggleCategory = (category: Exclude<ClearLocalDataCategory, 'all'>) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(CATEGORY_OPTIONS.map((option) => option.id)));
  };

  const handleConfirm = () => {
    if (!hasSelection) return;
    onConfirm(allSelected ? ['all'] : Array.from(selected));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-slate-200">Clear Local Data</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/40 p-3">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="mt-0.5 accent-emerald-500"
            />
            <span>
              <span className="block text-sm font-medium text-slate-200">All</span>
              <span className="block text-xs text-slate-500">
                Clear every saved local setting and return to setup.
              </span>
            </span>
          </label>

          {CATEGORY_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-3 rounded-lg border border-slate-800 p-3 hover:border-slate-700 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(option.id)}
                onChange={() => toggleCategory(option.id)}
                className="mt-0.5 accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-medium text-slate-300">{option.label}</span>
                <span className="block text-xs text-slate-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasSelection}
            className="px-3 py-1.5 rounded-md text-xs bg-red-600 text-white hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
          >
            Clear Selected
          </button>
        </div>
      </div>
    </div>
  );
}
