import { Component, lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { PlaceEditor } from "@/components/travel/PlaceEditor";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import {
  angularDistance,
  deletePlace,
  listPlaces,
  savePlace,
  travelKey,
  type TravelInput,
  type TravelPlace,
} from "@/lib/travel";
import "@/components/travel/travel.css";

const Globe = lazy(() => import("@/components/travel/TravelGlobe"));
const EMPTY: TravelPlace[] = [];
export const Route = createFileRoute("/_authenticated/travel")({ component: TravelPage });

function TravelPage() {
  const { user } = useAuth();
  return user ? <TravelWorkspace key={user.id} userId={user.id} /> : null;
}

function TravelWorkspace({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const placesQuery = useQuery({
    queryKey: travelKey(userId),
    queryFn: ({ signal }) => listPlaces(signal),
    staleTime: 30_000,
  });
  const places = placesQuery.data ?? EMPTY;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nearby, setNearby] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [editor, setEditor] = useState<TravelPlace | "new" | null>(null);
  const [removing, setRemoving] = useState<TravelPlace | null>(null);
  const selected = places.find((place) => place.id === selectedId);
  const visible = places.filter((place) =>
    `${place.name} ${place.country}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()),
  );
  const countries = new Set(places.map((place) => place.country.trim().toLocaleLowerCase())).size;
  const save = useMutation({
    mutationFn: ({ input, id }: { input: TravelInput; id?: string }) => savePlace(input, id),
    onSuccess: (place) => {
      client.setQueryData<TravelPlace[]>(travelKey(userId), (old = []) => [
        place,
        ...old.filter((item) => item.id !== place.id),
      ]);
      void client.invalidateQueries({ queryKey: travelKey(userId) });
      setSelectedId(place.id);
      setNearby([]);
      setFilter("");
      setEditor(null);
      toast.success(t("travel.saved"));
    },
  });
  const remove = useMutation({
    mutationFn: deletePlace,
    onSuccess: (_, id) => {
      client.setQueryData<TravelPlace[]>(travelKey(userId), (old = []) =>
        old.filter((place) => place.id !== id),
      );
      void client.invalidateQueries({ queryKey: travelKey(userId) });
      setRemoving(null);
      if (selectedId === id) setSelectedId(null);
      setNearby([]);
      toast.success(t("travel.removed"));
    },
  });
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
          new Date(`${value}T12:00:00`),
        )
      : t("travel.undated");
  const openEditor = (place: TravelPlace | "new") => {
    save.reset();
    setEditor(place);
  };

  return (
    <section className="travel-workspace">
      <header className="travel-heading">
        <div>
          <p className="travel-eyebrow">{t("travel.personalAtlas")}</p>
          <h1>{t("travel.title")}</h1>
          <p className="travel-muted">{t("travel.subtitle")}</p>
        </div>
        <button
          type="button"
          className="travel-button travel-primary"
          onClick={() => openEditor("new")}
        >
          + {t("travel.addPlace")}
        </button>
      </header>
      <div className="travel-stats">
        <span>
          <strong>{placesQuery.isPending || placesQuery.isError ? "—" : places.length}</strong>{" "}
          {t("travel.places")}
        </span>
        <span>
          <strong>{placesQuery.isPending || placesQuery.isError ? "—" : countries}</strong>{" "}
          {t("travel.countries")}
        </span>
        <span className="travel-private">{t("travel.private")}</span>
      </div>
      <div className="travel-layout">
        <div className="travel-globe-panel">
          <GlobeBoundary
            fallback={
              <div className="travel-world travel-globe-message" role="status">
                {t("travel.globeUnavailable")}
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="travel-world travel-globe-message" role="status">
                  {t("travel.loadingGlobe")}
                </div>
              }
            >
              <Globe
                places={places}
                selected={selected}
                onSelect={(place) => {
                  setSelectedId(place.id);
                  setNearby(
                    places
                      .filter((item) => angularDistance(place, item) <= 4)
                      .map((item) => item.id),
                  );
                }}
              />
            </Suspense>
          </GlobeBoundary>
        </div>
        <aside className="travel-sidebar" aria-label={t("travel.visitedPlaces")}>
          <div className="travel-list-heading">
            <h2>{t("travel.visitedPlaces")}</h2>
            <span>{places.length.toString().padStart(2, "0")}</span>
          </div>
          {placesQuery.isPending ? (
            <p role="status" className="travel-state">
              {t("travel.loading")}
            </p>
          ) : placesQuery.isError ? (
            <div className="travel-state" role="alert">
              <p>{t("travel.loadError")}</p>
              <button className="travel-button" onClick={() => void placesQuery.refetch()}>
                {t("travel.retry")}
              </button>
            </div>
          ) : places.length === 0 ? (
            <div className="travel-empty">
              <div aria-hidden="true">◎</div>
              <h3>{t("travel.emptyTitle")}</h3>
              <p>{t("travel.emptyDescription")}</p>
              <button className="travel-button" onClick={() => openEditor("new")}>
                {t("travel.firstPlace")}
              </button>
            </div>
          ) : (
            <>
              <input
                className="travel-filter"
                aria-label={t("travel.filter")}
                placeholder={t("travel.filter")}
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <ul className="travel-place-list">
                {visible.map((place, index) => (
                  <li key={place.id}>
                    <button
                      className={selectedId === place.id ? "is-selected" : ""}
                      aria-pressed={selectedId === place.id}
                      onClick={() => {
                        setSelectedId(place.id);
                        setNearby([]);
                      }}
                    >
                      <span className="travel-place-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="travel-place-text">
                        <strong>{place.name}</strong>
                        <span>{place.country}</span>
                      </span>
                      <span className="travel-place-dot" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
              {visible.length === 0 && <p className="travel-state">{t("travel.noMatches")}</p>}
            </>
          )}
          {nearby.length > 1 && (
            <div className="travel-nearby">
              <h3>{t("travel.nearby")}</h3>
              {places
                .filter((place) => nearby.includes(place.id))
                .map((place) => (
                  <button
                    className="travel-button"
                    key={place.id}
                    aria-pressed={selectedId === place.id}
                    onClick={() => setSelectedId(place.id)}
                  >
                    {place.name} · {date(place.visitDate)}
                  </button>
                ))}
            </div>
          )}
          {selected ? (
            <section className="travel-details" aria-label={t("travel.details")} aria-live="polite">
              <p className="travel-eyebrow">{t("travel.selectedPlace")}</p>
              <h2>{selected.name}</h2>
              <p>{selected.country}</p>
              <dl>
                <div>
                  <dt>{t("travel.visited")}</dt>
                  <dd>{date(selected.visitDate)}</dd>
                </div>
                <div>
                  <dt>{t("travel.coordinates")}</dt>
                  <dd>
                    {selected.latitude.toFixed(3)}, {selected.longitude.toFixed(3)}
                  </dd>
                </div>
              </dl>
              {selected.note && <p className="travel-note">{selected.note}</p>}
              <div className="travel-detail-actions">
                <button className="travel-button" onClick={() => openEditor(selected)}>
                  {t("travel.edit")}
                </button>
                <button
                  className="travel-text-button text-destructive"
                  onClick={() => {
                    remove.reset();
                    setRemoving(selected);
                  }}
                >
                  {t("travel.remove")}
                </button>
              </div>
            </section>
          ) : (
            places.length > 0 && <p className="travel-state">{t("travel.selectHint")}</p>
          )}
        </aside>
      </div>
      {editor && (
        <PlaceEditor
          place={editor === "new" ? undefined : editor}
          busy={save.isPending}
          error={save.error?.message ?? null}
          onClose={() => setEditor(null)}
          onSave={(input) => save.mutate({ input, id: editor === "new" ? undefined : editor.id })}
        />
      )}
      {removing && (
        <RemovePlace
          place={removing}
          busy={remove.isPending}
          error={remove.error?.message}
          onClose={() => setRemoving(null)}
          onRemove={() => remove.mutate(removing.id)}
        />
      )}
    </section>
  );
}

function RemovePlace({
  place,
  busy,
  error,
  onClose,
  onRemove,
}: {
  place: TravelPlace;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, onClose, busy);
  return (
    <div className="travel-modal-backdrop">
      <div
        className="travel-modal travel-delete"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="travel-delete-title"
        aria-describedby="travel-delete-description"
        ref={ref}
      >
        <h2 id="travel-delete-title">{t("travel.removeTitle", { name: place.name })}</h2>
        <p id="travel-delete-description">{t("travel.removeDescription")}</p>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button data-autofocus className="travel-button" onClick={onClose} disabled={busy}>
            {t("travel.cancel")}
          </button>
          <button className="travel-button text-destructive" onClick={onRemove} disabled={busy}>
            {t(busy ? "travel.removing" : "travel.remove")}
          </button>
        </footer>
      </div>
    </div>
  );
}

class GlobeBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
