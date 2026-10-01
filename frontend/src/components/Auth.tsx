import { useState } from "react";
import type { FormEvent } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
subscriptionPlan: "FREE" | "PRO";
subscriptionStatus: "ACTIVE" | "CANCELED" | "EXPIRED";
subscriptionExpiresAt: string | null;
}

interface AuthResponse {
  user: AuthUser;
  token: string;
}

interface AuthProps {
  onLogin: (user: AuthUser, token: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [mode, setMode] = useState<"login" | "register">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login"
          ? "/api/auth/login"
          : "/api/auth/register";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Authentication failed.",
        );
      }

      const authData = data as AuthResponse;

      localStorage.setItem("velora_token", authData.token);
      localStorage.setItem(
        "velora_user",
        JSON.stringify(authData.user),
      );

      onLogin(authData.user, authData.token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>

          <div>
            <div className="brand-name">VELORA</div>
            <div className="brand-subtitle">
              MARKET INTELLIGENCE
            </div>
          </div>
        </div>

        <div className="auth-kicker">
          {mode === "login"
            ? "WELCOME BACK"
            : "CREATE ACCOUNT"}
        </div>

        <h1>
          {mode === "login"
            ? "Access the terminal."
            : "Start reading the market."}
        </h1>

        <p className="auth-description">
          {mode === "login"
            ? "Sign in to access your market intelligence dashboard."
            : "Create your VELORA account to access the market scanner."}
        </p>

        <form onSubmit={handleSubmit}>
          <label className="auth-label">
            EMAIL

            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="auth-label">
            PASSWORD

            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder="Minimum 8 characters"
              autoComplete={
                mode === "login"
                  ? "current-password"
                  : "new-password"
              }
            />
          </label>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "PLEASE WAIT..."
              : mode === "login"
                ? "SIGN IN"
                : "CREATE ACCOUNT"}
          </button>
        </form>

        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                CREATE ONE
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                SIGN IN
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
