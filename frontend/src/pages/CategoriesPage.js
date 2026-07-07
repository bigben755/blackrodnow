import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  HeartHandshake,
  MapPin,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

import {
  CATEGORIES,
  ORGANISATIONS,
  EVENTS,
  IMAGES,
} from "@/data/blackrodData";

const CATEGORY_DETAILS = {
  Family: {
    slug: "family",
    image:
      "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200&q=80",
    description:
      "Find family-friendly events, baby and toddler groups, school activities and things to do with children around Blackrod.",
  },
  Youth: {
    slug: "youth",
    image:
      "https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=1200&q=80",
    description:
      "Youth clubs, guiding, sports, activities, volunteering and local opportunities for younger people.",
  },
  Sport: {
    slug: "sport",
    image:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80",
    description:
      "Local clubs, active groups, fitness sessions, wellbeing football, cricket, bowls, boxing and sports venues.",
  },
  School: {
    slug: "school",
    image:
      "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
    description:
      "School-linked groups, PTFA activity, family fundraisers, educational trusts and pupil support.",
  },
  Charity: {
    slug: "charity",
    image:
      "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1200&q=80",
    description:
      "Charitable groups, educational trusts, fundraising activity and community support across the village.",
  },
  Business: {
    slug: "business",
    image:
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=1200&q=80",
    description:
      "Local businesses, venues, services and community-facing organisations supporting Blackrod.",
  },
  Community: {
    slug: "community",
    image:
      "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&q=80",
    description:
      "Village events, community groups, civic activity, public notices and local projects.",
  },
  Music: {
    slug: "music",
    image:
      "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80",
    description:
      "Choirs, concerts, live performances and music-led community activity.",
  },
  "Food & Drink": {
    slug: "food-and-drink",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80",
    description:
      "Markets, refreshments, social meetups, cafés, food stalls and community hospitality.",
  },
  Volunteering: {
    slug: "volunteering",
    image:
      "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80",
    description:
      "Practical ways to help locally, from planting and festivals to clubs, churches and community groups.",
  },
  Faith: {
    slug: "faith",
    image:
      "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=1200&q=80",
    description:
      "Church services, faith-linked groups, family sessions, warm spaces and community worship.",
  },
  Heritage: {
    slug: "heritage",
    image:
      "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&q=80",
    description:
      "Local history, exhibitions, Blackrod heritage, village identity and historical interest groups.",
  },
  "Health & Wellbeing": {
    slug: "health-and-wellbeing",
    image:
      "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1200&q=80",
    description:
      "Walking groups, warm spaces, mental-health support, fitness, friendship and social wellbeing.",
  },
};

const CATEGORY_GRADIENTS = {
  Family: "from-pink-500 to-rose-600",
  Youth: "from-sky-500 to-blue-700",
  Sport: "from-emerald-500 to-green-700",
  School: "from-indigo-500 to-violet-700",
  Charity: "from-purple-500 to-fuchsia-700",
  Business: "from-slate-700 to-slate-950",
  Community: "from-orange-500 to-amber-600",
  Music: "from-violet-500 to-purple-800",
  "Food & Drink": "from-yellow-500 to-orange-700",
  Volunteering: "from-lime-500 to-green-700",
  Faith: "from-blue-600 to-indigo-800",
  Heritage: "from-teal-600 to-cyan-800",
  "Health & Wellbeing": "from-emerald-500 to-teal-800",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isApproved(item) {
  return !item?.status || item.status === "approved";
}

function isUpcomingEvent(event) {
  if (!event?.start) return false;
  return new Date(event.start) >= new Date();
}

function normalise(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function organisationMatchesCategory(org, category) {
  const categoryName = normalise(category);
  const orgCategory = normalise(org?.category);

  const categoryMatch = orgCategory === categoryName;

  const tagMatch =
    Array.isArray(org?.tags) &&
    org.tags.some((tag) => normalise(tag) === categoryName);

  /*
    Your organisation categories sometimes use plural group labels,
    for example:
    - "Sports" while the public category is "Sport"
    - "Schools" while the public category is "School"
    - "Charities" while the public category is "Charity"
    - "Community groups" while the public category is "Community"
    - "Youth groups" while the public category is "Youth"
    - "Churches/Faith groups" while the public category is "Faith"
  */
  const mappedCategoryMatch =
    (categoryName === "sport" && orgCategory === "sports") ||
    (categoryName === "school" && orgCategory === "schools") ||
    (categoryName === "charity" && orgCategory === "charities") ||
    (categoryName === "community" && orgCategory === "community groups") ||
    (categoryName === "youth" && orgCategory === "youth groups") ||
    (categoryName === "faith" && orgCategory === "churches/faith groups") ||
    (categoryName === "business" && orgCategory === "local businesses") ||
    (categoryName === "health & wellbeing" &&
      orgCategory === "health & wellbeing");

  return categoryMatch || tagMatch || mappedCategoryMatch;
}

function getCategoryStats(category) {
  const organisations = ORGANISATIONS.filter(
    (org) => isApproved(org) && organisationMatchesCategory(org, category)
  );

  const events = EVENTS.filter(
    (event) => isApproved(event) && event.category === category
  );

  const upcoming = events.filter(isUpcomingEvent);

  return {
    organisations: organisations.length,
    events: events.length,
    upcoming: upcoming.length,
  };
}

function getFeaturedItem(category) {
  const upcomingEvent = EVENTS.find(
    (event) =>
      isApproved(event) &&
      event.category === category &&
      isUpcomingEvent(event)
  );

  if (upcomingEvent) {
    return {
      type: "Upcoming event",
      title: upcomingEvent.title,
      location: upcomingEvent.venue || upcomingEvent.address || "Blackrod",
      link: `/events/${upcomingEvent.id}`,
    };
  }

  const organisation = ORGANISATIONS.find(
    (org) => isApproved(org) && organisationMatchesCategory(org, category)
  );

  if (organisation) {
    return {
      type: "Local group",
      title: organisation.name,
      location: organisation.location || organisation.address || "Blackrod",
      link: `/organisations/${organisation.slug}`,
    };
  }

  return null;
}

export default function CategoriesPage() {
  const categories = CATEGORIES.map((category) => {
    const details = CATEGORY_DETAILS[category] || {};

    return {
      name: category,
      slug: details.slug || slugify(category),
      image: details.image || IMAGES?.hero,
      description:
        details.description ||
        "Explore local organisations, events and community opportunities in this category.",
      gradient: CATEGORY_GRADIENTS[category] || "from-slate-700 to-slate-950",
      stats: getCategoryStats(category),
      featured: getFeaturedItem(category),
    };
  });

  const totalOrganisations = ORGANISATIONS.filter(isApproved).length;

  const totalEvents = EVENTS.filter(isApproved).length;

  const totalUpcomingEvents = EVENTS.filter(
    (event) => isApproved(event) && isUpcomingEvent(event)
  ).length;

  return (
    <main className="min-h-screen bg-[#f8f4ec] text-slate-950">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={IMAGES?.hero || CATEGORY_DETAILS.Community.image}
            alt="Blackrod community event"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-950/75" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/70 to-[#f8f4ec]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-28 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Blackrod Now categories
            </div>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl">
              Explore Blackrod by interest, activity and community need.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">
              Find family activities, youth groups, sports clubs, volunteering
              opportunities, heritage groups, community events, faith groups,
              wellbeing sessions and local organisations in one place.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/events"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:scale-[1.02] hover:bg-slate-100"
              >
                View events
                <CalendarDays className="h-4 w-4" />
              </Link>

              <Link
                to="/organisations"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-black text-white backdrop-blur transition hover:bg-white/20"
              >
                Browse organisations
                <Users className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-lg backdrop-blur">
              <p className="text-3xl font-black">{totalOrganisations}</p>
              <p className="mt-1 text-sm font-semibold text-white/75">
                Listed organisations
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-lg backdrop-blur">
              <p className="text-3xl font-black">{totalEvents}</p>
              <p className="mt-1 text-sm font-semibold text-white/75">
                Approved event listings
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 text-white shadow-lg backdrop-blur">
              <p className="text-3xl font-black">{totalUpcomingEvents}</p>
              <p className="mt-1 text-sm font-semibold text-white/75">
                Upcoming listings
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.22em] text-orange-600">
              Browse categories
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              What are you looking for?
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Each category brings together relevant local organisations,
              recurring groups, events and opportunities so residents can find
              what is happening quickly.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Search className="h-4 w-4 text-slate-400" />
            Select a category below
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.name}
              to={`/categories/${category.slug}`}
              className="group overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="relative h-56 overflow-hidden">
                <img
                  src={category.image}
                  alt={`${category.name} in Blackrod`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                <div
                  className={`absolute left-4 top-4 rounded-full bg-gradient-to-r ${category.gradient} px-4 py-2 text-xs font-black uppercase tracking-wide text-white shadow-lg`}
                >
                  {category.name}
                </div>

                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-2xl font-black text-white">
                    {category.name}
                  </h3>

                  {category.featured && (
                    <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/80">
                      {category.featured.type}: {category.featured.title}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-6">
                <p className="min-h-[96px] text-sm leading-6 text-slate-600">
                  {category.description}
                </p>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                    <p className="text-lg font-black text-slate-950">
                      {category.stats.organisations}
                    </p>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Groups
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                    <p className="text-lg font-black text-slate-950">
                      {category.stats.events}
                    </p>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Events
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 text-center ring-1 ring-slate-100">
                    <p className="text-lg font-black text-slate-950">
                      {category.stats.upcoming}
                    </p>
                    <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                      Soon
                    </p>
                  </div>
                </div>

                {category.featured && (
                  <div className="mt-5 rounded-2xl bg-orange-50 p-4 ring-1 ring-orange-100">
                    <p className="text-xs font-black uppercase tracking-wide text-orange-700">
                      Highlight
                    </p>

                    <p className="mt-1 line-clamp-1 text-sm font-black text-slate-950">
                      {category.featured.title}
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">
                        {category.featured.location}
                      </span>
                    </p>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
                  <span className="text-sm font-black text-slate-950">
                    Explore {category.name}
                  </span>

                  <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-950 text-white transition group-hover:bg-orange-600">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-slate-950 shadow-xl">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white">
                <HeartHandshake className="h-4 w-4" />
                For community organisers
              </div>

              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                Is your group, club, venue or event missing?
              </h2>

              <p className="mt-5 max-w-xl text-base leading-7 text-white/75">
                Blackrod Now becomes more useful when local organisers keep it
                updated. Add your organisation, submit an event, share a
                volunteering opportunity or correct an existing listing.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/submit-event"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-100"
                >
                  Submit an event
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  to="/submit-organisation"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-black text-white transition hover:bg-white/10"
                >
                  Add an organisation
                </Link>
              </div>
            </div>

            <div className="relative min-h-[320px]">
              <img
                src={IMAGES?.spotlight || CATEGORY_DETAILS.Community.image}
                alt="Community spotlight"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/40 to-transparent lg:bg-gradient-to-l" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}