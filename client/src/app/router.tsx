import { Page } from "../components/ui/Layout";
import EventWorkspace from "./EventWorkspace";
import EventOverviewPage from "../pages/organiser/EventOverviewPage";
import EventTicketsPage from "../pages/organiser/EventTicketsPage";
import EventSettingsPage from "../pages/organiser/EventSettingsPage";
import { Navigate, Route, Routes } from "react-router";
import EventsPage from "../pages/public/EventsPage";
import CreateEventPage from "../pages/organiser/CreateEventPage";
import EventDetailsPage from "../pages/public/EventDetailsPage";
import AuthPage from "../pages/public/AuthPage";
import EmailAuthPage from "../pages/public/EmailAuthPage";
import MyBookingsPage from "../pages/student/MyBookingsPage";
import OrganiserDashboardPage from "../pages/organiser/OrganiserDashboardPage";
import EventBookingsPage from "../pages/organiser/EventBookingsPage";
import BookingGuestsPage from "../pages/student/BookingGuestsPage";
import EventGuestsPage from "../pages/organiser/EventGuestsPage";
import EventSeatingPage from "../pages/organiser/EventSeatingPage";
import BookingTicketsPage from "../pages/student/BookingTicketsPage";
import EventCheckInPage from "../pages/scanner/EventCheckInPage";
import ScannerDashboardPage from "../pages/scanner/ScannerDashboardPage";
import EventStaffPage from "../pages/organiser/EventStaffPage";
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/login" element={<AuthPage key="login" mode="login" />} />
      <Route
        path="/forgot-password"
        element={<EmailAuthPage key="forgot" mode="forgot-password" />}
      />
      <Route
        path="/reset-password"
        element={<EmailAuthPage key="reset" mode="reset-password" />}
      />
      <Route
        path="/verify-email"
        element={<EmailAuthPage key="verify" mode="verify-email" />}
      />

      <Route
        path="/register"
        element={<AuthPage key="register" mode="register" />}
      />

      <Route path="/events" element={<EventsPage />} />

      <Route path="/organiser/events/new" element={<CreateEventPage />} />
      <Route path="/organiser/events/:eventId" element={<EventWorkspace />}>
        <Route index element={<EventOverviewPage />} />
        <Route path="bookings" element={<EventBookingsPage />} />
        <Route path="tickets" element={<EventTicketsPage />} />
        <Route path="guests" element={<EventGuestsPage />} />
        <Route path="seating" element={<EventSeatingPage />} />
        <Route path="staff" element={<EventStaffPage />} />
        <Route path="settings" element={<EventSettingsPage />} />
      </Route>
      <Route path="/organiser" element={<OrganiserDashboardPage />} />
      <Route path="/bookings" element={<MyBookingsPage />} />
      <Route
        path="/bookings/:bookingId/guests"
        element={<BookingGuestsPage />}
      />
      <Route path="/events/:eventId" element={<EventDetailsPage />} />
      <Route
        path="/bookings/:bookingId/tickets"
        element={<BookingTicketsPage />}
      />
      <Route path="/scanner" element={<ScannerDashboardPage />} />
      <Route path="/scanner/events/:eventId" element={<EventCheckInPage />} />

      <Route
        path="*"
        element={
          <Page>
            <h1>Page not found</h1>
          </Page>
        }
      />
    </Routes>
  );
}
