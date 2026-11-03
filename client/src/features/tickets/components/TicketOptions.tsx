import { formatPrice } from "../../../lib/format";
import type { TicketTypeSummary } from "../../events/api";
import { useNow } from "../../../lib/useNow";

type Props = {
  ticketTypes: TicketTypeSummary[];
};

function getSalesStatus(ticket: TicketTypeSummary, now: number) {
  if (now < new Date(ticket.salesStart).getTime()) {
    return `Opens ${new Date(ticket.salesStart).toLocaleString("en-GB")}`;
  }

  if (now >= new Date(ticket.salesEnd).getTime()) {
    return "Sales closed";
  }

  return null;
}

export default function TicketOptions({ ticketTypes }: Props) {
  const now = useNow();
  return (
    <section aria-labelledby="ticket-options-heading">
      <h2 id="ticket-options-heading" className="mb-1">Tickets</h2>
      <p className="text-xs text-muted">Demo bookings only.</p>

      {ticketTypes.length === 0 ? (
        <p>Ticket options haven’t been announced yet.</p>
      ) : (
        ticketTypes.map((ticket) => (
          <article className="border-t border-line py-3" key={ticket.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{ticket.tier === "STANDARD" ? "Standard" : "VIP"}</span>
              <span className="text-muted tabular-nums">{formatPrice(ticket.pricePence)} each</span>
            </div>
            {getSalesStatus(ticket, now) && <p className="mt-1 mb-0 text-xs text-muted">{getSalesStatus(ticket, now)}</p>}
          </article>
        ))
      )}
    </section>
  );
}
