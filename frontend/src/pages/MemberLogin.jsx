import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";

export default function MemberLogin() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { loginOrg } = useApp();

    const [orgSlug, setOrgSlug] = useState(params.get("slug") || "");
    const [email, setEmail] = useState(params.get("email") || "");
    const [password, setPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        const slug = orgSlug.trim().toLowerCase();
        const emailValue = email.trim().toLowerCase();
        if (!slug) { setError("Organisation identifier is required."); return; }
        if (!emailValue) { setError("Email is required."); return; }
        if (!password) { setError("Password is required."); return; }
        setBusy(true);
        try {
            const result = await api.loginOrgMember({ org_slug: slug, email: emailValue, password });
            // Store token the same way org accounts work so the dashboard guard passes.
            // loginOrg stores { token, slug, orgName } into localStorage and sets role.
            if (loginOrg && result.token && result.slug) {
                loginOrg(result.token, result.slug, result.org_name || result.slug);
            } else {
                // Fallback: persist directly so AuthContext picks up on next load.
                const raw = JSON.parse(localStorage.getItem("rn-org-tokens") || "{}");
                raw[result.slug] = result.token.replace("Bearer ", "");
                localStorage.setItem("rn-org-tokens", JSON.stringify(raw));
                localStorage.setItem("rn-active-org", result.slug);
            }
            toast.success(`Signed in to ${result.org_name || result.slug}`);
            navigate("/organisation-dashboard");
        } catch (err) {
            setError(err?.response?.data?.detail || "Invalid email, password or organisation. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
                        <KeyRound className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="font-display font-black text-3xl tracking-tight">Member sign in</h1>
                    <p className="text-muted-foreground mt-2 text-sm">Sign in with your organisation member account.</p>
                </div>

                {error && (
                    <div className="mb-6 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                <form onSubmit={submit} className="rounded-3xl border border-border bg-surface p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Organisation <span className="text-destructive">*</span></label>
                        <input
                            type="text"
                            value={orgSlug}
                            onChange={(e) => setOrgSlug(e.target.value)}
                            placeholder="Organisation slug (e.g. blackrod-scouts)"
                            className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm"
                            required
                            autoComplete="organization"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">Found in your invitation email.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Email <span className="text-destructive">*</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm"
                            required
                            autoComplete="email"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Password <span className="text-destructive">*</span></label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Your password"
                                className="w-full px-4 py-3 pr-10 rounded-2xl border border-border bg-background text-sm"
                                required
                                autoComplete="current-password"
                            />
                            <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground">
                                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-60"
                    >
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                    <div className="text-center space-y-2 text-xs text-muted-foreground">
                        <p>Got an invite email?{" "}
                            <Link to="/member/redeem" className="font-semibold text-primary hover:underline">Activate your account first</Link>
                        </p>
                        <p>Organisation admin?{" "}
                            <Link to="/" className="font-semibold text-primary hover:underline">Sign in here</Link>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}
