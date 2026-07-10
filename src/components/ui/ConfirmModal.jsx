export default function ConfirmModal({
  open,
  title = "Bilgilendirme",
  message,
  confirmText = "Tamam",
  cancelText = "İptal",
  onConfirm,
  onCancel,
  variant = "info", // info | warning | danger
}) {
  if (!open) return null;

  const color =
    variant === "warning"
      ? "text-yellow-600"
      : variant === "danger"
      ? "text-red-600"
      : "text-blue-600";

  // ✅ Soldaki boş kutu sorunu: Cancel sadece gerçekten varsa görünsün
  const showCancel = !!onCancel && !!cancelText && String(cancelText).trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2000] flex items-center justify-center">
      <div className="bg-white rounded-xl w-[420px] max-w-[95vw] p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xl ${color}`}>ℹ️</span>
          <h3 className="font-semibold">{title}</h3>
        </div>

        <p className="text-sm text-gray-700 whitespace-pre-line mb-4">
          {message}
        </p>

        <div className="flex justify-end gap-2">
          {showCancel && (
            <button
              type="button"
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={onConfirm || onCancel}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
