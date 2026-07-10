import { FaCheckCircle } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function SuccessPopup({ onClose }) {
  const navigate = useNavigate();

  const handleLoginRedirect = () => {
    onClose();
    navigate("/login/uzman");
  };

  return (
    <div className="popup-backdrop">
      <div className="popup-card">
        <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-4">🎉 Kayıt başarılı!</h2>
        <button onClick={handleLoginRedirect} className="btn btn-blue w-full">
          Giriş Yap
        </button>
      </div>
    </div>
  );
}
