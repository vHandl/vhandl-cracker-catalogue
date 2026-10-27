import { useEffect, useState } from 'react';

interface Props {
  value: number;
  onChange: (qty: number) => void;
  label?: string;
  /** Smallest allowed quantity (default 1). Use 0 for a "not added yet" stepper. */
  min?: number;
}

export default function QtyStepper({ value, onChange, label = 'Quantity', min = 1 }: Props) {
  const [text, setText] = useState(String(value));

  useEffect(() => setText(String(value)), [value]);

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper-btn"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        className="stepper-input"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={text}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const t = e.target.value.replace(/\D/g, '').slice(0, 4);
          setText(t);
          const n = parseInt(t, 10);
          if (n >= min) onChange(n);
        }}
        onBlur={() => {
          if (!(parseInt(text, 10) >= min)) setText(String(value));
        }}
      />
      <button
        type="button"
        className="stepper-btn"
        aria-label="Increase quantity"
        disabled={value >= 9999}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
