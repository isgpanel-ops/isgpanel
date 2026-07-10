import { useNavigate, useParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";

export default function RegisterSuccess() {
  const { role } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
        <FaCheckCircle className="mx-auto text-green-500 text-6xl mb-6" />
        <h2 className="text-xl font-bold mb-4">Kayıt Başarılı!</h2>
        <p className="text-gray-600 mb-6">
          Tebrikler, {role === "uzman" ? "uzman" : "OSGB"} hesabınız oluşturuldu.
        </p>
        <button onClick={() => navigate(`/login/${role}`)} className={`w-full ${role === "uzman" ? "bg-blue-600" : "bg-green-600"} text-white font-semibold py-2 rounded-lg`}>
          Giriş Yap
        </button>
      </div>
    </div>
  );
}
