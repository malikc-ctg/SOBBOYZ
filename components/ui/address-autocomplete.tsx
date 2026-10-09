"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from "lucide-react"
import { AddressAutofillCore, SessionToken } from "@mapbox/search-js-core"
import { cn } from "@/lib/utils"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""

export interface AddressResult {
  address_line1: string
  city: string
  state: string
  postal_code: string
  full_address?: string
}

export interface AddressAutocompleteProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement> | { target: { value: string } }) => void
  onAddressSelect?: (address: AddressResult) => void
  theme?: "light" | "dark"
  country?: string
}

export const AddressAutocomplete = React.forwardRef<HTMLInputElement, AddressAutocompleteProps>(
  (
    {
      onAddressSelect,
      theme = "light",
      className,
      value,
      onChange,
      country = "CA",
      placeholder = "Start typing your address...",
      onKeyDown,
      onFocus,
      ...props
    },
    forwardedRef
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)

    // Expose internal input element to forwarded ref
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

    const [inputValue, setInputValue] = useState<string>(value !== undefined ? String(value) : "")
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    const autofillRef = useRef<AddressAutofillCore | null>(null)
    const sessionTokenRef = useRef<SessionToken | null>(null)
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isSelectingRef = useRef(false)

    // Synchronize local input display with controlled value prop
    useEffect(() => {
      if (value !== undefined) {
        setInputValue(String(value))
      }
    }, [value])

    // Debounced address search via Mapbox core
    const searchAddress = useCallback(
      (query: string) => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current)
        }

        const trimmed = query.trim()
        if (trimmed.length < 3) {
          setSuggestions([])
          setIsOpen(false)
          setIsLoading(false)
          return
        }

        setIsLoading(true)
        searchTimeoutRef.current = setTimeout(async () => {
          try {
            if (!sessionTokenRef.current) {
              sessionTokenRef.current = new SessionToken()
            }
            if (!autofillRef.current) {
              autofillRef.current = new AddressAutofillCore({ accessToken: MAPBOX_TOKEN })
            }

            const res = await autofillRef.current.suggest(trimmed, {
              sessionToken: sessionTokenRef.current,
              country: country || 'CA',
            })

            if (res && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
              setSuggestions(res.suggestions)
              setIsOpen(true)
              setHighlightedIndex(-1)
            } else {
              setSuggestions([])
              setIsOpen(false)
            }
          } catch (err) {
            console.error('[AddressAutocomplete] Suggest error:', err)
            setSuggestions([])
            setIsOpen(false)
          } finally {
            setIsLoading(false)
          }
        }, 220)
      },
      [country]
    )

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextVal = e.target.value
      setInputValue(nextVal)
      if (onChange) {
        onChange(e)
      }
      searchAddress(nextVal)
    }

    const handleSelect = useCallback(
      async (suggestion: any) => {
        isSelectingRef.current = true
        setIsOpen(false)
        setSuggestions([])
        setHighlightedIndex(-1)

        // Parse address parts from the suggestion
        const parseFromSuggestion = (s: any): AddressResult => {
          const line1 = s.address_line1 || s.feature_name || s.name || ""
          const city =
            s.place ||
            s.address_level2 ||
            (s.context?.find?.((c: any) => c.id?.startsWith("place"))?.text) ||
            ""
          const state =
            s.region ||
            s.address_level1 ||
            s.region_code ||
            (s.context?.find?.((c: any) => c.id?.startsWith("region"))?.text) ||
            ""
          const postalCode =
            s.postcode ||
            (s.context?.find?.((c: any) => c.id?.startsWith("postcode"))?.text) ||
            ""
          const full =
            s.full_address ||
            s.place_name ||
            [line1, city, state, postalCode].filter(Boolean).join(", ")

          return {
            address_line1: line1,
            city,
            state,
            postal_code: postalCode,
            full_address: full,
          }
        }

        const initialAddress = parseFromSuggestion(suggestion)
        const displayValue = initialAddress.address_line1 || initialAddress.full_address || ""
        setInputValue(displayValue)

        // Notify parent consumer immediately
        if (onAddressSelect) {
          onAddressSelect(initialAddress)
        } else if (onChange) {
          onChange({ target: { value: displayValue } } as React.ChangeEvent<HTMLInputElement>)
        }

        // Retrieve full GeoJSON feature for high accuracy
        const activeToken = sessionTokenRef.current
        sessionTokenRef.current = null // Complete current session

        try {
          if (!autofillRef.current) {
            autofillRef.current = new AddressAutofillCore({ accessToken: MAPBOX_TOKEN })
          }
          const ret = await autofillRef.current.retrieve(suggestion, {
            sessionToken: activeToken || new SessionToken(),
          })

          const feature = ret?.features?.[0]
          if (feature && feature.properties) {
            const p = feature.properties as any
            const retrievedAddress: AddressResult = {
              address_line1: p.address_line1 || p.feature_name || initialAddress.address_line1,
              city: p.address_level2 || p.place || initialAddress.city,
              state: p.address_level1 || p.region || initialAddress.state,
              postal_code: p.postcode || initialAddress.postal_code,
              full_address: p.full_address || p.place_name || initialAddress.full_address,
            }

            if (onAddressSelect) {
              onAddressSelect(retrievedAddress)
            }
          }
        } catch (err) {
          console.warn("[AddressAutocomplete] Retrieve fallback used:", err)
        } finally {
          setTimeout(() => {
            isSelectingRef.current = false
          }, 300)
        }
      },
      [onAddressSelect, onChange]
    )

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (onKeyDown) {
        onKeyDown(e)
      }

      if (!isOpen || suggestions.length === 0) {
        if (e.key === "ArrowDown" && suggestions.length > 0) {
          setIsOpen(true)
          e.preventDefault()
        }
        return
      }

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1))
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault()
          handleSelect(suggestions[highlightedIndex])
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (onFocus) onFocus(e)
      if (suggestions.length > 0 && inputValue.trim().length >= 3) {
        setIsOpen(true)
      }
    }

    // Close dropdown on outside clicks
    useEffect(() => {
      const handleClickOutside = (e: PointerEvent | MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
          setHighlightedIndex(-1)
        }
      }

      document.addEventListener("pointerdown", handleClickOutside)
      return () => {
        document.removeEventListener("pointerdown", handleClickOutside)
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current)
        }
      }
    }, [])

    return (
      <div ref={containerRef} className="relative w-full">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          autoComplete="off"
          className={cn(isLoading && "pr-8", className)}
          placeholder={placeholder}
          {...props}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </div>
        )}
        {isOpen && suggestions.length > 0 && (
          <div
            role="listbox"
            className={cn(
              "absolute left-0 right-0 top-full mt-1.5 z-[100] max-h-60 overflow-y-auto rounded-xl border shadow-xl backdrop-blur-md transition-all",
              theme === "dark"
                ? "bg-slate-900/95 border-slate-700/80 text-white divide-y divide-slate-800/80 shadow-2xl"
                : "bg-white/95 border-slate-200 text-slate-900 divide-y divide-slate-100 shadow-xl"
            )}
          >
            {suggestions.map((s, index) => {
              const isHighlighted = index === highlightedIndex
              const mainText = s.feature_name || s.address_line1 || s.full_address || ""
              const subText =
                s.description ||
                s.place_formatted ||
                [s.place, s.region, s.postcode].filter(Boolean).join(", ")

              return (
                <button
                  key={s.mapbox_id || index}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseDown={(e) => {
                    // Prevent input blur before click handler fires
                    e.preventDefault()
                  }}
                  onClick={() => handleSelect(s)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    "w-full px-3.5 py-2.5 text-left flex items-start gap-2.5 transition-colors cursor-pointer",
                    theme === "dark"
                      ? isHighlighted
                        ? "bg-blue-600/30 text-white"
                        : "hover:bg-slate-800/80 text-slate-200"
                      : isHighlighted
                      ? "bg-blue-50 text-blue-950 font-medium"
                      : "hover:bg-blue-50/60 text-slate-800"
                  )}
                >
                  <MapPin
                    className={cn(
                      "w-4 h-4 shrink-0 mt-0.5",
                      isHighlighted ? "text-blue-400" : "text-muted-foreground"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{mainText}</div>
                    {subText && (
                      <div
                        className={cn(
                          "text-xs truncate mt-0.5",
                          theme === "dark" ? "text-slate-400" : "text-slate-500"
                        )}
                      >
                        {subText}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}

            {/* Mapbox attribution footer */}
            <div
              className={cn(
                "px-3 py-1.5 flex items-center justify-end gap-1.5 text-[10px] select-none",
                theme === "dark"
                  ? "bg-slate-950/70 border-t border-slate-800/80 text-slate-400"
                  : "bg-slate-50 border-t border-slate-100 text-slate-500"
              )}
            >
              <span className="opacity-70">Powered by</span>
              <span className="font-semibold tracking-wider opacity-80">mapbox</span>
            </div>
          </div>
        )}
      </div>
    )
  }
)

AddressAutocomplete.displayName = "AddressAutocomplete"
