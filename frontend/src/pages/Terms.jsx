import React from "react";

export default function Terms() {
    return (
        <div data-testid="terms-page" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Legal</span>
                <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tight mt-2">Blackrod Now Terms of Use</h1>
                <p className="mt-2 text-sm text-muted-foreground">Last updated: 4 August 2026</p>
            </div>

            <div className="space-y-8 rounded-3xl border border-border bg-surface p-6 sm:p-8 text-sm leading-7">
                <Section title="1. About these terms">
                    <p>These Terms of Use apply to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the Blackrod Now website;</li>
                        <li>Blackrod Now newsletters and digital communications;</li>
                        <li>event, activity and community-information submission forms;</li>
                        <li>content published through Blackrod Now; and</li>
                        <li>other online services operated under the Blackrod Now name.</li>
                    </ul>
                    <p className="mt-3">By using these services or submitting information to Blackrod Now, you agree to these terms.</p>
                    <p className="mt-3">If you do not agree to these terms, you should not use the relevant service or submit content.</p>
                </Section>

                <Section title="2. About Blackrod Now">
                    <p>Blackrod Now is a volunteer-led community communications and coordination initiative.</p>
                    <p className="mt-3">Its purpose is to help residents and organisations find and share information about Blackrod, including:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>local events;</li>
                        <li>community activities;</li>
                        <li>clubs and voluntary organisations;</li>
                        <li>public information;</li>
                        <li>local opportunities;</li>
                        <li>community notices; and</li>
                        <li>matters of local interest.</li>
                    </ul>
                    <p className="mt-3"><b>Blackrod Now</b></p>
                    <p><b>Email:</b> terms@communityalliances.co.uk</p>
                    <p><b>Website:</b> blackrodnow.co.uk</p>
                </Section>

                <Section title="3. Blackrod Now is an information and coordination service">
                    <p>Unless expressly agreed otherwise in writing, Blackrod Now:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>publicises and coordinates information;</li>
                        <li>does not organise or manage third-party events;</li>
                        <li>does not control third-party venues or premises;</li>
                        <li>does not supervise event participants;</li>
                        <li>does not sell tickets or take bookings on behalf of organisers;</li>
                        <li>does not provide event security, first aid or stewarding;</li>
                        <li>does not undertake an organiser’s health and safety duties; and</li>
                        <li>is not responsible for delivering the activities it publicises.</li>
                    </ul>
                    <p className="mt-3">Publication by Blackrod Now does not make Blackrod Now:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the event organiser;</li>
                        <li>a co-organiser;</li>
                        <li>the venue operator;</li>
                        <li>the employer of event staff or volunteers;</li>
                        <li>an agent of the organiser;</li>
                        <li>responsible for an organiser’s actions; or</li>
                        <li>responsible for the safety or suitability of an event.</li>
                    </ul>
                    <p className="mt-3">Any exception must be expressly confirmed by Blackrod Now in writing.</p>
                </Section>

                <Section title="4. Responsibilities of event organisers">
                    <p>The organisation or person responsible for an event, activity or service remains solely responsible for its planning, management and delivery.</p>
                    <p className="mt-3">This includes responsibility for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>public and other appropriate insurance;</li>
                        <li>health and safety;</li>
                        <li>suitable risk assessments;</li>
                        <li>safeguarding arrangements;</li>
                        <li>premises and venue safety;</li>
                        <li>licences, permits and permissions;</li>
                        <li>road closures or traffic arrangements;</li>
                        <li>first aid and emergency planning;</li>
                        <li>food safety and hygiene;</li>
                        <li>accessibility arrangements;</li>
                        <li>security and stewarding;</li>
                        <li>photography and media consent;</li>
                        <li>performers, contractors, staff and volunteers;</li>
                        <li>ticketing, bookings, payments and refunds;</li>
                        <li>compliance with equality, employment and consumer law;</li>
                        <li>cancellation, postponement and amendment notices; and</li>
                        <li>compliance with all other applicable legal or regulatory requirements.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now does not inspect or certify these arrangements.</p>
                    <p className="mt-3">Organisers should obtain their own professional, legal, insurance or regulatory advice where necessary.</p>
                </Section>

                <Section title="5. Accuracy of website information">
                    <p>Blackrod Now aims to publish useful and accurate community information. However:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>much of the information is supplied by third parties;</li>
                        <li>event details may change after publication;</li>
                        <li>errors, omissions and delays may occur;</li>
                        <li>events may be postponed or cancelled;</li>
                        <li>availability, prices, eligibility and booking arrangements may change; and</li>
                        <li>online information may not always reflect the latest position.</li>
                    </ul>
                    <p className="mt-3">Users should confirm important information directly with the named organiser before:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>travelling;</li>
                        <li>attending an event;</li>
                        <li>making a booking;</li>
                        <li>making a payment;</li>
                        <li>relying on accessibility information; or</li>
                        <li>making any other commitment.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now does not guarantee that all published information is complete, accurate, current or available.</p>
                </Section>

                <Section title="6. Submitting an event or other content">
                    <p>A person submitting information to Blackrod Now confirms that:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the information is accurate to the best of their knowledge;</li>
                        <li>they are authorised to submit it;</li>
                        <li>they are authorised to act for the named organisation where applicable;</li>
                        <li>they have permission to provide all text, images, logos, posters and other material;</li>
                        <li>publication will not infringe copyright, confidentiality, privacy or other rights;</li>
                        <li>any personal contact details supplied for publication may lawfully be published;</li>
                        <li>any necessary photography, participant or parental permissions have been obtained;</li>
                        <li>the submission is not misleading;</li>
                        <li>the event or activity complies with applicable law; and</li>
                        <li>the organiser accepts the responsibilities set out in these terms.</li>
                    </ul>
                    <p className="mt-3">The submitter must promptly notify Blackrod Now if:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>information becomes inaccurate;</li>
                        <li>an event is amended;</li>
                        <li>an event is postponed or cancelled;</li>
                        <li>published contact details change;</li>
                        <li>permission to use submitted material is withdrawn; or</li>
                        <li>a safeguarding, safety, legal or privacy concern arises.</li>
                    </ul>
                </Section>

                <Section title="7. Content licence">
                    <p>A submitter retains ownership of material they own.</p>
                    <p className="mt-3">By submitting content, the submitter gives Blackrod Now a non-exclusive, royalty-free permission to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>review the content;</li>
                        <li>copy and store it;</li>
                        <li>edit it for spelling, formatting, clarity, accessibility or length;</li>
                        <li>publish it on the Blackrod Now website;</li>
                        <li>include it in newsletters;</li>
                        <li>publish it through Blackrod Now social-media channels;</li>
                        <li>reproduce it in printed community material;</li>
                        <li>resize or crop images where reasonably necessary; and</li>
                        <li>use it to publicise the relevant event, organisation, activity or community information.</li>
                    </ul>
                    <p className="mt-3">This permission continues for as long as reasonably necessary to publicise or archive the relevant information.</p>
                    <p className="mt-3">Blackrod Now will not knowingly claim ownership of third-party content merely because it has been submitted or published.</p>
                </Section>

                <Section title="8. Prohibited content">
                    <p>Users must not submit, upload, send or attempt to publish material that:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>is unlawful;</li>
                        <li>is fraudulent, false or deliberately misleading;</li>
                        <li>is defamatory;</li>
                        <li>is threatening, abusive or harassing;</li>
                        <li>promotes hatred, discrimination or violence;</li>
                        <li>sexually exploits or endangers a child;</li>
                        <li>creates an unreasonable safeguarding risk;</li>
                        <li>reveals private information without authority;</li>
                        <li>infringes copyright, trademark or other intellectual-property rights;</li>
                        <li>impersonates another person or organisation;</li>
                        <li>contains malware, harmful code or deceptive links;</li>
                        <li>promotes unlawful goods, services or activities;</li>
                        <li>interferes with an investigation or court order;</li>
                        <li>constitutes unauthorised advertising or spam;</li>
                        <li>is unrelated to Blackrod or the purposes of Blackrod Now; or</li>
                        <li>could reasonably expose Blackrod Now, its volunteers or the public to legal, financial, safety or reputational harm.</li>
                    </ul>
                </Section>

                <Section title="9. Editorial discretion and moderation">
                    <p>Submission does not guarantee publication.</p>
                    <p className="mt-3">Blackrod Now may, acting reasonably:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>request clarification or evidence;</li>
                        <li>correct spelling or formatting;</li>
                        <li>shorten or reorganise content;</li>
                        <li>decline a submission;</li>
                        <li>delay publication;</li>
                        <li>remove information;</li>
                        <li>suspend a listing;</li>
                        <li>add a correction, warning or clarification;</li>
                        <li>refer a concern to the relevant organisation or authority; or</li>
                        <li>restrict further submissions from a person or organisation.</li>
                    </ul>
                    <p className="mt-3">Reasons may include:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the information cannot be verified;</li>
                        <li>it is incomplete or inaccurate;</li>
                        <li>it falls outside the purpose of Blackrod Now;</li>
                        <li>it creates a safety, privacy or safeguarding concern;</li>
                        <li>it may breach the law or another person’s rights;</li>
                        <li>it appears to be primarily commercial advertising;</li>
                        <li>the event has passed;</li>
                        <li>the organiser has failed to provide requested clarification; or</li>
                        <li>publication would be inappropriate or impractical.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now is not required to publish every legitimate event or explain every editorial decision, although reasonable enquiries will be considered.</p>
                </Section>

                <Section title="10. Safeguarding">
                    <p>Users and submitters must not use Blackrod Now in a way that could place a child or adult at risk.</p>
                    <p className="mt-3">Submissions must not include:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>a child’s private address, telephone number or personal email address;</li>
                        <li>unnecessary identifying information about a child;</li>
                        <li>information revealing a child’s routine or live location where this creates a risk;</li>
                        <li>inappropriate or exploitative imagery;</li>
                        <li>confidential safeguarding information; or</li>
                        <li>allegations about an identifiable person that should instead be reported to an appropriate authority.</li>
                    </ul>
                    <p className="mt-3">Organisations promoting activities involving children or adults at risk remain responsible for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>their own safeguarding policy;</li>
                        <li>safer recruitment;</li>
                        <li>appropriate checks;</li>
                        <li>supervision;</li>
                        <li>staff and volunteer training;</li>
                        <li>consent arrangements;</li>
                        <li>reporting procedures; and</li>
                        <li>responding to concerns.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now may remove content and contact the police, local authority, safeguarding services or another appropriate body where a genuine concern arises.</p>
                    <p className="mt-3">Blackrod Now is not an emergency or safeguarding-reporting service. Immediate danger should be reported to the emergency services.</p>
                </Section>

                <Section title="11. Use of the website">
                    <p>Users may use the website for lawful personal, community and organisational purposes.</p>
                    <p className="mt-3">Users must not:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>attempt to gain unauthorised access to the website or administrative systems;</li>
                        <li>interfere with the website’s operation;</li>
                        <li>introduce malware or harmful code;</li>
                        <li>scrape or harvest personal contact details;</li>
                        <li>use contact information for spam or unsolicited mass marketing;</li>
                        <li>circumvent website security;</li>
                        <li>overload the website;</li>
                        <li>falsely imply endorsement by Blackrod Now;</li>
                        <li>reproduce Blackrod Now branding without permission; or</li>
                        <li>use the website in a way that breaches applicable law.</li>
                    </ul>
                </Section>

                <Section title="12. Intellectual property">
                    <p>Unless stated otherwise, original Blackrod Now material, including its:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>name;</li>
                        <li>logo;</li>
                        <li>branding;</li>
                        <li>website design;</li>
                        <li>original written content; and</li>
                        <li>original graphics</li>
                    </ul>
                    <p className="mt-3">belongs to Blackrod Now or is used with permission.</p>
                    <p className="mt-3">Users may:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>view the website;</li>
                        <li>share links to published pages;</li>
                        <li>print reasonable extracts for personal or community use; and</li>
                        <li>share event information for the purpose of publicising the relevant event.</li>
                    </ul>
                    <p className="mt-3">Users must not, without permission:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>reproduce substantial parts of the website;</li>
                        <li>use Blackrod Now branding as their own;</li>
                        <li>remove copyright or attribution notices;</li>
                        <li>sell or license Blackrod Now material;</li>
                        <li>create a misleading copy of the service; or</li>
                        <li>imply that Blackrod Now endorses them.</li>
                    </ul>
                    <p className="mt-3">Material supplied by third parties remains subject to the rights and permissions of the relevant owner.</p>
                </Section>

                <Section title="13. Third-party websites and services">
                    <p>Blackrod Now may link to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>event organisers;</li>
                        <li>community groups;</li>
                        <li>businesses;</li>
                        <li>local authorities;</li>
                        <li>ticketing providers;</li>
                        <li>social-media platforms;</li>
                        <li>maps;</li>
                        <li>payment services; and</li>
                        <li>other third-party websites.</li>
                    </ul>
                    <p className="mt-3">Links are provided for information and convenience. They do not necessarily represent approval, recommendation or endorsement.</p>
                    <p className="mt-3">Blackrod Now does not control third-party websites and is not responsible for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>their availability;</li>
                        <li>accuracy;</li>
                        <li>security;</li>
                        <li>accessibility;</li>
                        <li>privacy practices;</li>
                        <li>content;</li>
                        <li>prices;</li>
                        <li>contractual terms; or</li>
                        <li>goods and services.</li>
                    </ul>
                    <p className="mt-3">Users should make their own checks before providing information, booking, paying or entering into an arrangement with a third party.</p>
                </Section>

                <Section title="14. Advertising and commercial content">
                    <p>Blackrod Now may publish information about local businesses, commercial events or sponsored activity where this supports its community purpose.</p>
                    <p className="mt-3">Commercial organisations have no automatic right to publication.</p>
                    <p className="mt-3">Where content is paid for or sponsored, Blackrod Now will take reasonable steps to identify it appropriately.</p>
                    <p className="mt-3">Publication does not guarantee:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the quality of a product or service;</li>
                        <li>the reliability of the advertiser;</li>
                        <li>the outcome of a transaction; or</li>
                        <li>that Blackrod Now recommends the advertiser.</li>
                    </ul>
                </Section>

                <Section title="15. Availability of the service">
                    <p>Blackrod Now is operated by volunteers and may not be continuously available.</p>
                    <p className="mt-3">We may:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>suspend the website;</li>
                        <li>change its functions;</li>
                        <li>remove content;</li>
                        <li>carry out maintenance;</li>
                        <li>change service providers;</li>
                        <li>restrict submissions; or</li>
                        <li>discontinue part or all of the service.</li>
                    </ul>
                    <p className="mt-3">We do not guarantee that:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the website will always be available;</li>
                        <li>access will be uninterrupted;</li>
                        <li>all errors will be corrected;</li>
                        <li>every submission will be reviewed within a particular period; or</li>
                        <li>archived content will remain permanently available.</li>
                    </ul>
                </Section>

                <Section title="16. Security">
                    <p>Blackrod Now takes proportionate steps to protect its website and systems. However, no online service can be guaranteed to be completely secure.</p>
                    <p className="mt-3">Users are responsible for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>protecting their own devices;</li>
                        <li>checking links before selecting them;</li>
                        <li>maintaining appropriate security software; and</li>
                        <li>avoiding the transmission of unnecessary sensitive information.</li>
                    </ul>
                    <p className="mt-3">Users must notify Blackrod Now promptly if they identify a suspected security weakness or unauthorised use of the service.</p>
                </Section>

                <Section title="17. Reliance on information">
                    <p>Blackrod Now provides general community information. It does not provide:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>legal advice;</li>
                        <li>medical advice;</li>
                        <li>financial advice;</li>
                        <li>professional safety advice;</li>
                        <li>emergency information; or</li>
                        <li>an official substitute for information from an event organiser, local authority or emergency service.</li>
                    </ul>
                    <p className="mt-3">Users remain responsible for making their own decisions and checks.</p>
                </Section>

                <Section title="18. Liability">
                    <p>Nothing in these terms excludes or limits liability where doing so would be unlawful, including liability for:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>death or personal injury caused by negligence;</li>
                        <li>fraud or fraudulent misrepresentation; or</li>
                        <li>any other liability that cannot legally be excluded.</li>
                    </ul>
                    <p className="mt-3">Subject to this, Blackrod Now and its volunteers will not be responsible for loss or damage arising solely from:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>inaccurate or outdated information supplied by a third party;</li>
                        <li>cancellation, postponement or alteration of an event;</li>
                        <li>the conduct of an event organiser, venue, supplier or participant;</li>
                        <li>injury, loss or damage occurring at a third-party event or premises;</li>
                        <li>goods, services, bookings or payments provided by a third party;</li>
                        <li>reliance on information that the user should reasonably have confirmed with the organiser;</li>
                        <li>third-party websites;</li>
                        <li>temporary website unavailability;</li>
                        <li>unauthorised access beyond Blackrod Now’s reasonable control; or</li>
                        <li>information submitted in breach of these terms.</li>
                    </ul>
                    <p className="mt-3">Nothing in these terms affects any rights a consumer has that cannot lawfully be excluded or restricted.</p>
                </Section>

                <Section title="19. Responsibility for submitted material">
                    <p>A submitter is responsible for any material they provide and for ensuring that it complies with these terms.</p>
                    <p className="mt-3">Where a third party makes a credible complaint about submitted material, the submitter may be asked to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>provide evidence of ownership or permission;</li>
                        <li>correct the information;</li>
                        <li>confirm its accuracy;</li>
                        <li>explain the basis for publication; or</li>
                        <li>cooperate with removal or investigation.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now may remove disputed material while a concern is considered.</p>
                </Section>

                <Section title="20. Privacy">
                    <p>Personal information is handled in accordance with the Blackrod Now Privacy Policy and applicable data protection requirements.</p>
                    <p className="mt-3">By submitting content, users acknowledge that information intended for publication may become publicly accessible.</p>
                    <p className="mt-3">Submitters should not provide private personal information unless it is necessary and they are authorised to do so.</p>
                </Section>

                <Section title="21. Complaints and corrections">
                    <p>Requests to:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>correct information;</li>
                        <li>report inappropriate content;</li>
                        <li>report a safeguarding concern;</li>
                        <li>report copyright infringement;</li>
                        <li>report a privacy concern; or</li>
                        <li>request removal</li>
                    </ul>
                    <p className="mt-3">should be sent to:</p>
                    <p className="mt-3"><b>terms@communityalliances.co.uk</b></p>
                    <p className="mt-3">The request should identify:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>the relevant page or content;</li>
                        <li>the nature of the concern;</li>
                        <li>the correction or action requested; and</li>
                        <li>the requester’s connection to the information.</li>
                    </ul>
                    <p className="mt-3">Blackrod Now may request supporting evidence before changing or removing content.</p>
                </Section>

                <Section title="22. Changes to these terms">
                    <p>Blackrod Now may update these Terms of Use where necessary to reflect:</p>
                    <ul className="list-disc pl-6 mt-3 space-y-2">
                        <li>changes to the service;</li>
                        <li>operational experience;</li>
                        <li>new risks;</li>
                        <li>legal or regulatory developments; or</li>
                        <li>changes to submission and publication arrangements.</li>
                    </ul>
                    <p className="mt-3">The current version will be published on the website and will display its effective date.</p>
                    <p className="mt-3">Continued use of the website after an update constitutes acceptance of the revised terms from the date they take effect.</p>
                </Section>

                <Section title="23. Severability">
                    <p>If any part of these terms is found to be invalid, unlawful or unenforceable, the remaining provisions will continue to apply.</p>
                </Section>

                <Section title="24. No waiver">
                    <p>A failure by Blackrod Now to enforce a provision on one occasion does not prevent it from enforcing that provision later.</p>
                </Section>

                <Section title="25. Governing law">
                    <p>These terms are governed by the law of England and Wales.</p>
                    <p className="mt-3">The courts of England and Wales will have jurisdiction over disputes relating to these terms, subject to any mandatory rights a consumer has to bring proceedings elsewhere within the United Kingdom.</p>
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