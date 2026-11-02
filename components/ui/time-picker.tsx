"use client"

import * as React from "react"
import { Clock, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format12Hour } from "@/lib/time-utils"

export interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

function parseTimeString(val?: string): { hour: number; minute: number; period: "AM" | "PM" } {
  if (!val) {
    const now = new Date()
    let h = now.getHours()
    const period: "AM" | "PM" = h >= 12 ? "PM" : "AM"
    h = h % 12
    if (h === 0) h = 12
    const m = Math.floor(now.getMinutes() / 5) * 5
    return { hour: h, minute: m, period }
  }
  const parts = val.split(":")
  let h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10) || 0
  if (isNaN(h)) h = 9
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM"
  h = h % 12
  if (h === 0) h = 12
  return { hour: h, minute: m, period }
}

function to24HourString(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour % 12
  if (period === "PM") h += 12
  const hStr = h < 10 ? `0${h}` : `${h}`
  const mStr = minute < 10 ? `0${minute}` : `${minute}`
  return `${hStr}:${mStr}`
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

const QUICK_PRESETS = [
  { label: "8:00 AM", value: "08:00" },
  { label: "8:30 AM", value: "08:30" },
  { label: "9:00 AM", value: "09:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "4:00 PM", value: "16:00" },
  { label: "4:30 PM", value: "16:30" },
  { label: "5:00 PM", value: "17:00" },
]

export function TimePicker({
  value,
  onChange,
  className,
  placeholder = "Select time",
  disabled = false,
  required = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const { hour, minute, period } = React.useMemo(() => parseTimeString(value), [value])

  const handleUpdate = (h: number, m: number, p: "AM" | "PM") => {
    onChange(to24HourString(h, m, p))
  }

  const handleSetNow = () => {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    const hStr = h < 10 ? `0${h}` : `${h}`
    const mStr = m < 10 ? `0${m}` : `${m}`
    onChange(`${hStr}:${mStr}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 border-slate-200 bg-background hover:bg-slate-50/80 px-3",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-slate-500 shrink-0" />
          <span className="font-medium text-xs sm:text-sm">
            {value ? format12Hour(value) : placeholder}
          </span>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground/60 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[300px] p-3 border-slate-200 shadow-xl rounded-2xl bg-popover"
      >
        {/* Header Preview & Now Button */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            {value ? format12Hour(value) : "Select Time"}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSetNow}
            className="h-6 text-[11px] px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
          >
            Now
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1 mb-2.5 pb-2 border-b border-border/50">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChange(p.value)
                setOpen(false)
              }}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                value === p.value
                  ? "bg-blue-600 text-white border-blue-600 font-semibold"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground border-border"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 3-Column Selectors: Hour | Minute | Period */}
        <div className="grid grid-cols-3 gap-2">
          {/* Hours Column */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground text-center mb-1">
              Hour
            </span>
            <ScrollArea className="h-44 rounded-lg border border-border/60 p-1">
              <div className="flex flex-col gap-0.5">
                {HOURS.map((h) => {
                  const isSelected = hour === h
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleUpdate(h, minute, period)}
                      className={cn(
                        "w-full py-1 text-xs rounded font-medium text-center transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {h}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Minutes Column */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground text-center mb-1">
              Minute
            </span>
            <ScrollArea className="h-44 rounded-lg border border-border/60 p-1">
              <div className="flex flex-col gap-0.5">
                {MINUTES.map((m) => {
                  const isSelected = minute === m
                  const label = m < 10 ? `0${m}` : `${m}`
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleUpdate(hour, m, period)}
                      className={cn(
                        "w-full py-1 text-xs rounded font-medium text-center transition-colors",
                        isSelected
                          ? "bg-blue-600 text-white font-semibold shadow-sm"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </div>

          {/* AM / PM Column */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-muted-foreground text-center mb-1">
              Period
            </span>
            <div className="h-44 rounded-lg border border-border/60 p-1 flex flex-col gap-1 justify-center">
              {(["AM", "PM"] as const).map((p) => {
                const isSelected = period === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleUpdate(hour, minute, p)}
                    className={cn(
                      "w-full py-2.5 text-xs rounded-md font-semibold text-center transition-colors",
                      isSelected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "hover:bg-muted text-foreground"
                    )}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Done */}
        <div className="pt-2 mt-2 border-t border-border/60 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3"
          >
            Done
          </Button>
        </div>

        {required && (
          <input
            type="text"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            required={required}
            value={value || ""}
            onChange={() => {}}
            tabIndex={-1}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
