import React from "react";

export default function ReviewCandidates({ open, onClose, candidates = [], onConfirm }) {
  const [selected, setSelected] = React.useState([]);

  React.useEffect(() => {
    setSelected(candidates.map((c) => ({ ...c, selected: true })));
  }, [candidates]);

  if (!open) return null;

  function update(i, patch) {
    setSelected((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="card p-5 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="h2">Review & confirm</h3>
          <button className="button-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <ul className="space-y-3 max-h-[60vh] overflow-auto">
          {selected.map((item, idx) => (
            <li
              key={idx}
              className="border border-white/10 rounded-xl p-3 grid grid-cols-12 gap-2 items-center"
            >
              <input
                type="checkbox"
                className="col-span-1"
                checked={item.selected}
                onChange={(e) => update(idx, { selected: e.target.checked })}
              />
              <input
                className="input col-span-5"
                value={item.name}
                onChange={(e) => update(idx, { name: e.target.value })}
              />
              <input
                className="input col-span-2"
                value={item.qty}
                onChange={(e) =>
                  update(idx, { qty: Number(e.target.value) || 0 })
                }
              />
              <input
                className="input col-span-2"
                value={item.unit}
                onChange={(e) => update(idx, { unit: e.target.value })}
              />
              <input
                className="input col-span-2"
                value={item.calories}
                onChange={(e) =>
                  update(idx, { calories: Number(e.target.value) || 0 })
                }
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-end gap-2">
          <button className="button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button"
            onClick={() => onConfirm(selected.filter((s) => s.selected))}
          >
            Add selected
          </button>
        </div>
      </div>
    </div>
  );
}
