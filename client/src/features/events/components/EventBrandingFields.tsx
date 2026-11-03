import { Input } from "../../../components/ui/Fields";

const headingColours = [
  { name: "Default", value: "", swatch: "var(--color-ink)" },
  { name: "Lavender", value: "#b3b3fc", swatch: "#b3b3fc" },
  { name: "Blue", value: "#a8d0ff", swatch: "#a8d0ff" },
  { name: "Rose", value: "#ffb3ba", swatch: "#ffb3ba" },
  { name: "Gold", value: "#ffe6a3", swatch: "#ffe6a3" },
  { name: "Green", value: "#b5e6be", swatch: "#b5e6be" },
];

type Props = {
  bannerUrl?: string | null;
  headingColor?: string | null;
};

export default function EventBrandingFields({
  bannerUrl,
  headingColor,
}: Props) {
  return (
    <fieldset className="mt-6 border-t border-line pt-5">
      <legend className="px-1 text-ink">Public event page</legend>
      <div className="mb-4">
        <label htmlFor="event-banner-url">Banner image URL (optional)</label>
        <Input
          id="event-banner-url"
          name="bannerUrl"
          type="url"
          pattern="https://.*"
          maxLength={2048}
          defaultValue={bannerUrl ?? ""}
          placeholder="https://example.com/banner.jpg"
          aria-describedby="event-banner-help"
        />
        <p id="event-banner-help" className="mt-2 text-muted">
          Direct HTTPS image URL. Cropped to 3:1.
        </p>
      </div>
      <fieldset>
        <legend>Heading colour</legend>
        <div className="mb-4 flex flex-wrap gap-3">
          {headingColours.map((colour) => (
            <label
              key={colour.name}
              className="mb-0 flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 has-[:checked]:border-ink"
            >
              <Input
                type="radio"
                name="headingColor"
                value={colour.value}
                defaultChecked={colour.value === (headingColor ?? "")}
              />
              <span
                aria-hidden="true"
                className="size-3 rounded-full"
                style={{ backgroundColor: colour.swatch }}
              />
              <span>{colour.name}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-muted">
          Light shades keep headings readable on the dark background.
        </p>
      </fieldset>
    </fieldset>
  );
}
