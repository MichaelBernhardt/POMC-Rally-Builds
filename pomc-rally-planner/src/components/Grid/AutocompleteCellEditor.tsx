import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CustomCellEditorProps } from 'ag-grid-react';

interface AutocompleteEditorProps extends CustomCellEditorProps<unknown, string> {
  suggestions: string[];
}

/**
 * AG-Grid v35 declarative cell editor with autocomplete dropdown.
 *
 * Uses the v35 `onValueChange` callback pattern (not the legacy
 * forwardRef/useImperativeHandle/getValue pattern).
 */
export default function AutocompleteCellEditor({
  value,
  onValueChange,
  eventKey,
  suggestions: suggestionsProp,
}: AutocompleteEditorProps) {
  const suggestions = suggestionsProp ?? [];

  // If editing started by typing a character, begin with that character
  const initialValue = eventKey && eventKey.length === 1 ? eventKey : (value ?? '');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Notify AG-Grid of initial value if started by typing
  useEffect(() => {
    if (eventKey && eventKey.length === 1) {
      onValueChange(eventKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus & select on mount
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (!(eventKey && eventKey.length === 1)) {
      el.select();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- autocomplete helpers ----
  const filterSuggestions = useCallback(
    (text: string) => {
      if (!text.trim() || suggestions.length === 0) {
        setFiltered([]);
        setShowDropdown(false);
        return;
      }
      const lower = text.toLowerCase();
      const matches = suggestions.filter(
        (s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower,
      );
      const unique = [...new Set(matches)].slice(0, 8);
      setFiltered(unique);
      setSelectedIndex(-1);
      setShowDropdown(unique.length > 0);
    },
    [suggestions],
  );

  const acceptSuggestion = useCallback((suggestion: string) => {
    onValueChange(suggestion);
    setShowDropdown(false);
    setFiltered([]);
    inputRef.current?.focus();
  }, [onValueChange]);

  // ---- event handlers ----
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onValueChange(v);
    filterSuggestions(v);
  }, [onValueChange, filterSuggestions]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showDropdown && selectedIndex >= 0) {
        onValueChange(filtered[selectedIndex]);
      }
      setShowDropdown(false);
      return; // Let AG-Grid handle Enter
    }

    if (!showDropdown || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Tab' && selectedIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestion(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setShowDropdown(false);
    }
  }, [showDropdown, selectedIndex, filtered, onValueChange, acceptSuggestion]);

  // ---- dropdown positioning ----
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }
  }, [showDropdown, value]);

  // ---- render ----
  const dropdown = showDropdown && dropdownPos && createPortal(
    <div
      ref={listRef}
      style={{
        position: 'fixed',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        maxHeight: '200px',
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #ccc',
        borderRadius: '0 0 4px 4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
      }}
    >
      {filtered.map((suggestion, i) => (
        <div
          key={i}
          onMouseDown={(e) => {
            e.preventDefault();
            acceptSuggestion(suggestion);
          }}
          style={{
            padding: '6px 10px',
            fontSize: '14px',
            cursor: 'pointer',
            backgroundColor: i === selectedIndex ? '#DBEAFE' : '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {suggestion}
        </div>
      ))}
    </div>,
    document.body,
  );

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '100%',
          padding: '6px 10px',
          fontSize: '15px',
          fontFamily: 'inherit',
          border: '2px solid #2563EB',
          borderRadius: '2px',
          outline: 'none',
          boxSizing: 'border-box',
          lineHeight: '1.4',
        }}
      />
      {dropdown}
    </>
  );
}
