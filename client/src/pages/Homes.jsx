import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRight, House, MapPin, MapPinCheck, Navigation, Plus } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { money, plural } from "../format.js";
import { atHome, distanceM, formatDistance, getPosition, isPrecise, locationBlocked } from "../location.js";
import { AddressPicker } from "../components/AddressPicker.jsx";
import { Field, FieldError } from "../components/Field.jsx";
import { NoHomesArt } from "../components/Illustrations.jsx";
import { Sheet } from "../components/Sheet.jsx";
import { CardSkeletons, ErrorState, Skeleton } from "../components/States.jsx";

export default function Homes() {
  const { user } = useAuth();
  const [homes, setHomes] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const here = useCurrentFix();

  const load = useCallback(() => {
    setError("");
    api.homes().then((r) => setHomes(r.homes)).catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const firstName = user.name.split(" ")[0];
  const sum = (key) => homes?.reduce((s, h) => s + (h[key] || 0), 0) ?? 0;
  const isEmpty = homes?.length === 0;

  // With the user's location: how far each home is, nearest first, and which one they're at.
  const withDistance = (homes ?? []).map((home) => ({
    home,
    distance: here?.lat != null && home.location ? distanceM(here, home.location) : null,
    inside: here?.lat != null && isPrecise(here) && atHome(here, home),
  }));
  const sorted = here?.lat != null ? [...withDistance].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)) : withDistance;
  const nearest = sorted.find((h) => h.distance != null);

  return (
    <main className="page has-bar">
      {isEmpty ? (
        <FirstRun name={firstName} />
      ) : (
        <>
          <div className="page-head">
            <span className="eyebrow">Hi {firstName}</span>
            <h1>My Homes</h1>
          </div>

          {error ? (
            <ErrorState title="Couldn't load your homes" message={error} onRetry={load} />
          ) : !homes ? (
            <>
              <Skeleton className="sk-hero" />
              <CardSkeletons count={2} tall />
            </>
          ) : (
            <>
              <section className="overview card" aria-label="Everything you own">
                <div className="overview-top">
                  <div>
                    <span className="eyebrow">Everything you own</span>
                    <span className="total">{money(sum("total"))}</span>
                  </div>
                  <span className="num">{plural(sum("itemCount"), "item")}</span>
                </div>
                <div className="card-foot">
                  <span>
                    Total <strong>{sum("documentedRoomCount")}</strong> {sum("documentedRoomCount") === 1 ? "room" : "rooms"} documented
                  </span>
                  <span>
                    <strong>{homes.length}</strong> {homes.length === 1 ? "home" : "homes"}
                  </span>
                </div>
              </section>

              {nearest && <NearbyBanner {...nearest} />}
              {here === "blocked" && <p className="muted small">Turn on location to see which home you're at.</p>}

              <ul className="card-list">
                {sorted.map(({ home, distance, inside }) => (
                  <li key={home._id}>
                    <Link to={`/homes/${home._id}`} className="card home-card">
                      <span className="home-card-main">
                        <span className="tile"><House size={22} /></span>
                        <span className="body">
                          <strong className="title">{home.name}</strong>
                          {home.address && (
                            <span className="line"><MapPin size={14} aria-hidden="true" /><span>{home.address}</span></span>
                          )}
                        </span>
                        <span className="value-chev">
                          <span className="money">{money(home.total)}</span>
                          <ChevronRight size={18} aria-hidden="true" />
                        </span>
                      </span>
                      <span className="card-foot">
                        <span>{plural(home.documentedRoomCount, "room")} documented</span>
                        <span>{plural(home.itemCount, "item")}</span>
                        {!home.location ? (
                          <span className="dist-chip warn">Address needed</span>
                        ) : inside ? (
                          <span className="dist-chip here"><MapPinCheck size={14} aria-hidden="true" /> You're here</span>
                        ) : (
                          distance != null && <span className="dist-chip">{formatDistance(distance)} away</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {homes && (
        <div className="bottom-bar">
          <button className={`btn primary grow ${isEmpty ? "big" : ""}`} onClick={() => setAdding(true)}>
            <Plus size={20} /> Add home
          </button>
        </div>
      )}

      {adding && <AddHomeSheet onClose={() => setAdding(false)} />}
    </main>
  );
}

// The user's position once, for "nearest home". Asks for permission unless it's
// already blocked. Returns null (still finding), a fix, or "blocked" / "unavailable".
// The position stays on the phone: distances are worked out here.
function useCurrentFix() {
  const [fix, setFix] = useState(null);
  useEffect(() => {
    let live = true;
    locationBlocked().then((blocked) => {
      if (!live) return;
      if (blocked) return setFix("blocked");
      getPosition({ maximumAge: 60_000, timeout: 15_000 })
        .then((f) => live && setFix(f))
        .catch((err) => live && setFix(err?.code === 1 ? "blocked" : "unavailable"));
    });
    return () => {
      live = false;
    };
  }, []);
  return fix;
}

// "You're at …" when the user is at one of their homes, otherwise the nearest one.
function NearbyBanner({ home, distance, inside }) {
  return (
    <Link to={`/homes/${home._id}`} className={`card nearby-card ${inside ? "here" : ""}`}>
      <span className={`tile sm ${inside ? "ok" : ""}`}>{inside ? <MapPinCheck size={18} /> : <Navigation size={18} />}</span>
      <span className="text">
        <strong>{inside ? `You're at ${home.name}` : `Nearest home: ${home.name}`}</strong>
        <span>{inside ? "Recording is unlocked here." : `${formatDistance(distance)} away · recording unlocks when you're there`}</span>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

// Empty state for new users, doubling as onboarding: what the 3 steps are.
function FirstRun({ name }) {
  const steps = [
    ["Add a home", "Name and address · 30 sec"],
    ["Film each room", "About a minute per room"],
    ["Keep your claim report ready", "One tap after a hurricane, fire or break-in"],
  ];
  return (
    <>
      <span className="eyebrow">Welcome, {name}</span>
      <div className="state-art"><NoHomesArt /></div>
      <div className="page-head">
        <h1 style={{ fontSize: "1.625rem" }}>Add your first home to start your inventory</h1>
        <p className="muted">Then film each room. HomeProof lists what you own and what it's worth.</p>
      </div>
      <ol className="steps-list card" style={{ margin: 0 }}>
        {steps.map(([title, sub], i) => (
          <li key={title} className="step-row">
            <span className={`step-num ${i === 0 ? "active" : ""}`}>{i + 1}</span>
            <div>
              <strong style={{ fontWeight: 600 }}>{title}</strong>
              <span className="sub">{sub}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function AddHomeSheet({ onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [place, setPlace] = useState(null);
  const [unit, setUnit] = useState("");
  const [error, setError] = useState({});
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return setError({ name: "Give this home a name." });
    if (!place) return setError({ address: "Add the address: use your current location or search for it." });
    setBusy(true);
    try {
      const { home } = await api.createHome({ name, unit, placeToken: place.token });
      navigate(`/homes/${home._id}`);
    } catch (err) {
      setError({ [err.field || "form"]: err.message });
      setBusy(false);
    }
  }

  return (
    <Sheet title="Add a home" onClose={onClose}>
      <form onSubmit={save} className="stack-sm" noValidate>
        <Field label="Name" placeholder="Miami Apartment" value={name} maxLength={80} onChange={(e) => (setName(e.target.value), setError({}))} error={error.name} />
        <AddressPicker
          place={place}
          onPlace={(p) => (setPlace(p), setError({}))}
          unit={unit}
          onUnit={(u) => (setUnit(u), setError({}))}
          error={error.address}
        />
        {error.form && <FieldError>{error.form}</FieldError>}
        <button className="btn primary full" disabled={busy}>{busy ? "Saving…" : "Save home"}</button>
      </form>
    </Sheet>
  );
}
