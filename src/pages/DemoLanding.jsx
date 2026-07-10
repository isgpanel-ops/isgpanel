import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hardResetForAuth } from "../utils/authHardReset";

export default function DemoLanding() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    // demo login → token’ı yaz, panele gir
    // basit jwt parse (payload)
const payload = JSON.parse(atob(token.split(".")[1]));
const email = payload?.email || "";

hardResetForAuth(email, token, null, "/panel");

  }, [location, navigate]);

  return null; // ekran göstermiyoruz
}
