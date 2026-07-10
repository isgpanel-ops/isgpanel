export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="text-lg font-semibold text-[#0a2b45]">{title}</div>
            <button onClick={onClose} className="px-3 py-1 rounded-lg border text-sm hover:bg-gray-50">Kapat</button>
          </div>
          <div className="p-4 max-h-[80vh] overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
