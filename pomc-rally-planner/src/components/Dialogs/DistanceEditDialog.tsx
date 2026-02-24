import { useEffect, useRef, useState } from 'react';

interface DistanceEditDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: number) => void;
  currentValue: number;
  title?: string;
  message?: string;
  label?: string;
  step?: number;
  decimals?: number;
}

export default function DistanceEditDialog({
  open,
  onClose,
  onConfirm,
  currentValue,
  title = 'Edit Distance',
  message = 'Setting this value manually will erase the recon measurement history for this row. Future recon runs will start fresh from the new value.',
  label = 'Distance (km)',
  step = 0.01,
  decimals = 2,
}: DistanceEditDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue(currentValue ? currentValue.toFixed(decimals) : '');
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open, currentValue, decimals]);

  if (!open) return null;

  const handleConfirm = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onConfirm(parsed);
    }
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ minWidth: '400px' }}>
        <h2>{title}</h2>

        <div style={{
          padding: '12px',
          background: 'var(--color-warning-bg, #FEF3C7)',
          borderRadius: '6px',
          fontSize: '13px',
          color: 'var(--color-warning-text, #92400E)',
          marginBottom: '16px',
          border: '1px solid var(--color-warning, #F59E0B)',
          lineHeight: '1.5',
        }}>
          {message}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            {label}
          </label>
          <input
            ref={inputRef}
            type="number"
            step={step}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '15px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}
          />
        </div>

        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleConfirm}>
            Set Value
          </button>
        </div>
      </div>
    </div>
  );
}
