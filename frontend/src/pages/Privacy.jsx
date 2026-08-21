import React from "react";

export default function Privacy() {
    return (
        <div data-testid="privacy-page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Legal</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">Blackrod Now Privacy Policy</h1>
                <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 August 2026</p>
            </div>

            <div className="space-y-8 rounded-3xl border border-border bg-surface p-6 sm:p-8 text-sm leading-7">
                <Section title="1. Who we are">
                    <p>Blackrod Now is a volunteer-led community communications project. We share information about local events, activities, organisations, services and matters of interest to the Blackrod community.</p>
                    <p className="mt-3">Blackrod Now is responsible for the personal information collected through its website and communications.</p>
                    <p className="mt-3">For privacy enquiries, contact:</p>
                    <p className="mt-2"><b>Email:</b> data@communityalliances.co.uk</p>
                    <p><b>Website:</b> blackrodnow.co.uk</p>
                </Section>

                <Section title="2. Information we collect">
                    <p>We may collect:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>names and contact details submitted through our contact form;</li>
                        <li>email addresses provided for newsletter subscriptions;</li>
                        <li>names, contact details and organisation details supplied with event or community-information submissions;</li>
                        <li>correspondence sent to Blackrod Now;</li>
                        <li>information about website use collected through cookies and website analytics; and</li>
                        <li>technical information needed to keep the website secure and operational.</li>
                    </ul>
                    <p className="mt-3">Please do not send unnecessary sensitive or confidential personal information.</p>
                </Section>

                <Section title="3. How we use information">
                    <p>We use personal information to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>respond to enquiries;</li>
                        <li>review and publish event or community information;</li>
                        <li>contact organisations or individuals about their submissions;</li>
                        <li>send newsletters to people who have subscribed;</li>
                        <li>operate, secure and improve the website;</li>
                        <li>correct inaccurate information;</li>
                        <li>manage complaints or concerns; and</li>
                        <li>comply with any legal obligations.</li>
                    </ul>
                    <p className="mt-3">We do not sell personal information.</p>
                </Section>

                <Section title="4. Our lawful reasons for using information">
                    <p>We rely on:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li><b>consent</b> for newsletter subscriptions and optional analytics cookies;</li>
                        <li><b>legitimate interests</b> when responding to enquiries, managing submissions and operating a useful community-information service; and</li>
                        <li><b>legal obligation</b> where information must be used or retained to comply with the law.</li>
                    </ul>
                    <p className="mt-3">Newsletter consent may be withdrawn at any time by using the unsubscribe link or contacting Blackrod Now.</p>
                </Section>

                <Section title="5. Event and community submissions">
                    <p>Information submitted specifically for publication may appear on the Blackrod Now website, social-media pages, newsletters or other community communications.</p>
                    <p className="mt-3">People submitting information must ensure that:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>they are authorised to provide it;</li>
                        <li>it is accurate;</li>
                        <li>they have permission to provide any personal contact details, photographs or other material; and</li>
                        <li>the information is suitable for public publication.</li>
                    </ul>
                    <p className="mt-3">Where possible, organisations should provide an organisational email address rather than a volunteer’s private contact details.</p>
                </Section>

                <Section title="6. Who can access information">
                    <p>Personal information is only accessible to authorised Blackrod Now volunteers who need it to carry out their role.</p>
                    <p className="mt-3">We may also use trusted service providers for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>website hosting;</li>
                        <li>email and newsletter delivery;</li>
                        <li>online forms;</li>
                        <li>website analytics; and</li>
                        <li>technical support.</li>
                    </ul>
                    <p className="mt-3">These providers may only use information as necessary to provide their services.</p>
                    <p className="mt-3">We may disclose information where required by law or where reasonably necessary to report a serious safety, safeguarding or security concern.</p>
                </Section>

                <Section title="7. How long we keep information">
                    <p>We keep personal information only for as long as reasonably necessary.</p>
                    <p className="mt-3">Normally:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>contact enquiries are deleted within 12 months after they have been resolved;</li>
                        <li>event-submission records are deleted within 12 months after the event has taken place;</li>
                        <li>newsletter details are retained until the person unsubscribes; and</li>
                        <li>website analytics information is retained only for the limited period configured within the analytics service.</li>
                    </ul>
                    <p className="mt-3">Information may be retained for longer where necessary to deal with a complaint, safeguarding matter, legal requirement or ongoing dispute.</p>
                </Section>

                <Section title="8. Cookies and analytics">
                    <p>The website may use essential cookies needed for security and basic website functions.</p>
                    <p className="mt-3">Optional analytics cookies may be used to understand how visitors use the website. These cookies will only be activated where the visitor has consented through the website’s cookie settings.</p>
                    <p className="mt-3">Visitors may reject optional cookies and change their preferences.</p>
                </Section>

                <Section title="9. Children’s information">
                    <p>Blackrod Now does not intentionally collect unnecessary personal information directly from children.</p>
                    <p className="mt-3">People submitting information about children’s events or activities must not provide private contact details or photographs without appropriate permission.</p>
                    <p className="mt-3">The organisation responsible for an activity remains responsible for its own safeguarding and consent arrangements.</p>
                </Section>

                <Section title="10. Keeping information secure">
                    <p>Blackrod Now takes reasonable steps to protect personal information, including:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>limiting access to authorised volunteers;</li>
                        <li>using secure passwords;</li>
                        <li>keeping website systems updated;</li>
                        <li>using reputable service providers; and</li>
                        <li>avoiding the collection of unnecessary information.</li>
                    </ul>
                    <p className="mt-3">No online system can be guaranteed to be completely secure.</p>
                </Section>

                <Section title="11. Your rights">
                    <p>Depending on the circumstances, individuals may have the right to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>request a copy of their personal information;</li>
                        <li>ask for inaccurate information to be corrected;</li>
                        <li>request deletion of their information;</li>
                        <li>object to or restrict how their information is used;</li>
                        <li>withdraw consent; and</li>
                        <li>complain about how their information has been handled.</li>
                    </ul>
                    <p className="mt-3">Requests should be sent to the contact email shown above.</p>
                </Section>

                <Section title="12. Complaints">
                    <p>Please contact Blackrod Now first if you have a concern about how your information has been used.</p>
                    <p className="mt-3">You may also complain to the Information Commissioner’s Office, the UK regulator responsible for data protection.</p>
                </Section>

                <Section title="13. Changes to this policy">
                    <p>We may update this policy when the Blackrod Now service or its use of personal information changes.</p>
                    <p className="mt-3">The latest version will be published on the Blackrod Now website.</p>
                </Section>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <section>
            <h2 className="font-display font-bold text-xl mb-3">{title}</h2>
            <div className="text-muted-foreground">{children}</div>
        </section>
    );
}