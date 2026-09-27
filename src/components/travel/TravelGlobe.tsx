import { useEffect, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { MeshPhongMaterial } from "three";
import { useTranslation } from "react-i18next";
import type { TravelPlace } from "@/lib/travel";

export default function TravelGlobe({
  places,
  selected,
  onSelect,
}: {
  places: TravelPlace[];
  selected: TravelPlace | undefined;
  onSelect: (place: TravelPlace) => void;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const globe = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [land, setLand] = useState<object[]>([]);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [material] = useState(() => new MeshPhongMaterial({ color: "#081e2d", shininess: 8 }));
  const duration = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);

  useEffect(() => {
    const element = container.current!;
    const resize = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height),
      }),
    );
    resize.observe(element);
    const abort = new AbortController();
    void fetch("/travel/land.geojson", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Land could not load");
        const data = (await response.json()) as { features: object[] };
        setLand(data.features);
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => {
      resize.disconnect();
      abort.abort();
    };
  }, []);

  useEffect(() => {
    if (ready && selected)
      globe.current?.pointOfView(
        { lat: selected.latitude, lng: selected.longitude, altitude: 1.25 },
        duration(),
      );
  }, [selected, ready]);

  useEffect(() => {
    if (!ready) return;
    const canvas = globe.current?.renderer().domElement;
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    const visibility = () => {
      if (document.hidden) globe.current?.pauseAnimation();
      else globe.current?.resumeAnimation();
    };
    canvas?.addEventListener("webglcontextlost", lost);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      canvas?.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [ready]);

  function move(lat: number, lng: number, scale = 1) {
    const view = globe.current?.pointOfView();
    if (view)
      globe.current?.pointOfView(
        {
          lat: Math.max(-85, Math.min(85, view.lat + lat)),
          lng: view.lng + lng,
          altitude: Math.max(0.35, Math.min(4, view.altitude * scale)),
        },
        duration(),
      );
  }

  return (
    <div className="travel-world" ref={container}>
      {failed ? (
        <div className="travel-globe-message" role="status">
          {t("travel.globeUnavailable")}
        </div>
      ) : (
        <>
          <div
            className="travel-canvas"
            tabIndex={0}
            role="region"
            aria-label={t("travel.globeLabel")}
            aria-describedby="globe-help"
            onKeyDown={(event) => {
              const actions: Record<string, () => void> = {
                ArrowLeft: () => move(0, -15),
                ArrowRight: () => move(0, 15),
                ArrowUp: () => move(15, 0),
                ArrowDown: () => move(-15, 0),
                "+": () => move(0, 0, 0.8),
                "=": () => move(0, 0, 0.8),
                "-": () => move(0, 0, 1.25),
                Home: () =>
                  globe.current?.pointOfView({ lat: 25, lng: 15, altitude: 2.2 }, duration()),
              };
              if (actions[event.key]) {
                event.preventDefault();
                actions[event.key]();
              }
            }}
          >
            {size.width > 0 && (
              <Globe
                ref={globe}
                width={size.width}
                height={size.height}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={material}
                animateIn={false}
                atmosphereColor="#328aa1"
                atmosphereAltitude={0.14}
                showGraticules
                polygonsData={land}
                polygonCapColor={() => "#285464"}
                polygonSideColor={() => "#162e3a"}
                polygonStrokeColor={() => "#52808a"}
                polygonAltitude={0.002}
                polygonsTransitionDuration={0}
                pointsData={places}
                pointLat="latitude"
                pointLng="longitude"
                pointAltitude={0.018}
                pointColor={(point) =>
                  (point as TravelPlace).id === selected?.id ? "#ffffff" : "#ff9d45"
                }
                pointRadius={(point) => ((point as TravelPlace).id === selected?.id ? 1.5 : 1.1)}
                pointsTransitionDuration={0}
                pointLabel={(point) => {
                  const el = document.createElement("span");
                  el.textContent = (point as TravelPlace).name;
                  return el.innerHTML;
                }}
                onPointClick={(point) => onSelect(point as TravelPlace)}
                onGlobeReady={() => {
                  const api = globe.current;
                  if (!api) return;
                  api.renderer().setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                  const controls = api.controls();
                  controls.enablePan = false;
                  controls.minDistance = 135;
                  controls.maxDistance = 500;
                  controls.enableDamping = !window.matchMedia("(prefers-reduced-motion: reduce)")
                    .matches;
                  api.pointOfView({ lat: 25, lng: 15, altitude: 2.2 }, 0);
                  setReady(true);
                }}
              />
            )}
          </div>
          <div className="travel-world-label" aria-hidden="true">
            {t("travel.yourWorld")} <span>01 / EARTH</span>
          </div>
          <div className="travel-globe-controls" aria-label={t("travel.controls")}>
            <button type="button" onClick={() => move(0, 0, 0.8)} aria-label={t("travel.zoomIn")}>
              +
            </button>
            <button type="button" onClick={() => move(0, 0, 1.25)} aria-label={t("travel.zoomOut")}>
              −
            </button>
            <button
              type="button"
              onClick={() =>
                globe.current?.pointOfView({ lat: 25, lng: 15, altitude: 2.2 }, duration())
              }
            >
              {t("travel.reset")}
            </button>
          </div>
          <div className="travel-legend">
            <span />
            {t("travel.visited")}
            <span className="selected" />
            {t("travel.selected")}
          </div>
          <p id="globe-help" className="travel-globe-help">
            {t("travel.globeHelp")}
          </p>
        </>
      )}
      <a
        className="travel-attribution"
        href="https://www.naturalearthdata.com/about/terms-of-use/"
        target="_blank"
        rel="noreferrer"
      >
        Natural Earth
      </a>
    </div>
  );
}
