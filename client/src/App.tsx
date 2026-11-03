import { Link, useMatch } from "react-router";
import { NavigationLink } from "./components/ui/NavigationLink";
import AppRouter from "./app/router";
import AuthStatus from "./features/auth/components/AuthStatus";
import { authClient } from "./lib/auth-client";
import { useOrganisedSocieties } from "./features/societies/hooks";
import { useScannerEvents } from "./features/scanner/hooks";

export default function App() {
  const loginPage = useMatch("/login");
  const registerPage = useMatch("/register");
  const forgotPage = useMatch("/forgot-password");
  const resetPage = useMatch("/reset-password");
  const verifyPage = useMatch("/verify-email");
  const { data: session } = authClient.useSession();
  const { data: societies } = useOrganisedSocieties();
  const { data: scannerEvents } = useScannerEvents();

  return (
    <>
      <a
        className="absolute -top-20 left-4 z-50 bg-raised p-3 focus:top-4"
        href="#page-content"
      >
        Skip to content
      </a>
      {!loginPage &&
        !registerPage &&
        !forgotPage &&
        !resetPage &&
        !verifyPage && (
          <header className="border-b border-line">
            <div className="mx-auto flex min-h-16 max-w-[1400px] items-center gap-8 px-6 py-3 max-lg:flex-wrap max-lg:gap-4 max-sm:px-4">
              <Link
                to="/events"
                className="font-serif text-sm font-semibold whitespace-nowrap no-underline"
              >
                University Events
              </Link>
              <nav
                className="flex flex-1 items-center gap-5 max-lg:order-3 max-lg:basis-full max-lg:overflow-x-auto"
                aria-label="Main navigation"
              >


                <NavigationLink to="/events">Events</NavigationLink>
                {session && (
                  <NavigationLink to="/bookings">My bookings</NavigationLink>
                )}

                {!!societies?.length && (
                  <NavigationLink to="/organiser">Organise</NavigationLink>
                )}
                
                {!!scannerEvents?.length && (
                  <NavigationLink to="/scanner">Check-in</NavigationLink>
                )}
              </nav>
              <div className="ml-auto text-sm [&_p]:m-0 [&_a+a]:ml-3">
                <AuthStatus />
              </div>
            </div>
          </header>
        )}
      <div id="page-content" tabIndex={-1} className="min-w-0 flex-1">
        <AppRouter />
      </div>
    </>
  );
}
