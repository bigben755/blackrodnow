// Central event image resolver for Blackrod Now.
//
// Rule:
//   1. If an event has genuine uploaded/custom artwork, use it.
//   2. If it has no artwork, use the default image for its current category.
//   3. Old category fallback paths are treated as automatic artwork rather than
//      as a genuine upload, so changing an event's category changes its fallback.

export const EVENT_CATEGORY_IMAGES = {
    family: "/familyevent.png",
    youth: "/youth.png",
    "children & young people": "/youth.png",
    "children and young people": "/youth.png",

    sport: "/sport.png",
    sports: "/sport.png",
    "sports & fitness": "/sport.png",
    "sports and fitness": "/sport.png",

    school: "/school.png",
    education: "/school.png",

    charity: "/charity.png",
    fundraising: "/charity.png",

    business: "/business.png",
    "local business": "/business.png",

    community: "/communityevent.png",
    social: "/communityevent.png",

    "markets & fairs": "/foodanddrink.png",
    "markets and fairs": "/foodanddrink.png",
    "food & drink": "/foodanddrink.png",
    "food and drink": "/foodanddrink.png",

    music: "/music.png",
    "music & entertainment": "/music.png",
    "music and entertainment": "/music.png",
    "arts & culture": "/music.png",
    "arts and culture": "/music.png",

    volunteering: "/volunteering.png",
    faith: "/faith.png",
    heritage: "/heritage.png",

    "health & wellbeing": "/healthandwellbeing.png",
    "health and wellbeing": "/healthandwellbeing.png",
};

const LEGACY_EVENT_IMAGE_PREFIX =
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3";

const DEFAULT_IMAGE_VALUES = new Set([
    ...Object.values(EVENT_CATEGORY_IMAGES),
    "/communityevent.png",
]);

const normalise = (value) =>
    String(value || "")
        .trim()
        .toLowerCase();

export const eventCategoryImage = (category) => {
    const key = normalise(category || "Community");
    return EVENT_CATEGORY_IMAGES[key] || "/communityevent.png";
};

export const isAutomaticEventImage = (image) => {
    const value = String(image || "").trim();

    if (!value) return true;
    if (value.startsWith(LEGACY_EVENT_IMAGE_PREFIX)) return true;
    if (DEFAULT_IMAGE_VALUES.has(value)) return true;

    return false;
};

export const resolveEventImage = (event) => {
    const image = String(event?.image || "").trim();

    // Genuine event/uploaded artwork always wins.
    if (image && !isAutomaticEventImage(image)) {
        return image;
    }

    // Otherwise derive the image from the event's CURRENT category.
    return eventCategoryImage(event?.category);
};

export default resolveEventImage;