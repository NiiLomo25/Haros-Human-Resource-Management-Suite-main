/**
 * Haros HRMIS - SearchableSelect Component
 * Converts standard dropdown menus into interactive type-to-filter fields.
 * Maintains the exact styling, compact density, accessibility, and label appearance
 * while adding inline instant search, keyboard navigation, clear button, and highlighted matches.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  id?: string;
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  options: SearchableSelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  renderOption?: (option: SearchableSelectOption) => React.ReactNode;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  name,
  value,
  defaultValue,
  options,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Type to filter options...',
  disabled = false,
  required = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  renderOption,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  // Uncontrolled mode: internal value used when `value` prop is not supplied.
  const [internalValue, setInternalValue] = useState<string>(
    defaultValue !== undefined ? String(defaultValue) : ''
  );
  const effectiveValue = value !== undefined ? value : internalValue;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected Option Object
  const selectedOption = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(effectiveValue));
  }, [options, effectiveValue]);

  // Dynamically Filtered Options
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSub = opt.subLabel ? opt.subLabel.toLowerCase().includes(q) : false;
      const matchBadge = opt.badge ? opt.badge.toLowerCase().includes(q) : false;
      const matchVal = String(opt.value).toLowerCase().includes(q);
      return matchLabel || matchSub || matchBadge || matchVal;
    });
  }, [options, searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 30);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  const handleSelect = (val: string | number) => {
    const strVal = String(val);
    setInternalValue(strVal);
    onChange?.(strVal);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left font-sans select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input for HTML form submissions if name is supplied */}
      {name && (
        <input
          type="hidden"
          name={name}
          id={id}
          value={effectiveValue !== undefined && effectiveValue !== '' ? String(effectiveValue) : ''}
          required={required}
        />
      )}

      {/* Main Display Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between text-left transition-colors duration-150 rounded border text-xs ${
          buttonClassName ||
          'h-8 px-2.5 py-1.5 bg-white border-slate-300 hover:border-slate-400 text-slate-800 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer'} ${
          isOpen ? 'ring-1 ring-blue-500 border-blue-500' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate pr-1">
          {selectedOption ? (
            <span className="flex items-center space-x-1.5 truncate">
              <span className="font-medium text-slate-900 truncate">{selectedOption.label}</span>
              {selectedOption.subLabel && (
                <span className="text-[10px] text-slate-400 truncate">({selectedOption.subLabel})</span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Popup with Type-to-Filter Input */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1 bg-white rounded-md border border-slate-200 shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100 text-xs ${
            dropdownClassName || 'w-full min-w-[200px]'
          }`}
          style={{ maxHeight: '320px' }}
        >
          {/* Search Box Header */}
          <div className="p-1.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10 flex items-center space-x-1.5">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full h-7 px-1.5 bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options Scrollable List */}
          <div
            ref={listRef}
            role="listbox"
            className="overflow-y-auto max-h-56 p-1 space-y-0.5 divide-y divide-slate-50"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(effectiveValue);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={String(opt.value) + '-' + idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded cursor-pointer transition-colors text-xs ${
                      isHighlighted
                        ? 'bg-blue-50 text-blue-900 font-medium'
                        : isSelected
                        ? 'bg-slate-100/70 text-slate-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      {renderOption ? (
                        renderOption(opt)
                      ) : (
                        <div className="truncate">
                          <span className={`${isSelected ? 'font-bold text-blue-700' : ''}`}>
                            {opt.label}
                          </span>
                          {opt.subLabel && (
                            <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                              {opt.subLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs italic">
                No matching options for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Footer stats if multiple items */}
          {options.length > 5 && (
            <div className="px-2 py-1 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span>
                {filteredOptions.length} of {options.length} options
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-blue-600 hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
