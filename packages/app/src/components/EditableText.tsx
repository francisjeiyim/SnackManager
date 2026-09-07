import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";

interface Props {
  value: string | null;
  placeholder: string;
  onCommit: (next: string | null) => void;
  className?: string;
  disabled?: boolean;
}

/** Click-to-edit label. Enter/blur commits, Esc cancels. */
export function EditableText({
  value,
  placeholder,
  onCommit,
  className,
  disabled,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing]);

  const commit = (): void => {
    setEditing(false);
    const next = draft.trim();
    if (next !== (value ?? "")) onCommit(next || null);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(value ?? "");
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        maxLength={40}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={cn(
          "h-6 w-32 rounded border border-accent bg-white px-1 text-sm outline-none ring-2 ring-accent/20",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(value ?? "");
        setEditing(true);
      }}
      className={cn(
        "group inline-flex items-center gap-1 rounded px-1 -mx-1 text-left hover:bg-stone-100 disabled:hover:bg-transparent",
        className,
      )}
    >
      <span className={value ? "" : "text-stone-400"}>{value ?? placeholder}</span>
      {!disabled ? (
        <span className="text-[10px] text-stone-300 opacity-0 transition-opacity group-hover:opacity-100">
          ✎
        </span>
      ) : null}
    </button>
  );
}
