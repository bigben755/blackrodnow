import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { CheckCircle2, Home } from "lucide-react";

export default function Unsubscribe() {
    const { token } = useParams();
    const [state, setState] = useState({ loading: true, ok: false, err: null });

    useEffect(() => {
        api.unsubscribe(token)
            .then(() => setState({ loading: false, ok: true }))
            .catch((e) => setState({ loading: false, ok: false, err: e?.response?.data?.detail || "Unknown token" }));
    }, [token]);

    return (
        <div data-testid="unsubscribe-page" className="max-w-lg mx-auto px-6 py-24 text-center">
            {state.loading ? (
                <p className="text-muted-foreground">Working on it…</p>
            ) : state.ok ? (
                <>
                    <div className="h-14 w-14 mx-auto rounded-full bg-secondary text-secondary-foreground grid place-items-center">
                        <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <h1 className="font-display font-black text-3xl mt-6">You're unsubscribed</h1>
                    <p className="mt-3 text-muted-foreground">
                        We're sorry to see you go. You'll no longer get the Blackrod Now digest or broadcasts.
                        Change your mind? Just resubscribe on the homepage.
                    </p>
                    <Link to="/" className="mt-6 inline-flex items-center gap-1 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        <Home className="h-4 w-4" /> Back to Blackrod Now
                    </Link>
                </>
            ) : (
                <>
                    <h1 className="font-display font-black text-3xl">Hmm, that link didn't work</h1>
                    <p className="mt-3 text-muted-foreground">{state.err}. Try clicking the unsubscribe link in your latest email again, or drop us a note via the Contact page.</p>
                </>
            )}
        </div>
    );
}
