import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Check, ChevronLeft, CircleHelp, CloudLightning, Download, ExternalLink, FileText, Flame, ShieldAlert } from "lucide-react";
import { api, photoUrl } from "../api.js";
import { useAuth } from "../auth.jsx";
import { money, plural, spokenMoney } from "../format.js";
import { Field, FieldError } from "../components/Field.jsx";
import { NoItemsArt } from "../components/Illustrations.jsx";
import { ItemPhoto } from "../components/ItemPhoto.jsx";
import { EmptyState, ErrorState, Skeleton } from "../components/States.jsx";
import { prepareSpeech, unlockAudio } from "../voice.js";

const EVENTS = [
  { id: "hurricane", label: "Hurricane", icon: CloudLightning },
  { id: "fire", label: "Fire", icon: Flame },
  { id: "break-in", label: "Break-in", icon: ShieldAlert },
  { id: "other", label: "Other", icon: CircleHelp },
];

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
const longDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function Report() {
  const { homeId } = useParams();
  const [home, setHome] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [event, setEvent] = useState("hurricane");
  const [date, setDate] = useState("");
  const [state, setState] = useState("idle"); // idle | working | ready | error
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState(null); // { url, filename, reportId, pages }
  const downloadRef = useRef(null);

  const load = useCallback(() => {
    setLoadError("");
    api.home(homeId).then((r) => setHome(r.home)).catch((err) => setLoadError(err.message));
  }, [homeId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => () => {
    if (pdf) URL.revokeObjectURL(pdf.url);
  }, [pdf]);

  async function generate() {
    unlockAudio(); // this tap lets the voice line play when the PDF is ready
    setState("working");
    setError("");
    setPdf(null);
    try {
      const { blob, reportId, pages } = await api.report(homeId, { event, date });
      const slug = home.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "Home";
      setPdf({ url: URL.createObjectURL(blob), filename: `HomeProof-Claim-Report-${slug}.pdf`, reportId, pages });
      setState("ready");
      prepareSpeech(`Your claim report is ready. ${plural(home.itemCount, "item")}, ${spokenMoney(home.total)} total.`)();
    } catch (err) {
      setError(err.message);
      setState("error");
    }
  }

  // Start the download as soon as the PDF is ready.
  useEffect(() => {
    if (state === "ready") downloadRef.current?.click();
  }, [state]);

  const back = (
    <Link to={`/homes/${homeId}`} className="back-link">
      <ChevronLeft size={22} /> {home?.name || "Home"}
    </Link>
  );

  if (loadError) {
    return (
      <main className="page">
        {back}
        <ErrorState title="Couldn't load this home" message={loadError} onRetry={load} />
      </main>
    );
  }
  if (!home) {
    return (
      <main className="page">
        {back}
        <Skeleton className="sk-title" />
        <Skeleton className="sk-hero" />
      </main>
    );
  }
  if (!home.itemCount) {
    return (
      <main className="page">
        {back}
        <EmptyState
          art={<NoItemsArt />}
          title="Nothing to report yet"
          action={<Link to={`/homes/${homeId}/rooms/new`} className="btn primary">Add and scan a room</Link>}
        >
          Scan at least one room first. The report lists every item with its photo and estimated value.
        </EmptyState>
      </main>
    );
  }

  const roomsWithItems = home.rooms.filter((r) => r.itemCount).length;

  if (state === "ready") {
    return (
      <main className="page has-bar">
        <div className="page-nav">{back}</div>
        <div className="ready-head">
          <span className="check-circle"><Check size={24} strokeWidth={3} /></span>
          <div>
            <h1>Your claim report is ready</h1>
            <span className="muted">
              Downloaded{pdf.pages ? ` · ${plural(pdf.pages, "page")}` : ""} · PDF
            </span>
          </div>
        </div>

        <PaperPreview home={home} event={EVENTS.find((e) => e.id === event)?.label} date={date} reportId={pdf.reportId} pages={pdf.pages} />

        <div className="ready-foot">
          <span>Send it to your insurer with your claim.</span>
          <button className="link-btn" onClick={() => setState("idle")}>Change details</button>
        </div>

        <div className="bottom-bar">
          <a href={pdf.url} download={pdf.filename} ref={downloadRef} className="btn secondary" aria-label="Download PDF">
            <Download size={18} /> PDF
          </a>
          <a href={pdf.url} target="_blank" rel="noreferrer" className="btn primary grow">
            <ExternalLink size={18} /> Open report
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page has-bar tall-bar">
      <div className="page-nav">{back}</div>
      <div className="page-head">
        <span className="eyebrow">Claim report</span>
        <h1>{home.name}</h1>
      </div>

      <div className="report-card card">
        <span className="mini-page" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </span>
        <div>
          <span className="total md">{money(home.total)}</span>
          <span className="muted">
            {plural(home.itemCount, "item")} in {plural(roomsWithItems, "room")}, grouped by room with photos
          </span>
        </div>
      </div>

      <fieldset className="event-picker" disabled={state === "working"}>
        <legend>What happened?</legend>
        <div className="event-grid">
          {EVENTS.map(({ id, label, icon: Icon }) => (
            <label key={id} className={`event-tile ${event === id ? "selected" : ""}`}>
              <input type="radio" name="event" value={id} checked={event === id} onChange={() => setEvent(id)} />
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
              {event === id && (
                <span className="tile-check" aria-hidden="true"><Check size={12} strokeWidth={3.5} /></span>
              )}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Date of the event" optional type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} disabled={state === "working"} />

      {state === "error" && <FieldError>{error}</FieldError>}

      <div className="bottom-bar stacked">
        <p className="bar-note">Values are estimated replacement costs, not a certified appraisal.</p>
        <button className="btn primary full" onClick={generate} disabled={state === "working"}>
          {state === "working" ? (
            <><span className="spin" /> Writing your report…</>
          ) : (
            <><FileText size={20} /> {state === "error" ? "Try again" : "Generate report"}</>
          )}
        </button>
      </div>
    </main>
  );
}

// A small, faithful preview of page 1 of the PDF on a stacked-paper card.
function PaperPreview({ home, event, date, reportId, pages }) {
  const { user } = useAuth();
  const [topRoom, setTopRoom] = useState(null);
  const top = [...home.rooms].sort((a, b) => b.total - a.total)[0];

  // The first room in the preview is the most valuable one, with its top 3 items.
  useEffect(() => {
    if (top?.itemCount) api.room(home._id, top._id).then((r) => setTopRoom(r.room)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home._id, top?._id]);

  const items = topRoom ? [...topRoom.items].sort((a, b) => b.estValue - a.estValue).slice(0, 3) : [];
  const eventLine = [event, date && longDate(new Date(`${date}T00:00`))].filter(Boolean).join(" · ");

  return (
    <div className="paper-stack" aria-label="Preview of page 1 of your claim report">
      <div className="paper">
        <div className="p-head">
          <span className="p-brand">
            <span style={{ width: 16, height: 16, borderRadius: 5, background: "#0e6a87" }} />
            HomeProof
          </span>
          <span className="p-meta">
            {reportId || "Report"} · {longDate(new Date())}
          </span>
        </div>
        <span className="p-title">Home Inventory Claim Report</span>
        <div className="p-cols">
          <div><span>PREPARED FOR</span><span>{user.name}</span></div>
          <div><span>PROPERTY</span><span>{home.address || home.name}</span></div>
          <div><span>EVENT</span><span>{eventLine || "Not specified"}</span></div>
        </div>
        <div className="p-total">
          <strong>{money(home.total)}</strong>
          <span>
            {plural(home.itemCount, "item")} · {plural(home.rooms.filter((r) => r.itemCount).length, "room")}
          </span>
          <i /><i />
        </div>
        {top && (
          <span className="p-room">
            {top.name} · {money(top.total)}
          </span>
        )}
        {items.map((it) => (
          <div className="p-item" key={it._id}>
            <span className="p-photo">{it.photoId && <ItemPhoto src={photoUrl(it.photoId)} box={it.box} alt="" />}</span>
            <span className="p-name">{it.name}</span>
            <span className="num">{money(it.estValue)}</span>
          </div>
        ))}
        <span className="p-foot">
          <span>Not a certified appraisal.</span>
          <span>Page 1{pages ? ` of ${pages}` : ""}</span>
        </span>
      </div>
    </div>
  );
}
