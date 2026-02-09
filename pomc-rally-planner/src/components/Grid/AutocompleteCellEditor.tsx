import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { ICellEditorParams } from 'ag-grid-community';

interface AutocompleteCellEditorProps extends ICellEditorParams {
  /** All existing values to suggest from */
  suggestions: string[];
}

export default forwardRef(function AutocompleteCellEditor(
  props: AutocompleteCellEditorProps,
  ref: React.Ref<unknown>,
) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState<string>(props.value ?? '');
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showDropdown, setShowDropdown] = useState(false);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    isCancelAfterEnd: () => false,
    afterGuiAttached: () => {
      inputRef.current?.focus();
      // If started by a printable character key, begin with that character
      const key = props.eventKey;
      if (key && key.length === 1) {
        setValue(key);
        filterSuggestions(key);
      } else {
        // Select all text on edit start (like Excel)
        inputRef.current?.select();
      }
    },
  }));

  const filterSuggestions = useCallback(
    (text: string) => {
      if (!text.trim()) {
        setFiltered([]);
        setShowDropdown(false);
        return;
      }
      const lower = text.toLowerCase();
      const matches = props.suggestions.filter(
        (s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower,
      );
      // Deduplicate and limit
      const unique = [...new Set(matches)].slice(0, 8);
      setFiltered(unique);
      setSelectedIndex(-1);
      setShowDropdown(unique.length > 0);
    },
    [props.suggestions],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setValue(newVal);
    filterSuggestions(newVal);
  };

  const acceptSuggestion = (suggestion: string) => {
    setValue(suggestion);
    setShowDropdown(false);
    setFiltered([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
      // Tab accepts the currently highlighted suggestion
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestion(filtered[selectedIndex]);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      // Enter accepts the highlighted suggestion without committing the edit
      e.preventDefault();
      e.stopPropagation();
      acceptSuggestion(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '34px',
          padding: '6px 10px',
          fontSize: '15px',
          fontFamily: 'inherit',
          border: '2px solid #2563EB',
          borderRadius: '2px',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
          lineHeight: '1.4',
        }}
      />
      {showDropdown && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #ccc',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 9999,
          }}
        >
          {filtered.map((suggestion, i) => (
            <div
              key={i}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
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
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
