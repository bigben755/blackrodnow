import React, { useState } from "react";
import { Mail, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import NewsletterSection from "@/components/NewsletterSection";
import axios from "axios";

export default function Contact() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api/contact`;
            await axios.post(API, {
                name,
                email,
                subject,
                message,
            });

            toast.success("Message sent", {
                description: "We'll get back to you as soon as possible.",
            });

            setName("");
            setEmail("");
            setSubject("");
            setMessage("");
        } catch (err) {
            console.error(err);
            toast.error("Couldn't send message — try again");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div data-testid="contact-page">
            {/* HERO */}
            <section className="relative overflow-hidden border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
                    <div className="max-w-3xl">
                        <h1 className="font-display font-black tracking-tight text-4xl sm:text-5xl lg:text-6xl leading-tight">
                            Get in touch
                        </h1>
                        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
                            Have a question about Blackrod & South Horwich Now? Want to report an issue or suggest a feature?
                            We'd love to hear from you.
                        </p>
                    </div>
                </div>
            </section>

            {/* MAIN CONTENT */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                <div className="grid lg:grid-cols-3 gap-12">
                    {/* CONTACT FORM */}
                    <div className="lg:col-span-2">
                        <div className="rounded-[2rem] border border-border bg-surface p-8">
                            <h2 className="font-display font-bold text-2xl mb-6">Send us a message</h2>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-semibold block mb-2">
                                            Your name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Jane Smith"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-sm font-semibold block mb-2">
                                            Email address
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="jane@example.com"
                                            className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-sm font-semibold block mb-2">
                                        Subject
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        placeholder="What's this about?"
                                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-semibold block mb-2">
                                        Message
                                    </label>
                                    <textarea
                                        required
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Tell us what's on your mind…"
                                        rows={6}
                                        className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:scale-105 active:scale-95 transition-transform disabled:opacity-60"
                                >
                                    {loading ? "Sending…" : "Send message"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* CONTACT INFO */}
                    <div className="space-y-6">
                            <div className="rounded-[2rem] border border-border bg-surface p-6">
                                <div className="flex items-start gap-4">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                                        <Mail className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Contact</h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Submit the form and we will reply to the email address you provide.
                                        </p>
                                    </div>
                                </div>
                            </div>

                        <div className="rounded-[2rem] border border-border bg-surface p-6">
                            <div className="flex items-start gap-3">
                                <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Check our{" "}
                                        <a
                                            href="/faq"
                                            className="text-primary font-semibold hover:underline"
                                        >
                                            FAQ
                                        </a>
                                        {" "}for quick answers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ QUICK LINKS */}
            <section className="bg-surface border-y border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                    <h2 className="font-display font-bold text-2xl sm:text-3xl mb-8">
                        Common questions
                    </h2>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            {
                                title: "How do I post an event?",
                                link: "/faq",
                            },
                            {
                                title: "How do I add my organisation?",
                                link: "/faq",
                            },
                            {
                                title: "Is there a cost?",
                                link: "/faq",
                            },
                            {
                                title: "How do I report content?",
                                link: "/faq",
                            },
                            {
                                title: "How do I volunteer?",
                                link: "/volunteering",
                            },
                            {
                                title: "Can I promote my business?",
                                link: "/faq",
                            },
                        ].map((item) => (
                            <a
                                key={item.title}
                                href={item.link}
                                className="rounded-xl border border-border bg-background p-4 hover:bg-surface transition"
                            >
                                <div className="font-semibold text-sm">{item.title}</div>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* NEWSLETTER */}
            <NewsletterSection />
        </div>
    );
}
