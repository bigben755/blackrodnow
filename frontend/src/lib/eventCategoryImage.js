const CATEGORY_IMAGE_MAP = {
    Family: "/familyevent.png",
    Youth: "/youth.png",
    "Children & Young People": "/youth.png",
    "Children and Young People": "/youth.png",
    Sport: "/sport.png",
    Sports: "/sport.png",
    "Sports & Fitness": "/sport.png",
    School: "/school.png",
    Education: "/school.png",
    Charity: "/charity.png",
    Fundraising: "/charity.png",
    Business: "/business.png",
    Community: "/communityevent.png",
    Social: "/communityevent.png",
    "Markets & Fairs": "/foodanddrink.png",
    "Markets and Fairs": "/foodanddrink.png",
    Music: "/music.png",
    "Music & Entertainment": "/music.png",
    "Arts & Culture": "/music.png",
    "Arts and Culture": "/music.png",
    "Food & Drink": "/foodanddrink.png",
    "Food and Drink": "/foodanddrink.png",
    Volunteering: "/volunteering.png",
    Faith: "/faith.png",
    Heritage: "/heritage.png",
    "Health & Wellbeing": "/healthandwellbeing.png",
};

const LEGACY_DEFAULT_IMAGE = "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80";
const LEGACY_DEFAULT_IMAGE_PREFIX = "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3";

export function eventCategoryImage(category) {
    return CATEGORY_IMAGE_MAP[category] || "/communityevent.png";
}

export function resolveEventImage(event) {
    if (!event) return "/communityevent.png";
    const byCategory = eventCategoryImage(event.category);
    const raw = String(event.image || "").trim();
    if (!raw) return byCategory;
    if (raw === LEGACY_DEFAULT_IMAGE || raw.startsWith(LEGACY_DEFAULT_IMAGE_PREFIX)) return byCategory;
    if (raw.startsWith("/uploads/")) return raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    if (raw.startsWith("/")) return byCategory;
    return byCategory;
}
