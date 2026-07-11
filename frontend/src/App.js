import React from "react";
import "@/App.css";
import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { AppProvider } from "@/context/AppContext";
import Layout from "@/components/Layout";

import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetail from "@/pages/EventDetail";
import Organisations from "@/pages/Organisations";
import OrganisationDetail from "@/pages/OrganisationDetail";
import SubmitEvent from "@/pages/SubmitEvent";
import AddOrganisation from "@/pages/AddOrganisation";
import Admin from "@/pages/Admin";
import OrgDashboard from "@/pages/OrgDashboard";
import LocalFeed from "@/pages/LocalFeed";
import Venues from "@/pages/Venues";
import Volunteering from "@/pages/Volunteering";
import Notifications from "@/pages/Notifications";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import Preferences from "@/pages/Preferences";
import Unsubscribe from "@/pages/Unsubscribe";
import OrgProfileEdit from "@/pages/OrgProfileEdit";
import EventEdit from "@/pages/EventEdit";

export default function App() {
    return (
        <AppProvider>
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/events" element={<Events />} />
                        <Route path="/events/:id" element={<EventDetail />} />

                        <Route path="/organisations" element={<Organisations />} />
                        <Route
                            path="/organisations/:slug"
                            element={<OrganisationDetail />}
                        />

                        <Route path="/submit-event" element={<SubmitEvent />} />
                        <Route path="/edit-event/:id" element={<EventEdit />} />
                        <Route path="/add-organisation" element={<AddOrganisation />} />
                        <Route path="/local-feed" element={<LocalFeed />} />
                        <Route path="/venues" element={<Venues />} />
                        <Route path="/volunteering" element={<Volunteering />} />
                        <Route path="/notifications" element={<Notifications />} />

                        <Route path="/admin" element={<Admin />} />
                        <Route
                            path="/organisation-dashboard"
                            element={<OrgDashboard />}
                        />

                        <Route path="/faq" element={<FAQ />} />
                        <Route path="/help" element={<FAQ />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/preferences/:token" element={<Preferences />} />
                        <Route path="/unsubscribe/:token" element={<Unsubscribe />} />
                        <Route path="/edit-organisation/:slug" element={<OrgProfileEdit />} />
                    </Routes>
                </Layout>

                <Toaster richColors closeButton position="top-right" />
            </BrowserRouter>
        </AppProvider>
    );
}