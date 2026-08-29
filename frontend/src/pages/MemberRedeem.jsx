import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { KeyRound, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function MemberRedeem() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token") || "";

    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [orgSlug, setOrgSlug] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!token) setError("No invitation token found in the link. Check your email and try again.");
    }, [token]);

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        setBusy(true);
        try {
            const result = await api.redeemOrgMemberInvite({ token, name: name.trim(), password });
            setOrgSlug(result.org_slug || "");
            setDone(true);
            toast.success("Account activated! You can now sign in.");
        } catch (err) {
            setError(err?.response?.data?.detail || "Could not redeem invite. The link may have expired or already been used.");
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="h-16 w-16 rounded-full bg-secondary/20 grid place-items-center mx-auto mb-6">
                        <CheckCircle className="h-8 w-8 text-secondary" />
                    </div>
                    <h1 className="font-display font-black text-3xl tracking-tight">All set!</h1>
                    <p className="text-muted-foreground mt-3">Your account has been activated. Sign in to access the organisation dashboard.</p>
                    <div className="mt-8 flex flex-col gap-3">
                        <Link
                            to={`/member/login${orgSlug ? `?slug=${orgSlug}` : ""}`}
                            className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold"
                        >
                            <KeyRound className="h-4 w-4" /> Sign in to dashboard
                        </Link>
                        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Back to homepage</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
                        <KeyRound className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="font-display font-black text-3xl tracking-tight">Activate your account</h1>
                    <p className="text-muted-foreground mt-2 text-sm">Set a password to complete your invitation and get access to the organisation dashboard.</p>
                </div>

                {error && (
                    <div className="mb-6 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        {error}
                    </div>
                )}

                {!token && !error && (
                    <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                        This page requires an invitation link from your email. Please check your inbox and click the activation link.
                    </div>
                )}

                {token && (
                    <form onSubmit={submit} className="rounded-3xl border border-border bg-surface p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Your name (optional)</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Displayed on the dashboard"
                                className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm"
                                autoComplete="name"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Password <span className="text-destructive">*</span></label>
                            <div className="relative">
                                <input
                                    type={showPass ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    className="w-full px-4 py-3 pr-10 rounded-2xl border border-border bg-background text-sm"
                                    required
                                    autoComplete="new-password"
                                />
                                <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground">
                                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Confirm password <span className="text-destructive">*</span></label>
                            <input
                                type={showPass ? "text" : "password"}
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat password"
                                className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm"
                                required
                                autoComplete="new-password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={busy || !password || !confirm}
                            className="w-full py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:opacity-60"
                        >
                            {busy ? "Activating…" : "Activate account"}
                        </button>
                        <p className="text-center text-xs text-muted-foreground">
                            Already have an account?{" "}
                            <Link to="/member/login" className="font-semibold text-primary hover:underline">Sign in</Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
