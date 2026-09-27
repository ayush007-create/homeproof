import { useState } from "react";
import { LocateFixed, MapPin, Search } from "lucide-react";
import { api } from "../api.js";
import { formatAccuracy, formatDistance, getPosition, isPrecise } from "../location.js";
import { Field, FieldError } from "./Field.jsx";
import { HomeMap } from "./HomeMap.jsx";

// The home's address: from the phone's current location, or typed and looked up.
// Either way the result is a "place" from the server: { address, lat, lng, token, source }.
//   place / onPlace: the chosen place (null until one is chosen)
//   unit / onUnit:   apartment or unit (optional; lets neighbours in one building each add their home)
//   error:           a server error about the address (e.g. already registered)
export function AddressPicker({ place, onPlace, unit, onUnit, error, radiusM = 150 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(""); // "" | locating | searching
  const [problem, setProblem] = useState("");

  async function useLocation() {
    setProblem("");
    setResults(null);
    setBusy("locating");
    try {
      const fix = await getPosition({ maximumAge: 0 });
      if (!isPrecise(fix)) throw new Error(`Your location is too rough (${formatAccuracy(fix.acc)}) to pin your home. Turn on Precise Location and Wi-Fi, or type your address.`);
      const { result } = await api.reverseGeocode(fix);
      onPlace({ ...result, source: "gps" });
    } catch (err) {
      setProblem(
        err.code === 1
          ? "Location is blocked for this site. Allow it in your browser settings, or type your address."
          : err.code === 2 || err.code === 3
            ? "Couldn't get your location. Try again, or type your address."
            : err.code === "unsupported"
              ? "This browser can't share your location. Type your address."
              : err.message
      );
    } finally {
      setBusy("");
    }
  }

  async function search() {
    setProblem("");
    if (query.trim().length < 5) return setProblem("Type the street, city and ZIP code.");
    setBusy("searching");
    try {
      const { results } = await api.searchAddress(query.trim());
      setResults(results);
      if (!results.length) setProblem("We couldn't find that address. Check the street, city and ZIP, or use your current location.");
    } catch (err) {
      setProblem(err.message);
    } finally {
      setBusy("");
    }
  }

  const unitField = (
    <Field label="Apt, suite or unit" optional placeholder="Apt 2104" value={unit} maxLength={30} onChange={(e) => onUnit(e.target.value)} />
  );

  if (place) {
    return (
      <div className="stack-sm">
        <div className="field-label">Address</div>
        <div className="place-card card">
          <HomeMap lat={place.lat} lng={place.lng} radiusM={radiusM} />
          <div className="place-row">
            <span className="tile sm"><MapPin size={18} /></span>
            <div className="text">
              <strong>{place.address}</strong>
              <span>{place.source === "gps" ? `From your current location · ${formatAccuracy(place.accuracy)}` : "Found from the address you typed"}</span>
            </div>
            <button type="button" className="btn secondary sm" onClick={() => (onPlace(null), setResults(null))}>
              Change
            </button>
          </div>
        </div>
        <p className="field-hint">
          Check the pin is on your home. You can only record when you're within {formatDistance(radiusM)} of it.
        </p>
        {error && <FieldError>{error}</FieldError>}
        {unitField}
      </div>
    );
  }

  return (
    <div className="stack-sm">
      <div className="field-label">Address</div>
      <button type="button" className="btn secondary full" onClick={useLocation} disabled={Boolean(busy)}>
        {busy === "locating" ? <span className="spin accent" /> : <LocateFixed size={20} />}
        {busy === "locating" ? "Finding your home…" : "Use my current location"}
      </button>
      <div className="or-divider"><span>or type it</span></div>
      <div className="search-row">
        <input
          aria-label="Street address"
          placeholder="Street, city, ZIP"
          autoComplete="street-address"
          value={query}
          maxLength={200}
          enterKeyHint="search"
          onChange={(e) => (setQuery(e.target.value), setProblem(""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // search instead of submitting the form
              search();
            }
          }}
        />
        <button type="button" className="btn secondary sm" onClick={search} disabled={Boolean(busy)} aria-label="Search address">
          {busy === "searching" ? <span className="spin accent" /> : <Search size={18} />}
        </button>
      </div>
      {results?.length > 0 && (
        <ul className="place-results" aria-label="Matching addresses">
          {results.map((r) => (
            <li key={r.address}>
              <button type="button" className="place-option" disabled={!r.precise} onClick={() => onPlace({ ...r, source: "address" })}>
                <MapPin size={18} aria-hidden="true" />
                <span>
                  {r.address}
                  {!r.precise && <small>Only the street was found. Add the house number, or use your current location.</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(problem || error) && <FieldError>{problem || error}</FieldError>}
      {unitField}
    </div>
  );
}
