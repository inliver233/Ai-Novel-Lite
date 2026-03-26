import clsx from "clsx";

export type SliderInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  className?: string;
};

export function SliderInput(props: SliderInputProps) {
  const parsedValue = Number.parseFloat(props.value);
  const sliderValue = Number.isNaN(parsedValue) ? props.min ?? 0 : parsedValue;

  return (
    <label className={clsx("grid gap-1", props.className)}>
      <span className="text-xs text-subtext">{props.label}</span>
      <div className="flex items-center gap-3">
        <input
          className="flex-1 accent-accent"
          disabled={props.disabled}
          max={props.max}
          min={props.min}
          step={props.step}
          type="range"
          value={sliderValue}
          onChange={(event) => props.onChange(String(event.currentTarget.valueAsNumber))}
        />
        <input
          className="input w-20"
          disabled={props.disabled}
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        />
      </div>
      {props.hint ? <div className="text-[11px] text-subtext">{props.hint}</div> : null}
    </label>
  );
}
