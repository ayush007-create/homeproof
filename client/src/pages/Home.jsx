import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, EllipsisVertical, FileText, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api, photoUrl } from "../api.js";
import { money, plural, shortDate } from "../format.js";
import { AddressPicker } from "../components/AddressPicker.jsx";
import { Field } from "../components/Field.jsx";
import { NoRoomsArt } from "../components/Illustrations.jsx";
import { ItemPhoto } from "../components/ItemPhoto.jsx";
import { RoomIcon } from "../components/RoomIcon.jsx";
import { ConfirmSheet, Sheet, SheetActions } from "../components/Sheet.jsx";
import { CardSkeletons, EmptyState, ErrorState, Skeleton } from "../components/States.jsx";

export default function Home() {
  const { homeId } = useParams();
  const navigate = useNavigate();
  const [home, setHome] = useState(null);
  const [error, setError] = useState(null);
  const [params, setParams] = useSearchParams();
  // ?address=1 (from the recording screen) opens the address form.
  const [sheet, setSheet] = useState(params.get("address") ? "address" : null); // options | rename | address | delete
  useEffect(() => {
    if (params.get("address")) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    setError(null);
    api.home(homeId).then((r) => setHome(r.home)).catch(setError);
  }, [homeId]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <main className="page">
        <BackLink />
        <ErrorState
          title={error.status === 404 ? "Home not found" : "Couldn't load this home"}
          message={error.status === 404 ? "It may have been deleted." : error.message}
          onRetry={error.status === 404 ? null : load}
        />
      </main>
    );
  }

  if (!home) {
    return (
      <main className="page">
        <BackLink />
        <Skeleton className="sk-title" />
        <Skeleton className="sk-hero" />
        <CardSkeletons count={3} />
      </main>
    );
  }

  const canReport = home.itemCount > 0;
  // Recordings were verified at the address, so it's locked once rooms have been recorded.
  const addressLocked = Boolean(home.location) && home.documentedRoomCount > 0;
  const saveHome = async (changes) => setHome((await api.updateHome(homeId, changes)).home);
  // Highest value first; rooms that haven't been scanned go last.
  const rooms = [...home.rooms].sort((a, b) => b.total - a.total || Boolean(b.scannedAt) - Boolean(a.scannedAt));

  return (
    <main className={`page has-bar ${canReport ? "" : "tall-bar"}`}>
      <div className="page-nav">
        <BackLink />
        <button className="icon-btn" onClick={() => setSheet("options")} aria-label="Home options">
          <EllipsisVertical size={22} />
        </button>
      </div>

      <div className="page-head">
        <h1>{home.name}</h1>
        {home.address && (
          <p className="line"><MapPin size={15} aria-hidden="true" /> {home.address}</p>
        )}
      </div>

      {!home.location && (
        <div className="loc-card card warn">
          <span className="tile sm amber"><MapPin size={18} /></span>
          <div className="text">
            <strong>Add this home's address</strong>
            <span>Recording only works at the home, so HomeProof needs to know where it is.</span>
          </div>
          <button className="btn primary sm" onClick={() => setSheet("address")}>Add</button>
        </div>
      )}

      <section className="hero-total" aria-label="Home total">
        <div>
          <span className="eyebrow">Home total</span>
          <span className="total xl">{money(home.total)}</span>
          <span className="sub">{plural(home.itemCount, "item")} · estimated replacement value</span>
        </div>
        <div className="hero-foot">
          <span>Total</span> <strong>{plural(home.documentedRoomCount, "room")} documented</strong>
        </div>
      </section>

      <div className="section-head">
        <h2>Rooms</h2>
        {rooms.length > 1 && <span className="muted">Highest value first</span>}
      </div>

      {rooms.length === 0 ? (
        <EmptyState art={<NoRoomsArt />} title="No rooms yet">
          Add a room and film it. HomeProof finds every item worth claiming.
        </EmptyState>
      ) : (
        <ul className="card-list">
          {rooms.map((room) => (
            <li key={room._id}>
              <Link to={`/homes/${homeId}/rooms/${room._id}`} className="card room-card">
                <span className="room-photo">
                  {room.topPhotoId ? (
                    <>
                      <span className="photo-frame">
                        <ItemPhoto src={photoUrl(room.topPhotoId)} box={room.topPhotoBox} alt={room.topItemName || ""} />
                      </span>
                      <span className="room-badge"><RoomIcon name={room.name} size={14} /></span>
                    </>
                  ) : (
                    <span className="tile"><RoomIcon name={room.name} /></span>
                  )}
                </span>
                <span className="body">
                  <strong className="title">{room.name}</strong>
                  <span className="muted">
                    {room.scannedAt ? `${plural(room.itemCount, "item")} · ${shortDate(room.itemsAddedAt || room.scannedAt)}` : "Not scanned yet"}
                  </span>
                </span>
                <span className="value-chev">
                  {room.scannedAt && <span className="money">{money(room.total)}</span>}
                  <ChevronRight size={18} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="bottom-bar stacked">
        {!canReport && <p className="bar-note">Scan a room to unlock your claim report.</p>}
        <div className="bar-row">
          <Link to={`/homes/${homeId}/rooms/new`} className={`btn ${canReport ? "secondary" : "primary grow"}`} aria-label="Add room">
            <Plus size={20} />
            {canReport ? "Room" : "Add room"}
          </Link>
          {canReport ? (
            <Link to={`/homes/${homeId}/report`} className="btn primary grow">
              <FileText size={20} className="hide-tiny" /> Get your claim report
            </Link>
          ) : (
            <button className="btn primary" disabled aria-label="Get your claim report (scan a room first)">
              <FileText size={20} /> Report
            </button>
          )}
        </div>
      </div>

      {sheet === "options" && (
        <Sheet title={home.name} onClose={() => setSheet(null)}>
          <SheetActions
            actions={[
              { label: "Rename home", icon: Pencil, onClick: () => setSheet("rename") },
              ...(addressLocked ? [] : [{ label: home.location ? "Change address" : "Add address", icon: MapPin, onClick: () => setSheet("address") }]),
              { label: "Delete home", icon: Trash2, danger: true, onClick: () => setSheet("delete") },
            ]}
          />
        </Sheet>
      )}
      {sheet === "rename" && (
        <EditSheet title="Rename home" label="Name" value={home.name} maxLength={80} required onClose={() => setSheet(null)} onSave={(name) => saveHome({ name })} />
      )}
      {sheet === "address" && <AddressSheet home={home} onClose={() => setSheet(null)} onSave={saveHome} />}
      {sheet === "delete" && (
        <DeleteSheet
          title="Delete this home?"
          message={`${home.name}, its ${plural(home.roomCount, "room")} and ${plural(home.itemCount, "item photo")} will be removed. This can't be undone.`}
          stats={[
            { value: home.roomCount, label: home.roomCount === 1 ? "room" : "rooms" },
            { value: home.itemCount, label: home.itemCount === 1 ? "item" : "items" },
            { value: money(home.total), label: "estimated" },
          ]}
          confirmLabel="Delete home"
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await api.deleteHome(homeId);
            navigate("/homes", { replace: true });
          }}
        />
      )}
    </main>
  );
}

function BackLink() {
  return (
    <Link to="/homes" className="back-link">
      <ChevronLeft size={22} /> My Homes
    </Link>
  );
}

// One-field edit form in a sheet (rename, address).
export function EditSheet({ title, label, optional, value, required, hint, maxLength, onSave, onClose }) {
  const [text, setText] = useState(value || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (required && !text.trim()) return setError("This can't be empty.");
    setBusy(true);
    try {
      await onSave(text.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="stack-sm" noValidate>
        <Field label={label} optional={optional} value={text} maxLength={maxLength} hint={hint} onChange={(e) => (setText(e.target.value), setError(""))} error={error} />
        <button className="btn primary full" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </form>
    </Sheet>
  );
}

// Sets the home's address (with its location), for homes added before addresses were required.
function AddressSheet({ home, onSave, onClose }) {
  const [place, setPlace] = useState(null);
  const [unit, setUnit] = useState(home.unit || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!place) return setError("Use your current location or search for the address.");
    setBusy(true);
    try {
      await onSave({ placeToken: place.token, unit });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={home.location ? "Change address" : "Add address"} onClose={onClose}>
      <form onSubmit={submit} className="stack-sm" noValidate>
        {home.address && !home.location && <p className="muted small">Saved before: {home.address}</p>}
        <AddressPicker place={place} onPlace={(p) => (setPlace(p), setError(""))} unit={unit} onUnit={setUnit} error={error} radiusM={home.radiusM} />
        <button className="btn primary full" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
      </form>
    </Sheet>
  );
}

// Confirmation that shows its own busy and error states.
export function DeleteSheet({ onConfirm, ...props }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <ConfirmSheet
      {...props}
      busy={busy}
      error={error}
      onConfirm={async () => {
        setBusy(true);
        try {
          await onConfirm();
        } catch (err) {
          setError(err.message);
          setBusy(false);
        }
      }}
    />
  );
}
