import { useEffect } from "react";

// Injects a schema.org JSON-LD script tag for the current page (and cleans up on unmount).
export default function SeoJsonLd({ id, data }) {
    useEffect(() => {
        if (!data) return undefined;
        const tag = document.createElement("script");
        tag.type = "application/ld+json";
        tag.id = `jsonld-${id}`;
        tag.text = JSON.stringify(data);
        document.head.appendChild(tag);
        return () => {
            document.getElementById(`jsonld-${id}`)?.remove();
        };
    }, [id, data ? JSON.stringify(data) : ""]);
    return null;
}

export const eventJsonLd = (event, org, url, image) => ({
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    startDate: event.start,
    endDate: event.end || event.start,
    eventStatus: event.status === "cancelled" ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
        "@type": "Place",
        name: event.venue || "Blackrod",
        address: {
            "@type": "PostalAddress",
            streetAddress: event.address || event.venue || "",
            addressLocality: "Blackrod",
            addressRegion: "Bolton",
            addressCountry: "GB",
        },
    },
    ...(image ? { image: [image] } : {}),
    description: (event.description || event.title).slice(0, 500),
    ...(org ? { organizer: { "@type": "Organization", name: org.name, ...(org.website ? { url: org.website } : {}) } } : {}),
    ...(event.cost && /free|no charge|£0/i.test(event.cost)
        ? { isAccessibleForFree: true }
        : {}),
    ...(event.booking && String(event.booking).startsWith("http")
        ? { offers: { "@type": "Offer", url: event.booking, price: "", priceCurrency: "GBP", availability: "https://schema.org/InStock" } }
        : {}),
    url,
});

export const organizationJsonLd = (org, url) => ({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    description: (org.description || "").slice(0, 500),
    ...(org.website ? { sameAs: [org.website] } : {}),
    ...(org.email ? { email: org.email } : {}),
    address: { "@type": "PostalAddress", addressLocality: "Blackrod", addressRegion: "Bolton", addressCountry: "GB" },
    url,
});
