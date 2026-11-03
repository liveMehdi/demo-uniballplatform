import { Button } from "../../../components/ui/Button";
import { useCancelBooking } from "../hooks";

type Props = {
  bookingId: string;
};

export default function CancelBookingButton({ bookingId }: Props) {
  const { mutate, isPending, error } = useCancelBooking();

  return (
    <div>
      <Button
        variant="danger"
        type="button"
        disabled={isPending}
        onClick={() => mutate(bookingId)}
      >
        {isPending ? "Cancelling..." : "Cancel reservation"}
      </Button>

      {error && <p role="alert">{error.message}</p>}
    </div>
  );
}
