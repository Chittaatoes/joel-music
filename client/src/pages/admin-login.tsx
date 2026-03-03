import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
const logoPath = "/images/logo.png";

export default function AdminLoginPage() {
  const [, setLocation] = useLocation();

  const [username, setUsername] = useState(() => localStorage.getItem("jms_admin_user") || "");
  const [password, setPassword] = useState(() => localStorage.getItem("jms_admin_pass") || "");
  const [saveCredentials, setSaveCredentials] = useState(
    () => !!(localStorage.getItem("jms_admin_user") && localStorage.getItem("jms_admin_pass"))
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/me`, { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          setLocation("/admin/dashboard");
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Login gagal");
        setLoading(false);
        return;
      }

      if (saveCredentials) {
        localStorage.setItem("jms_admin_user", username);
        localStorage.setItem("jms_admin_pass", password);
      } else {
        localStorage.removeItem("jms_admin_user");
        localStorage.removeItem("jms_admin_pass");
      }

      setLocation("/admin/dashboard");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-sm">
        <div className="px-8 pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
            data-testid="link-back-home"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </div>
        <div className="flex flex-col items-center pt-4 pb-4 px-8">
          <img
            src={logoPath}
            alt="Joel Music Studio Logo"
            className="w-16 h-16 object-contain mb-4"
            data-testid="img-logo"
          />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center" data-testid="text-title">
            Admin Joel Music Studio
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2" data-testid="text-subtitle">
            Masukkan username dan password untuk login
          </p>
        </div>

        <form onSubmit={handleLogin} className="px-8 pb-8 pt-2 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Username
            </label>
            <input
              type="text"
              placeholder="Username"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="input-username"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="save-credentials"
              checked={saveCredentials}
              onChange={(e) => setSaveCredentials(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-teal-600 focus:ring-teal-500 accent-teal-600"
              data-testid="checkbox-save-credentials"
            />
            <label htmlFor="save-credentials" className="text-sm text-gray-600 dark:text-gray-400 select-none cursor-pointer">
              Simpan username & password
            </label>
          </div>

          {error && (
            <p className="text-red-500 text-sm" data-testid="text-error">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white py-2.5 rounded-md font-medium transition"
            data-testid="button-login"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
