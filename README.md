# University Event & Ticketing Platform

This is a demo version of a full stack application used to manage university society events, balls and formal dinners. Payment and emailing functionality is disabled. You can login with the demo admin account on the login page.

## Features

- **Attendees:** browse events, reserve standard/vip tickets, edit guest names, meal choices, dietary requirements and accessibility needs, and view individual QR tickets to use during check-in.
- **Organisers:** create and publish events, manage capacity, ticket sale windows, review bookings, export catering lists, and manage society organisers and event door staff.
- **Seating:** attendees create or join groups using invite codes and organisers assign guests with or without their groups to tables, use a drag-and-drop seating board, and publish arrangements.
- **Admission:** authorised staff scan qr-code tickets or look up guests manually, with duplicate-admission checks and attendance tracking.
- **Event cycle:** reservations expire automatically, catering changes close at a given deadline and event cancellation cancels active bookings and revokes tickets.

## Roles and access

| Role | Access |
| --- | --- |
| Attendee | Manages their own bookings, guest details and needs, seating-group preferences, and tickets. |
| Society organiser | Manages events belonging to their society, including bookings, catering, seating, and staff access. |
| Door staff | Receives access to check-in and attendance for specific events. |


## Booking flow

1. An organiser configures an event, ticket tiers, and any meal options before publishing.
2. An attendee reserves places for up to 30 minutes, and no later than the event's reservation deadline.
3. The attendee saves guest details and confirms a free booking or completes simulated checkout.
4. Each guest receives a persistent QR ticket and can view their table assignment once seating is published.
5. Door staff validate tickets and record admission at the event.

## Technology and architecture

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL, Prisma |
| Authentication | Better Auth with society-scoped organiser permissions and event-specific scanner access |
| Background jobs | pg-boss for reservation expiry and queued email delivery |
| Testing | Node.js integration tests, Playwright, GitHub Actions |

React frontend communicated with the Express API. A separate background worker shares PostgreSQL with the API.

## Testing

Integration tests use the API and a separate PostgreSQL database to check booking logic, concurrency, access controls, and other vital logic. Playwright tests cover the main login and booking flows in the browser. GitHub Actions automates these tests alongside builds, lint, and type checks.
