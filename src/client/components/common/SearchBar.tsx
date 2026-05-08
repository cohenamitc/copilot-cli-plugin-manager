import styles from "./common.module.css";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  filterOptions?: { value: string; label: string }[];
  filterValue?: string;
  onFilterChange?: (value: string) => void;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  filterOptions,
  filterValue,
  onFilterChange,
}: SearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <input
        type="text"
        className={styles.searchInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {filterOptions && onFilterChange && (
        <select
          className={styles.searchSelect}
          value={filterValue ?? ""}
          onChange={(e) => onFilterChange(e.target.value)}
        >
          <option value="">All Sources</option>
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
