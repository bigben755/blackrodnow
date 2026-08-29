import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function OrgMemberRedeem() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const initialToken = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

    const [token, setToken] = useState(initialToken);
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!token.trim()) return toast.error("Invite token is required");
        if (!password) return toast.error("Password is required");
        if (password.length < 8) return toast.error("Password must be at least 8 characters");
        if (password !== confirm) return toast.error("Passwords do not match");

        setBusy(true);
        try {
            const res = await api.redeemOrgMemberInvite({
                token: token.trim(),
                name: name.trim(),
                password,
            });
            toast.success("Invite redeemed. You can now sign in.");
            const org = encodeURIComponent(res?.org_slug || "");
            const email = encodeURIComponent(res?.email || "");
            navigate(`/organisation/member/login?org=${org}&email=${email}`);
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Could not redeem invite");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="org-member-redeem-page" className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="rounded-3xl border border-border bg-surface p-8">
                <h1 className="font-display font-black text-3xl tracking-tight">Redeem member invite</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Set your password to activate organisation member access.
                </p>

                <div className="mt-6 grid gap-3">
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Invite token</span>
                        <input
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            placeholder="Paste your invite token"
                        />
                    </label>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your name (optional)</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                            placeholder="How your name should appear"
                        />
                    </label>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm password</span>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submit();
                            }}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                </div>

                <div className="mt-6 flex gap-2 flex-wrap">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={submit}
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-60"
                    >
                        {busy ? "Activating..." : "Activate member access"}
                    </button>
                    <Link
                        to="/organisation/member/login"
                        className="px-4 py-2 rounded-full border border-border text-sm font-semibold"
                    >
                        Go to member login
                    </Link>
                </div>
            </div>
        </div>
    );
}
