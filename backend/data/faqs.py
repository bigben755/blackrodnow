"""Canonical FAQ list mirrored from /app/frontend/src/pages/FAQ.js.
Kept in code (not Mongo) because it rarely changes and lives in the repo.
Exposed via /api/chat/context so external chatbots (Charla) can ingest.
"""

FAQS = [
    {
        "cat": "Using Blackrod Now",
        "q": "Do I need an account to use Blackrod Now?",
        "a": "No — never. You can browse events, follow organisations, subscribe to the newsletter, and personalise everything without creating an account. Your preferences are stored on your device (and against your email if you subscribe).",
    },
    {
        "cat": "Using Blackrod Now",
        "q": "How do I find what's on this week?",
        "a": "The homepage shows 'This week in Blackrod' at the top. Or hit Events for the full calendar — list view for scanning, month view for planning.",
    },
    {
        "cat": "Using Blackrod Now",
        "q": "How do I add events to my own calendar?",
        "a": "Every event page has 'Add to Google / Apple / Outlook Calendar' buttons. For the whole calendar, tap 'Sync calendar' on the Events page and download the .ics file — imports into any calendar app.",
    },
    {
        "cat": "Following organisations",
        "q": "How do I follow an organisation or a topic?",
        "a": "On any organisation's page, tap the ♥ Follow button. To follow topics like 'Youth' or 'Music', head to Notifications. No login required — your follows are saved on this device.",
    },
    {
        "cat": "Following organisations",
        "q": "Will my follows sync across my phone and laptop?",
        "a": "Not automatically without an account, but when you subscribe to the newsletter with your email, your follows travel with your email — so the same personalised digest reaches you wherever.",
    },
    {
        "cat": "Newsletter",
        "q": "What's in the weekly newsletter?",
        "a": "A short round-up delivered Friday morning. If you follow specific organisations or topics, we prioritise events and updates from those. Otherwise you get a general Blackrod-wide digest.",
    },
    {
        "cat": "Newsletter",
        "q": "How do I unsubscribe?",
        "a": "Every email has a one-click unsubscribe link at the bottom. You can also visit your Preferences link (in any email) and turn the digest off there — or delete your subscription completely.",
    },
    {
        "cat": "Newsletter",
        "q": "How do I change which orgs I get updates about?",
        "a": "Open the 'Personalise' link in any Blackrod Now email — you'll land on your preferences page where you can add/remove followed organisations and categories any time.",
    },
    {
        "cat": "Submitting events",
        "q": "Can anyone submit an event?",
        "a": "Yes. Hit 'Submit an Event' in the top nav or footer, fill in the form and send it. Admins review and publish it — usually within 24 hours. No login required.",
    },
    {
        "cat": "Submitting events",
        "q": "Why are submitted events reviewed?",
        "a": "A quick moderation step keeps the site accurate, safe and free of spam. Trusted, established organisations may be given direct-publish access on request.",
    },
    {
        "cat": "Organisations",
        "q": "How does my group get listed?",
        "a": "Tap 'Add Your Organisation' and fill in the short form. An admin reviews it (usually same day) and it appears in the directory.",
    },
    {
        "cat": "Organisations",
        "q": "I run an organisation. How do I edit my listing?",
        "a": "Go to the Organisation dashboard from the top-right menu, pick your group, and tap 'Profile & branding'. Update your logo, cover, colour, contacts and socials — changes go live immediately.",
    },
    {
        "cat": "Organisations",
        "q": "I'm not great with tech — can someone help me?",
        "a": "Yes. Blackrod Now super admins can update any organisation's listing on your behalf. Contact us via the 'Contact admin' button in your dashboard, or the Contact page.",
    },
    {
        "cat": "Organisations",
        "q": "How does the Facebook sync work?",
        "a": "Connect your Facebook page once from your dashboard. Every event you publish on Blackrod Now also posts to your Facebook page automatically — and your Facebook posts flow back here as feed updates. Setup is currently in preparation with Meta; full switch-on happens automatically once approved.",
    },
    {
        "cat": "Organisations",
        "q": "What is 'Upload Once, Publish Everywhere'?",
        "a": "Our AI tool. Paste any flyer, newsletter or update into your dashboard and it extracts an event listing, social caption, notification text and update post — in one go. If your paste has multiple events, we split them out one by one.",
    },
    {
        "cat": "Organisations",
        "q": "What are the Documents on my profile for?",
        "a": "A public shelf for PDFs, Word docs and images your community actually asks for — membership forms, kit lists, safeguarding policies, annual reports, meeting minutes. Residents click to download.",
    },
    {
        "cat": "Volunteering",
        "q": "How do I sign up to volunteer?",
        "a": "Head to Volunteering. Each opportunity has a contact button — tap it and message the organisation directly. Great for DofE Skills or Volunteering sections.",
    },
    {
        "cat": "Volunteering",
        "q": "Is there anything for young people?",
        "a": "Yes. Look for Youth, DofE, and Under-18 opportunities on the Volunteering page. Air Cadets, Scouts, Girlguiding, junior sport clubs and the food pantry all welcome young volunteers.",
    },
    {
        "cat": "Privacy",
        "q": "What data do you collect?",
        "a": "Your email if you subscribe to the newsletter; anonymous device follows on your browser; whatever you type into forms. No trackers, no adverts. See our Privacy page.",
    },
]
