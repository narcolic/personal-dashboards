import { useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { searchLocations, type TravelInput, type TravelPlace } from "@/lib/travel";

export function PlaceEditor({
  place,
  busy,
  error,
  onClose,
  onSave,
}: {
  place?: TravelPlace;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: TravelInput) => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, onClose, busy);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [name, setName] = useState(place?.name ?? "");
  const [country, setCountry] = useState(place?.country ?? "");
  const [latitude, setLatitude] = useState(place?.latitude.toString() ?? "");
  const [longitude, setLongitude] = useState(place?.longitude.toString() ?? "");
  const [date, setDate] = useState(place?.visitDate ?? "");
  const [note, setNote] = useState(place?.note ?? "");
  const [manual, setManual] = useState(false);
  const [located, setLocated] = useState(Boolean(place));
  const locations = useQuery({
    queryKey: ["travel-location-search", submitted],
    queryFn: ({ signal }) => searchLocations(submitted, signal),
    enabled: submitted.length >= 2,
    staleTime: 300_000,
    retry: false,
  });

  function search() {
    if (query.trim().length < 2) return;
    if (submitted === query.trim()) void locations.refetch();
    else setSubmitted(query.trim());
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!located || !latitude.trim() || !longitude.trim()) return;
    onSave({
      name: name.trim(),
      country: country.trim(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      visitDate: date || null,
      note: note.trim() || null,
    });
  }

  return (
    <div className="travel-modal-backdrop">
      <div
        className="travel-modal"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-editor-title"
      >
        <header>
          <h2 id="place-editor-title">{t(place ? "travel.editPlace" : "travel.addPlace")}</h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t("travel.close")}>
            ×
          </button>
        </header>
        <form onSubmit={submit} className="travel-editor">
          <fieldset disabled={busy}>
            <label htmlFor="place-search">{t("travel.findPlace")}</label>
            <div className="travel-search-row">
              <input
                id="place-search"
                data-autofocus
                value={query}
                maxLength={160}
                placeholder={t("travel.searchHint")}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSubmitted("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    search();
                  }
                }}
              />
              <button
                type="button"
                className="travel-button"
                disabled={query.trim().length < 2 || locations.isFetching}
                onClick={search}
              >
                {t("travel.search")}
              </button>
            </div>
            <div aria-live="polite">
              {locations.isFetching && <p className="travel-muted">{t("travel.searching")}</p>}
              {locations.isError && <p role="alert">{t("travel.searchError")}</p>}
              {submitted && locations.isSuccess && locations.data.length === 0 && (
                <p className="travel-muted">{t("travel.noLocations")}</p>
              )}
            </div>
            {submitted && locations.data && (
              <ul className="travel-search-results" aria-label={t("travel.searchResults")}>
                {locations.data.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setName(result.name);
                        setCountry(result.country);
                        setLatitude(String(result.latitude));
                        setLongitude(String(result.longitude));
                        setLocated(true);
                        setSubmitted("");
                        setQuery("");
                      }}
                    >
                      <strong>{result.name}</strong>
                      <span>{[result.admin1, result.country].filter(Boolean).join(", ")}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="travel-provider">
              <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
                Open-Meteo
              </a>{" "}
              /{" "}
              <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
                GeoNames
              </a>{" "}
              · {t("travel.searchPrivacy")}
            </p>
            <button
              className="travel-text-button"
              type="button"
              aria-expanded={manual}
              onClick={() => setManual(!manual)}
            >
              {t("travel.manual")}
            </button>
            {manual && (
              <div className="travel-field-pair">
                <label>
                  {t("travel.latitude")}
                  <input
                    type="number"
                    required
                    step="any"
                    min={-90}
                    max={90}
                    value={latitude}
                    onChange={(event) => {
                      setLatitude(event.target.value);
                      setLocated(true);
                    }}
                  />
                </label>
                <label>
                  {t("travel.longitude")}
                  <input
                    type="number"
                    required
                    step="any"
                    min={-180}
                    max={180}
                    value={longitude}
                    onChange={(event) => {
                      setLongitude(event.target.value);
                      setLocated(true);
                    }}
                  />
                </label>
              </div>
            )}
            {located && (
              <p className="travel-location-confirmed" role="status">
                {t("travel.locationSet")} · {Number(latitude).toFixed(3)},{" "}
                {Number(longitude).toFixed(3)}
              </p>
            )}
            <div className="travel-field-pair">
              <label>
                {t("travel.placeName")}
                <input
                  required
                  maxLength={160}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                {t("travel.country")}
                <input
                  required
                  maxLength={100}
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                />
              </label>
            </div>
            <label>
              {t("travel.visitDate")}
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              {t("travel.note")}
              <textarea
                rows={3}
                maxLength={4000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("travel.noteHint")}
              />
            </label>
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          <footer>
            <button type="button" className="travel-button" onClick={onClose} disabled={busy}>
              {t("travel.cancel")}
            </button>
            <button
              type="submit"
              className="travel-button travel-primary"
              disabled={busy || !located || !latitude.trim() || !longitude.trim()}
            >
              {t(busy ? "travel.saving" : "travel.save")}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
