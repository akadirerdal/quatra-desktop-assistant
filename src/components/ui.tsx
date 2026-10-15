/** Reusable UI bileşenleri — sade, tek sorumluluk. */
import type { ReactNode } from 'react';

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'normal' | 'small';
  disabled?: boolean;
  title?: string;
}): React.JSX.Element {
  const cls = ['btn', props.variant ?? 'default', props.size ?? 'normal'].join(' ');
  return (
    <button className={cls} onClick={props.onClick} disabled={props.disabled} title={props.title}>
      {props.children}
    </button>
  );
}

export function Switch(props: {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  title?: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.on}
      className={['switch', props.on ? 'on' : '', props.disabled ? 'disabled' : ''].join(' ')}
      onClick={() => !props.disabled && props.onChange(!props.on)}
      title={props.title}
    >
      <span className="knob" />
    </button>
  );
}

export function Slider(props: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}): React.JSX.Element {
  return (
    <div className="row">
      <input
        type="range"
        className="slider"
        min={props.min}
        max={props.max}
        step={props.step ?? 0.01}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
      {props.format && <span className="statusHint">{props.format(props.value)}</span>}
    </div>
  );
}

export function Select(props: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}): React.JSX.Element {
  return (
    <select
      className="select"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function StatusPill(props: {
  kind: 'ok' | 'bad' | 'warn';
  text: string;
}): React.JSX.Element {
  return (
    <span className={`statusPill ${props.kind}`}>
      <span className="dot" />
      {props.text}
    </span>
  );
}

export function Dialog(props: {
  title: string;
  body: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
}): React.JSX.Element {
  return (
    <div className="dialogBackdrop">
      <div className="dialog">
        <h4>{props.title}</h4>
        <p>{props.body}</p>
        <div className="actions">
          <Button onClick={props.onCancel}>{props.cancelLabel}</Button>
          <Button variant={props.danger ? 'danger' : 'primary'} onClick={props.onConfirm}>
            {props.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
