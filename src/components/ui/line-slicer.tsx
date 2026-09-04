export type LineSlicerOption<T extends string> = {
  value: T;
  label: string;
};

export type LineSlicerProps<T extends string> = {
  label: string;
  value: T;
  options: LineSlicerOption<T>[];
  onChange: (value: T) => void;
};

export function LineSlicer<T extends string>({
  label,
  value,
  options,
  onChange,
}: LineSlicerProps<T>) {
  const activeIndex = Math.max(
    0,
    options.findIndex((opt) => opt.value === value),
  );
  const progressPct =
    options.length > 1 ? (activeIndex / (options.length - 1)) * 100 : 0;

  return (
    <div className="line-slicer" role="radiogroup" aria-label={label}>
      <div className="line-slicer-track-bg" aria-hidden="true">
        <div
          className="line-slicer-track-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="line-slicer-stops">
        {options.map((option, index) => {
          const isActive = option.value === value;
          const isPassed = index <= activeIndex;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={`line-slicer-stop ${isActive ? 'is-active' : ''} ${isPassed ? 'is-passed' : ''}`}
              onClick={() => onChange(option.value)}
            >
              <span className="line-slicer-node-wrapper" aria-hidden="true">
                <span className="line-slicer-node" />
              </span>
              <span className="line-slicer-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
