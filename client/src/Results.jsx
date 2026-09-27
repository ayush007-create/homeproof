import { useEffect, useRef, useState } from "react";
import { Check, ImageOff, ScanBarcode, Trash2 } from "lucide-react";
import { api, photoUrl } from "./api.js";
import { money, plural, shortDate } from "./format.js";
import { Field, FieldError } from "./components/Field.jsx";
import { ItemPhoto } from "./components/ItemPhoto.jsx";

const REVEAL_MS = 450;

// Which items get a serial number box (insurers use serials to check coverage).
// Gemini answers hasSerial for each item; older scans without it fall back to the category.
// A box that already holds a serial always stays.
const SERIAL_CATEGORIES = new Set(["Electronics", "Appliances"]);
const wantsSerial = (item) => Boolean(item.serialNumber) || (item.hasSerial ?? SERIAL_CATEGORIES.has(item.category));

// Room results, value first: the total with its range, the most valuable item as a
// large evidence photo, then the rest by value. Right after a scan the items appear
// one by one. Tap an item to fix its name or value, or delete it.
// newIds: items the last "add items" clip found; they get a "New" mark.
export default function Results({ homeId, room, reveal, newIds, onRoomChange, onFirstItem }) {
  const items = [...room.items].sort((a, b) => b.estValue - a.estValue);
  const [shown, setShown] = useState(reveal ? 0 : items.length);
  const [editing, setEditing] = useState(null); // { id, mode: "edit" | "delete" }

  useEffect(() => {
    if (!reveal) return;
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= items.length) clearInterval(id);
        return Math.min(n + 1, items.length);
      });
    }, REVEAL_MS);
    return () => clearInterval(id);
    // Only for a fresh scan, not after an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  useEffect(() => {
    if (shown >= 1) onFirstItem?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown >= 1]);

  const visible = reveal ? items.slice(0, shown) : items;
  const done = visible.length >= items.length;
  const sum = (key) => visible.reduce((s, it) => s + (it[key] || 0), 0);
  const [hero, ...rest] = visible;

  // Everything an item card needs to edit or delete itself.
  const itemProps = (item) => ({
    item,
    isNew: Boolean(newIds?.includes(item._id)),
    mode: editing?.id === item._id ? editing.mode : null,
    setMode: (mode) => setEditing(mode ? { id: item._id, mode } : null),
    onSave: async (changes) => {
      onRoomChange((await api.updateItem(homeId, room._id, item._id, changes)).room);
      setEditing(null);
    },
    onSerial: async (serialNumber) => {
      onRoomChange((await api.updateItem(homeId, room._id, item._id, { serialNumber })).room);
    },
    onDelete: async () => {
      const { room: updated } = await api.deleteItem(homeId, room._id, item._id);
      setEditing(null);
      setShown((n) => Math.max(0, n - 1));
      onRoomChange(updated);
    },
  });

  return (
    <section className="results" aria-live="polite">
      <div className="total-row">
        <div>
          <span className="eyebrow">{done ? "Room total" : "Finding your things…"}</span>
          <span className="total">{money(sum("estValue"))}</span>
        </div>
        <div className="side">
          <span className="num">
            {money(sum("estLow"))}–{money(sum("estHigh"))}
          </span>
          <span>
            {done ? plural(items.length, "item") : `${visible.length} of ${items.length}`}
            {room.scannedAt && ` · ${shortDate(room.itemsAddedAt || room.scannedAt)}`}
          </span>
        </div>
      </div>

      {hero && <HeroItem {...itemProps(hero)} />}

      {items.length > 1 && <span className="eyebrow">{items.length - 1} more · by value</span>}
      <ul className="items">
        {rest.map((it) => (
          <ItemRow key={it._id} {...itemProps(it)} />
        ))}
      </ul>

    </section>
  );
}

// Photo zoomed on the item with its amber timestamp tag.
function Thumb({ item, className = "thumb" }) {
  return (
    <span className={className}>
      {item.photoId ? (
        <ItemPhoto src={photoUrl(item.photoId)} box={item.box} alt={item.name} />
      ) : (
        <span className="photo-empty"><ImageOff size={20} /></span>
      )}
      {item.timestamp && <span className={`tag ${className === "thumb" ? "sm" : ""}`}>{item.timestamp}</span>}
    </span>
  );
}

// Name, category and value; tapping opens the editor.
function ItemSummary({ item, isNew, withThumb, onClick }) {
  return (
    <button className="item-main" onClick={onClick} aria-label={`Edit ${item.name}`}>
      {withThumb && <Thumb item={item} />}
      <span className="who">
        <span className="name">{item.name}</span>
        <span className="meta">
          {item.category} · {item.condition}
          {item.editedByUser && <span className="chip">Edited</span>}
          {isNew ? (
            <span className="chip new">New</span>
          ) : (
            item.addedAt && <span className="chip muted-chip">Added {shortDate(item.addedAt)}</span>
          )}
        </span>
      </span>
      <span className="price">
        <span className="money">{money(item.estValue)}</span>
        <span className="range">
          {money(item.estLow)}–{money(item.estHigh)}
        </span>
      </span>
    </button>
  );
}

function HeroItem({ item, isNew, mode, setMode, onSave, onSerial, onDelete }) {
  return (
    <article className={`hero-item card ${mode === "edit" ? "is-editing" : ""} ${isNew ? "is-new" : ""}`}>
      <div className="hero-photo">
        {item.photoId ? (
          <ItemPhoto src={photoUrl(item.photoId)} box={item.box} alt={item.name} />
        ) : (
          <span className="photo-empty"><ImageOff size={24} /></span>
        )}
        <span className="hero-badge">MOST VALUABLE</span>
        {item.timestamp && <span className="tag">{item.timestamp}</span>}
      </div>
      {mode === "edit" ? (
        <ItemEditor item={item} onSave={onSave} onCancel={() => setMode(null)} onAskDelete={() => setMode("delete")} />
      ) : mode === "delete" ? (
        <div className="editor"><DeleteConfirm item={item} onKeep={() => setMode(null)} onDelete={onDelete} /></div>
      ) : (
        <>
          <ItemSummary item={item} isNew={isNew} onClick={() => setMode("edit")} />
          {wantsSerial(item) && <SerialField item={item} onSave={onSerial} />}
        </>
      )}
    </article>
  );
}

function ItemRow({ item, isNew, mode, setMode, onSave, onSerial, onDelete }) {
  return (
    <li className={`item-row card ${mode === "edit" ? "is-editing" : mode === "delete" ? "is-deleting" : ""} ${isNew ? "is-new" : ""}`}>
      {mode === "edit" ? (
        <ItemEditor item={item} withThumb onSave={onSave} onCancel={() => setMode(null)} onAskDelete={() => setMode("delete")} />
      ) : mode === "delete" ? (
        <DeleteConfirm item={item} onKeep={() => setMode(null)} onDelete={onDelete} />
      ) : (
        <>
          <ItemSummary item={item} isNew={isNew} withThumb onClick={() => setMode("edit")} />
          {wantsSerial(item) && <SerialField item={item} onSave={onSerial} />}
        </>
      )}
    </li>
  );
}

// Serial number box inside the item card. Saves when you leave the field or press Enter.
function SerialField({ item, onSave }) {
  const saved = item.serialNumber || "";
  const [value, setValue] = useState(saved);
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [focused, setFocused] = useState(false);
  const id = `serial-${item._id}`;

  async function save() {
    setFocused(false);
    const next = value.trim();
    if (next === saved) return;
    setStatus("saving");
    try {
      await onSave(next);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="serial-field">
      <div className="serial-row">
        <label htmlFor={id}>
          <ScanBarcode size={16} aria-hidden="true" /> Serial no.
        </label>
        <input
          id={id}
          value={value}
          placeholder="Add for your insurer"
          maxLength={64}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="done"
          onFocus={() => setFocused(true)}
          onChange={(e) => (setValue(e.target.value), setStatus("idle"))}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
        <span className={`serial-status ${status}`} aria-live="polite">
          {status === "saving" ? <span className="spin accent" aria-label="Saving" /> : status === "saved" ? <Check size={18} aria-label="Saved" /> : null}
        </span>
      </div>
      {status === "error" ? (
        <p className="serial-hint error">Couldn't save. Tap the box and try again.</p>
      ) : (
        focused && !value && <p className="serial-hint">Usually on a sticker on the back or bottom, or in Settings → About.</p>
      )}
    </div>
  );
}

function ItemEditor({ item, withThumb, onSave, onCancel, onAskDelete }) {
  const formRef = useRef(null);
  const [name, setName] = useState(item.name);
  const [value, setValue] = useState(String(item.estValue));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Bring the whole card (including Save) into view, clear of the floating bottom bar.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.closest(".hero-item, .item-row")?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, []);

  async function submit(e) {
    e.preventDefault();
    const n = Number(value);
    if (!name.trim()) return setError("Name can't be empty.");
    if (!value || !Number.isFinite(n) || n < 0) return setError("Enter a value in dollars, like 250.");
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), estValue: Math.round(n) });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="editor" onSubmit={submit} ref={formRef}>
      <div className="editor-head">
        {withThumb && <Thumb item={item} />}
        <div>
          <span className="eyebrow">Editing</span>
          <span className="muted">{item.category} · {item.condition}</span>
        </div>
      </div>
      <Field label="Item name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={120} />
      {/* Values stay editable: every value is an estimate the owner can correct. */}
      <div className="value-field">
        <label>
          Estimated value
          <span className="dollar">
            $
            <input
              inputMode="numeric"
              aria-label="Estimated value in dollars"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </span>
        </label>
        <span className="range">
          {money(item.estLow)}–{money(item.estHigh)}
        </span>
      </div>
      {error && <FieldError>{error}</FieldError>}
      <div className="editor-actions">
        <button type="button" className="trash-btn" onClick={onAskDelete} aria-label={`Delete ${item.name}`}>
          <Trash2 size={20} />
        </button>
        <span className="spacer" />
        <button type="button" className="btn secondary sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}

function DeleteConfirm({ item, onKeep, onDelete }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="delete-confirm">
      <p>
        <strong>Delete “{item.name}”?</strong> <span className="muted">It will be removed from this room and your report.</span>
      </p>
      {error && <FieldError>{error}</FieldError>}
      <div className="row">
        <button type="button" className="btn secondary" onClick={onKeep}>Keep</button>
        <button
          type="button"
          className="btn danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onDelete();
            } catch (err) {
              setError(err.message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
