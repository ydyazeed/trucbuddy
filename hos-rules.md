# Hours of Service (HOS) Rules — Implementation Reference

This document captures every HOS rule your web app must enforce when planning trips and generating daily logs for property-carrying CMV drivers operating under interstate commerce.

> **Scope assumption (per spec):** Property-carrying driver, 70 hr / 8 day cycle, no adverse driving conditions, fueling at least once every 1,000 miles, 1 hour each for pickup and dropoff.

---

## 1. Who These Rules Apply To

The federal HOS regulations apply if all three are true:

- The driver is operating a Commercial Motor Vehicle (CMV)
- The vehicle is being used in interstate commerce to transport property
- One of the following weight/cargo conditions is met:
  - Weighs 10,001 lbs or more (including load)
  - Has a gross vehicle weight rating ≥ 10,001 lbs
  - Is transporting hazardous materials in placard-required quantities

**App assumption:** every trip planned in this app falls under federal HOS regulations. The app should not be used for intrastate-only operations or non-CMV vehicles.

---

## 2. The Three Core Driving Limits

These three clocks run simultaneously. The driver is in violation if **any one** is exceeded while driving. Once any limit is hit, driving must stop until the limit resets.

### 2.1 The 14-Hour Driving Window

- Begins when the driver starts any kind of work (not just driving)
- Ends 14 consecutive hours later
- After 14 hours, the driver cannot drive again until they have completed 10 consecutive hours off duty (or qualifying sleeper berth equivalent)
- The clock does not pause for breaks, fueling, or non-driving work — it is a wall-clock countdown
- The driver may continue non-driving work past the 14-hour mark, but no driving is permitted

**App enforcement:** track the start of the duty day and forbid scheduling any driving past hour 14.

### 2.2 The 11-Hour Driving Limit

- Within the 14-hour window, total driving time may not exceed 11 hours
- Once 11 hours of driving is accumulated, no further driving is permitted until 10 consecutive hours off duty
- Driving time is cumulative across the duty day, not consecutive

**App enforcement:** sum all driving segments within the current duty window and block scheduling once the total reaches 11 hours.

### 2.3 The 30-Minute Break Requirement

- Required after 8 cumulative hours of driving since the last qualifying break
- Must be a single consecutive period of at least 30 minutes
- Can be satisfied by any of: off-duty, sleeper berth, or on-duty not driving
- May combine on-duty not driving and off-duty if the two periods are consecutive and total at least 30 minutes
- Short non-consecutive interruptions do not satisfy this rule
- The break does not extend the 14-hour window
- Does not apply to drivers operating under the CDL short-haul or non-CDL short-haul exceptions

**App enforcement:** maintain a counter of cumulative driving since the last qualifying break and force a break to be scheduled before that counter exceeds 8 hours.

---

## 3. The 70-Hour / 8-Day Cycle Limit

- Driver may not drive after accumulating 70 hours of on-duty time in any 8 consecutive days
- This is a rolling window — each new day, the oldest day drops out of the calculation
- Includes all on-duty time, not just driving (loading, fueling, paperwork, waiting, etc.)
- Once the limit is reached, the driver may continue non-driving work but cannot drive
- The driver becomes able to drive again as the rolling total drops below 70 hours, OR after a 34-hour restart

**App enforcement:**
- Take the user-supplied "current cycle hours used" as the starting balance
- Add all planned on-duty time for the trip to a rolling total
- Block any driving segment where the rolling 8-day total would exceed 70 hours
- Recommend a 34-hour restart if the trip would otherwise be infeasible

### 3.1 The 34-Hour Restart (Optional)

- 34 or more consecutive hours off duty (or in sleeper berth, or any combination of the two)
- Resets the rolling cycle total to zero
- Use is optional, not mandatory
- Particularly useful for long cross-country trips where the cycle would otherwise be exhausted mid-trip

**App enforcement:** if the planned trip's on-duty hours plus the user's current cycle balance would exceed 70 hours, the app must either insert a 34-hour restart in the plan or warn the driver that the trip is infeasible.

---

## 4. Off-Duty and Rest Requirements

### 4.1 The 10-Hour Rest

- After hitting any driving limit (11-hour, 14-hour, or end of shift), the driver requires 10 consecutive hours off duty before resuming driving
- Can be satisfied entirely off-duty, entirely in the sleeper berth, or as a qualifying split (see 4.2)
- Resets both the 11-hour driving clock and the 14-hour window

### 4.2 The Sleeper Berth Provision

The driver may split their 10 hours of required rest using one of three patterns:

**Pattern A — Single block:** spend all 10 hours in the sleeper berth (or off-duty). This is the simplest case.

**Pattern B — 7+3 (or any 7+ paired with 3+):**
- At least 7 consecutive hours in the sleeper berth, paired with
- Up to 3 hours either off duty or riding in the passenger seat (immediately before or after the sleeper period)
- Combined period must equal at least 10 hours
- Both periods are excluded from the 14-hour driving window

**Pattern C — 7+ and 2+ split (non-consecutive):**
- One period of at least 7 consecutive hours in the sleeper berth
- A second period of at least 2 hours either in the sleeper berth or otherwise off-duty
- The two periods must total at least 10 hours
- Order does not matter
- Both qualifying periods are excluded from the 14-hour driving window

**Calculation rules for split sleeper:**
- Compliance calculation starts at the end of the first qualifying rest period
- Compliance calculation ends at the start of the second qualifying rest period
- All time on either side of the first qualifying rest must be included when computing the 11-hour and 14-hour limits
- After completing a sleeper pairing, if the driver takes a subsequent qualifying rest, the calculation point advances

**App enforcement:** for v1, recommend simplifying by only supporting Pattern A (continuous 10-hour rest). Add Pattern B and C in later versions, with a dedicated UI explainer because the math is genuinely confusing.

---

## 5. On-Duty Time — What Counts

Every minute of the following counts toward the 14-hour window and the 70-hour cycle:

- All driving time (controls of a CMV in operation)
- Time waiting at a plant, terminal, facility, or shipper to be dispatched, unless explicitly relieved
- Inspecting, servicing, fueling, or washing the truck
- Loading, unloading, supervising, or attending the truck
- Handling shipping paperwork
- Time spent on a broken-down vehicle
- Drug and alcohol testing including travel to/from the collection site
- Any other work performed for a motor carrier (including training, driving a company car)
- Any paid work for any other employer (including a part-time job)

**Time that does NOT count as on-duty:**

- Time resting in a parked vehicle
- Time resting in a sleeper berth
- Up to 3 hours riding in the passenger seat of a moving CMV, immediately before or after at least 7 consecutive hours in the sleeper berth (team driving exception)

**App assumption per spec:**
- Pickup = 1 hour on-duty (not driving)
- Dropoff = 1 hour on-duty (not driving)
- Each fuel stop ≈ 30-45 minutes on-duty (not driving) — app should pick a sensible default

---

## 6. Fuel Stop Requirements

- App spec assumption: at least one fuel stop every 1,000 miles driven
- Fuel stops count as on-duty (not driving) time
- They occupy space in the 14-hour window
- They do NOT count toward the 11-hour driving limit or the 30-minute break requirement (unless paired consecutively with a true 30-minute break)

**App enforcement:** insert a fuel stop event in the trip plan every 1,000 driving miles, defaulting to ~30 minutes duration. Allow the driver to combine a fuel stop with a 30-min break if timing aligns.

---

## 7. Pickup and Dropoff Requirements

Per the app spec:

- Pickup = 1 hour at the pickup location, on-duty (not driving)
- Dropoff = 1 hour at the dropoff location, on-duty (not driving)
- Both consume time within the 14-hour window
- Both count toward the 70-hour cycle total

---

## 8. Personal Conveyance vs. Yard Moves

Two special non-counted statuses that the app should support:

### Personal Conveyance
- Off-duty movement of the CMV for personal purposes (e.g., driving to a restaurant from a truck stop)
- Driver must be fully relieved of work and responsibility
- The truck may be laden — being loaded does not disqualify personal use
- Time is logged as off-duty
- Carrier may impose stricter limits than the federal guidance allows
- GPS location must be obscured to ~10-mile precision for privacy (federal requirement)

### Yard Moves
- Moving the CMV between locations within a terminal or similar private facility
- Cannot occur on a public highway
- Logged as on-duty (not driving), not as driving time
- Counts toward 14-hour window and 70-hour cycle, but NOT toward the 11-hour driving limit

**App enforcement:** offer both as explicit duty status options. Warn drivers if they attempt to use personal conveyance for what looks like a commercial leg.

---

## 9. Adverse Driving Conditions Exception

(Out of scope per the assumptions, but worth noting for future versions)

- Permits up to 2 additional hours of driving time and 2 additional hours of the 14-hour window
- Conditions must be unforeseen at dispatch (e.g., unexpected fog, crash blocking the highway)
- Does NOT apply to predictable conditions like rush-hour traffic
- Does NOT extend the 60/70-hour weekly limit
- Driver must annotate the log with the cause when invoking the exception

---

## 10. Short-Haul Exceptions

(Out of scope for typical long-haul use, but the app should detect when a trip qualifies and surface it as an option)

### CDL Short-Haul (§ 395.1(e)(1))
- Operates within 150 air-mile radius of work reporting location
- Returns to and is released at the same location within 14 hours
- Has 10+ consecutive hours off between shifts
- Still limited to 11 hours of driving
- Exempt from the 30-minute break requirement
- Exempt from electronic logging if RODS required ≤ 8 days in any 30-day period

### Non-CDL Short-Haul (§ 395.1(e)(2))
- Vehicle does not require a CDL
- Operates within 150 air-mile radius of work reporting location
- May not drive past 14th hour more than 5 days in any 7-day period
- May not drive past 16th hour more than 2 days in any 7-day period
- Exempt from log requirements (carrier keeps time records only)
- Cannot use the 16-hour exception or split sleeper if relying on this

### 16-Hour Short-Haul (§ 395.1(o))
- Once-per-7-day extension of the 14-hour window to 16 hours
- Must return to work reporting location that day and for the prior 5 duty tours
- Released from duty within 16 hours
- Cannot be used by drivers operating under the non-CDL short-haul exception

---

## 11. Record of Duty Status (RODS) — Daily Log Requirements

Each daily log (one per 24-hour calendar day) must include:

### Required Fields (Header / Footer)
- Date (month, day, year)
- Total miles driven during the 24-hour period
- Truck/tractor and trailer number(s) — vehicle ID or license + state
- Carrier name (if multiple carriers in the day, list each with start/end times)
- Carrier main office address (city + state minimum)
- Driver signature and certification statement
- Co-driver name (if applicable)
- Time zone — must use home terminal time, even when crossing zones
- Shipping document number(s) or shipper name + commodity

### The 24-Hour Graph Grid
The grid has four duty status rows:
- Off Duty
- Sleeper Berth
- Driving
- On Duty (Not Driving)

For each duty period, draw a horizontal line on the appropriate row spanning the time. Vertical lines connect status changes. Each row's total time is summed and displayed at the right margin. The four totals must equal exactly 24.0 hours.

### Remarks Section
At every status change, the remarks must show:
- City, town, or village name + state abbreviation, OR
- Highway number + nearest milepost + nearest city + state, OR
- Highway number + service plaza name + nearest city + state, OR
- Highway numbers of the two nearest intersecting roadways + nearest city + state

The remarks section may also note: shipping info, adverse driving conditions, state-line crossings, exception usage, or any other clarifying notes.

### Submission and Retention
- Driver submits the original to the carrier within 13 days
- Driver retains a copy for 7 consecutive days
- Logs must be available for inspection by law enforcement

---

## 12. Electronic Logging Device (ELD) Requirements

For drivers required to maintain RODS more than 8 days in any 30-day period, an ELD is required (vs. paper logs).

### What Must Be Automatic
- Driving status auto-engages when the vehicle moves above ~5 mph
- GPS location captured at every duty status change
- GPS location captured at 60-minute intervals while driving
- Engine on/off events
- Vehicle miles and engine hours pulled from the engine

### What the Driver Manually Sets
- On-duty (not driving)
- Off-duty
- Sleeper berth
- Personal conveyance
- Yard moves

### Editable vs. Locked
- Driving status records cannot be edited by the driver
- Other status records can be edited, but every edit must be annotated with reason and timestamp
- Once a daily log is signed by the driver, it is locked except via formal correction

### Driver Confirmation Behaviors
- After ~5 minutes of stillness, the device should prompt for a duty status
- After ~15-30 minutes without confirmation, the device defaults to on-duty (not driving) — the most conservative interpretation
- The device cannot silently mark a driver off-duty without their explicit confirmation

### Privacy Constraints
- Location data during personal conveyance must be obscured to ~10-mile precision
- Drivers must be informed of what is recorded, who has access, and retention periods

---

## 13. Practical Time Defaults for the App

To make trip planning feasible, use these conservative defaults:

| Activity | Time | Status |
|---|---|---|
| Average truck driving speed | 55 mph | Driving |
| Pickup activity | 60 min | On-duty (not driving) |
| Dropoff activity | 60 min | On-duty (not driving) |
| Fuel stop | 30 min | On-duty (not driving) |
| 30-min break | 30 min | Off-duty (default) |
| 10-hour rest | 600 min | Off-duty or sleeper |
| 34-hour restart | 2,040 min | Off-duty or sleeper |
| Pre-trip inspection | 15 min | On-duty (not driving) |
| Post-trip inspection | 15 min | On-duty (not driving) |

---

## 14. Validation Rules — Hard Stops in the App

The app must refuse to schedule any trip leg that would violate:

1. The 11-hour driving limit (driving cannot exceed 11 hours within a duty window)
2. The 14-hour driving window (no driving past hour 14 from start of duty)
3. The 70-hour cycle (cumulative on-duty over rolling 8 days cannot exceed 70 hours)
4. The 30-minute break requirement (cannot drive after 8 cumulative hours without a break)
5. The 10-hour rest requirement (cannot resume driving without 10 consecutive hours off, or qualifying split)

The app must surface a warning (not a hard stop) when:

- A planned stop has tight margin (less than 30 min before a limit)
- The trip will require a 34-hour restart
- The trip cannot be completed without invoking adverse conditions or short-haul exceptions
- The driver's current cycle balance leaves insufficient hours for the trip

---

## 15. Day-Boundary Handling

A single duty period or driving session may span midnight. The app must:

- Generate a separate log sheet for each calendar day
- Split the duty entry at midnight on each log
- Ensure the four duty totals for each daily log sum to exactly 24.0 hours
- Use the home terminal time zone for all entries, even if the driver physically crosses time zones during the period
