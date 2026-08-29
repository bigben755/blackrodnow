import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useApp } from "@/context/AppContext";

export default function OrgMemberLogin() {
    const { orgs, unlockOrgAccess, setActiveOrgSlug, setRole } = useApp();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const orgFromQuery = useMemo(() => (searchParams.get("org") || "").trim(), [searchParams]);
    const emailFromQuery = useMemo(() => (searchParams.get("email") || "").trim(), [searchParams]);

    const [orgSlug, setOrgSlug] = useState(orgFromQuery);
    const [email, setEmail] = useState(emailFromQuery);
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!orgSlug && orgs.length) {
            setOrgSlug(orgs[0].slug);
        }
    }, [orgSlug, orgs]);

    const submit = async () => {
        if (!orgSlug) return toast.error("Select an organisation");
        if (!email.trim() || !password) return toast.error("Email and password are required");

        setBusy(true);
        try {
            const res = await api.loginOrgMember({ org_slug: orgSlug, email: email.trim(), password });
            const token = res?.token || "";
            if (!token) throw new Error("Missing token from member login response");

            unlockOrgAccess(orgSlug, token);
            setActiveOrgSlug(orgSlug);
            setRole("org");
            toast.success("Signed in as organisation member");
            navigate("/organisation-dashboard");
        } catch (error) {
            toast.error(error?.response?.data?.detail || "Member login failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="org-member-login-page" className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="rounded-3xl border border-border bg-surface p-8">
                <h1 className="font-display font-black text-3xl tracking-tight">Organisation member login</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    Use your invited member account to open the organisation dashboard.
                </p>

                <div className="mt-6 grid gap-3">
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organisation</span>
                        <select
                            value={orgSlug}
                            onChange={(e) => setOrgSlug(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        >
                            {orgs.map((o) => (
                                <option key={o.slug} value={o.slug}>{o.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
                        <input
                            type="email"
                            autoComplete="username"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="mt-1 w-full px-3 py-2 rounded-2xl border border-border bg-background"
                        />
                    </label>
                    <label className="text-sm block">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
                        <input
                            type="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                        {busy ? "Signing in..." : "Sign in"}
                    </button>
                    <Link to="/organisation/member/redeem" className="px-4 py-2 rounded-full border border-border text-sm font-semibold">
                        Redeem invite
                    </Link>
                </div>
            </div>
        </div>
    );
}
