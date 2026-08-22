import React from "react";

type FilterOption = {
  value: string;
  label: string;
};

type FilterPillsProps = {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  className?: string;
  name?: string;
};

const FilterPills: React.FC<FilterPillsProps> = ({ value, onChange, options, className = "", name = "filter-pills" }) => {
  return (
    <div
      className={`flex items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border bg-muted/45 p-1 ${className}`}
    >
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              checked ? "bg-card text-primary shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
            }`}
          >
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={checked}
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
};

export default FilterPills;
