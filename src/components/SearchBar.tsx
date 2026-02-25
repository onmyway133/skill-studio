interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search skills..." }: SearchBarProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 px-4 py-2 border border-gray-200 rounded-lg
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
    />
  );
}
