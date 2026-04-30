# Truck Driver Scenarios & Edge Cases

A flat checklist of every scenario and edge case the web app must handle. Use this as a review checklist after the build is complete

> **Spec assumptions:** Property-carrying driver, 70 hr / 8 day cycle, fueling at least once every 1,000 miles, 1 hour each for pickup and dropoff.

---

## Trip Input Form

- [ ] All four inputs are required: current location, pickup, dropoff, current cycle hours used
- [ ] Form validates before allowing trip calculation
- [ ] If a saved trip exists, the form pre-loads with the option to start fresh or continue the previous trip
- [ ] Location fields support geocoded autocomplete suggestions to disambiguate names like "Springfield" or "Chicago"
- [ ] Fuzzy matching handles minor typos in location names
- [ ] Zip codes (e.g., "30303") resolve to a city
- [ ] Both addresses and city names work as input
- [ ] Failed geocoding surfaces a clear error with retry option, never silent fallback
- [ ] Cycle hours of 0 → driver is fresh, full 70 available
- [ ] Cycle hours of 70 → driver cannot drive without a 34-hour restart, app shows this prominently
- [ ] Cycle hours greater than 70 → rejected with explanation
- [ ] Cycle hours that are negative or non-numeric → rejected
- [ ] 65+ hours used → app preemptively warns that driving time is very limited
- [ ] 55–65 hours used → trip calculated, but app flags if it exceeds remaining cycle
- [ ] Assumption documented to user: prior cycle hours assumed evenly distributed across past 8 days
- [ ] Form note explains that mid-trip cycle "drop-offs" are estimates, not exact

---

## Same-Location Edge Cases

- [ ] Current location = pickup → deadhead leg is skipped, trip starts with pickup
- [ ] Pickup = dropoff → zero-distance trip surfaces a confirmation prompt
- [ ] Current location = dropoff → handled as a single leg (driver returning empty)

---

## Trip Feasibility

- [ ] Distance can physically be covered without violating cycle limits (with 34-hour restart inserted if needed)
- [ ] Trip requiring more than 70 hours of on-duty time AND no restart fits → blocked with "trip not feasible" message
- [ ] Trip with 70 hours used and no time/space for a restart → blocked with clear messaging

---

## Route Calculation

- [ ] Route is computed via free map/routing API
- [ ] Route handles current location → pickup → dropoff as sequential legs
- [ ] No-route-available case surfaces a clear error with retry
- [ ] Average truck speed of 55 mph is used (not highway speed limit)
- [ ] Trip summary shows: total distance, total drive time, total trip duration, ETA, number of daily logs

---

## Trip Length Variations

- [ ] Trip ≤ 11 driving hours → no overnight rest needed, single daily log
- [ ] Trip < 8 driving hours → no 30-min break needed
- [ ] Trip exactly at the 11-hour driving limit → app leaves buffer (~10.5 hr usable) for traffic variability
- [ ] Trip requiring exactly one overnight rest → standard multi-day handling
- [ ] Trip requiring multiple overnight rests but no 34-hour restart → standard long-haul flow with multiple daily logs
- [ ] Trip requiring a 34-hour restart → restart inserted at sensible location, restart days appear as off-duty in logs, surfaced clearly in route overview
- [ ] A driving session that crosses midnight → split across two daily logs at midnight boundary
- [ ] Each daily log's four duty totals sum to exactly 24.0 hours

---

## Stop Computation (App Auto-Picks)

- [ ] Fuel stops inserted every 1,000 driving miles
- [ ] Each fuel stop logged as ~30 minutes on-duty (not driving)
- [ ] Fuel stops combined with a 30-min break or rest when timing aligns
- [ ] 30-minute breaks inserted before 8 cumulative driving hours are reached
- [ ] 30-min breaks default to 30 minutes off-duty
- [ ] 10-hour rests inserted before the 11-hour driving limit OR 14-hour window expires
- [ ] 10-hour rests are continuous
- [ ] 34-hour restarts inserted only when trip would otherwise exceed the 70-hour cycle
- [ ] Pickup logged as 1 hour on-duty (not driving) at the pickup location
- [ ] Dropoff logged as 1 hour on-duty (not driving) at the dropoff location

---

## Map Display

- [ ] Route is drawn between current location → pickup → dropoff
- [ ] All stops shown as markers on the map
- [ ] Different stop types use distinct icons or colors (fuel, break, rest, restart, pickup, dropoff)
- [ ] Stops also shown in a timeline or list view alongside the map
- [ ] Each stop displays type, location (city or highway), arrival time, and duration

---

## Daily Log Generation

- [ ] One log sheet generated per calendar day of the trip
- [ ] Each log includes the 24-hour grid with four duty rows: Off Duty, Sleeper Berth, Driving, On Duty (Not Driving)
- [ ] Status changes drawn as horizontal lines on the appropriate row with vertical connectors at transitions
- [ ] Each row's total hours summed and displayed at the right margin of the grid
- [ ] All four row totals sum to exactly 24.0 hours per log

---

## Required Log Fields

- [ ] Date (month, day, year)
- [ ] Total miles driven during the 24-hour period
- [ ] Truck/tractor and trailer number (placeholder values acceptable)
- [ ] Carrier name (placeholder acceptable)
- [ ] Carrier main office address (placeholder acceptable)
- [ ] Driver signature line
- [ ] Remarks section showing city + state at each status change
- [ ] Shipping document number or shipper name (placeholder acceptable)

---

## Multi-Day Log Cases

- [ ] Trip starting late in the day → Day 1 log shows only evening hours, Day 2 starts with continued driving past midnight
- [ ] Trip with 34-hour restart → restart days show single off-duty line spanning all 24 hours
- [ ] Trip ending mid-day → final log shows morning driving plus off-duty filling remainder so totals = 24 hours
- [ ] Multiple log sheets are navigable (tabs or scroll for each day)
- [ ] Logs are visually rendered (drawn) on screen, not just shown as text
- [ ] Logs are downloadable or printable as a deliverable

---

## Driver-Choice Stop Selection

- [ ] For each required stop window, present 3-5 ranked options to the driver
- [ ] Driver taps to select; UI advances to next stop
- [ ] Map and timeline update live as choices are made
- [ ] Stop options show amenities (showers, food, laundry, parking spaces, fuel price)
- [ ] Stop options show urgency labels (e.g., "tight margin", "25 mi earlier")
- [ ] Stop options surface warnings ("often full after 6 PM")
- [ ] Driver picking a stop outside the legal window → blocked with explanation
- [ ] Driver picking a stop far earlier than required → allowed but warned about time impact
- [ ] Driver can search for a stop not in the suggested list ("find another stop")
- [ ] Custom stop choice is validated to fall within the legal window
- [ ] Custom stop choice warns if no truck parking is available
- [ ] Driver can skip a suggested fuel stop if range allows
- [ ] Skipping fuel stop warns if mileage exceeds 1,000 miles without fuel
- [ ] Going back to change an earlier stop recalculates all subsequent stops
- [ ] Map, timeline, and logs update consistently when re-selecting
- [ ] Subsequent stops that become invalid trigger re-prompt
- [ ] Auto-pick mode available for drivers who want speed over choice
- [ ] Stops sorted by best-fit, with the most balanced option highlighted
- [ ] Different stop types use different selection criteria (parking for rests, amenities for breaks, fuel price for fuel)
- [ ] No-parking-in-window case offers expanded search radius or earlier stop recommendation

---

## Active Trip Tracking 

- [ ] GPS tracking starts when driver clicks "Start Trip"
- [ ] App auto-detects driving status when vehicle moves above ~5 mph
- [ ] App auto-detects stops when vehicle is stationary for 3-5 minutes
- [ ] At known waypoints, app pre-fills the suggested status for one-tap confirmation
- [ ] At unplanned stops, app shows all four duty status options with no pre-selection
- [ ] Brief stops (under 3 minutes) do not trigger status prompts
- [ ] Stop without driver input for 5 min → status prompt appears
- [ ] Stop without confirmation for 15-30 min → defaults to on-duty (not driving)
- [ ] App never silently marks driver off-duty without explicit confirmation
- [ ] GPS context distinguishes truck-stop parking from highway shoulder
- [ ] Brief speed crossings of 5 mph (creeping in traffic) don't flicker status — debounced
- [ ] Phone GPS drift while parked doesn't trigger false "driving" status
- [ ] Phone offline (no signal) → app continues local tracking
- [ ] Local tracking syncs to server when connection restored
- [ ] Offline indicator visible to driver when disconnected
- [ ] Vehicle moved by shop personnel without driver in cab → driver can annotate with audit trail
- [ ] Phone disconnected from vehicle → periodic prompt to verify
- [ ] Live HOS clocks update in real-time (driving, 14-hr window, cycle)
- [ ] HOS clock progress bars change color as limits approach
- [ ] Live banner shows what's next (e.g., "30-min break in 1h 22m")
- [ ] Today's plan shown as timeline with done / in-progress / up-next states
- [ ] GPS coordinates and timestamp stamped onto every status change
- [ ] Status timer countdown shown when on a break or rest
- [ ] Driver can extend a break, end early, or change plan from the timer screen
- [ ] Re-plan triggered when traffic delays will hit 11-hour limit before next stop
- [ ] Re-plan triggered when 14-hour window will expire before next stop
- [ ] Re-plan triggered when pickup or dropoff takes longer than 1 hour
- [ ] Re-plan triggered when planned rest stop is full on arrival
- [ ] Re-plan triggered when mechanical issue requires unplanned repair time
- [ ] Re-plan triggered when driver feels unsafe to continue (fatigue, illness)
- [ ] Small delays (under 30 min) update ETAs silently, no alert
- [ ] Medium delays (30 min – 2 hr) surface a passive notification
- [ ] Large delays threatening compliance trigger a loud alert with concrete options
- [ ] Driver running ahead of schedule → ETAs update, downstream stop windows shift earlier and re-validated
- [ ] Re-plan options screen shows three concrete alternatives with trade-offs
- [ ] Recommended option highlighted; driver still makes the call
- [ ] Each re-plan option shows real-world impact (e.g., "tomorrow's arrival 2.5 hours later")
- [ ] After re-plan confirmation, daily logs regenerate automatically
- [ ] Personal conveyance toggle available (off-duty truck movement for personal use)
- [ ] GPS location obscured to ~10-mile precision during personal conveyance
- [ ] Yard moves toggle available (on-duty not driving, doesn't count toward 11-hour limit)
- [ ] Yard moves blocked on public roads
- [ ] Personal conveyance attempted on commercial leg → warning surfaced
- [ ] Driver can take unplanned break with one tap
- [ ] "End shift early" available as one-tap action with clear log handling
- [ ] Driver attempting to drive past 11-hour or 14-hour limit → blocked
- [ ] Driver attempting to skip 30-min break → blocked
- [ ] Vehicle breakdown → status set to on-duty (not driving) with breakdown remark
- [ ] Accident → on-duty status with extensive remarks support
- [ ] Driver medical emergency → "I need help" panic flow available
- [ ] Adverse weather emergency stop → annotated stop, resume when safe
- [ ] At end of shift, app prompts to start the next day after 10 hours off
- [ ] Driver can end shift before reaching planned rest stop, with recalculation
- [ ] Driver can keep driving past planned end if hours permit, with recalculation
- [ ] Cycle hours continue accumulating until midnight reset on trip-completion days
- [ ] After 10 hours off, 11-hour and 14-hour clocks reset; 70-hour cycle continues

---

## Log Editing and Signing

- [ ] Driver can review the day's actual log (auto-generated from tracked events) at end of shift
- [ ] Logs editable before signing (status durations, remarks)
- [ ] Editing introduces gap or overlap → blocked with "totals must sum to 24" error
- [ ] Problematic period highlighted on validation failure
- [ ] Time zone display always uses home terminal time
- [ ] Crossing time zones surfaces note in remarks
- [ ] Driver can add custom remarks before signing
- [ ] Remarks must show city + state at each status change
- [ ] Signature capture via tap-and-draw or saved signature
- [ ] First-time signature can be saved for reuse
- [ ] Once signed, log is locked from silent edits
- [ ] Post-signing corrections require formal annotation with reason
- [ ] Audit trail records: original entry, corrected entry, reason, timestamp, who made the change
- [ ] Driver realizing mistake after signing → "make a correction" path available
- [ ] Unsigned logs retained with persistent reminder to sign
- [ ] Driver submits signed logs to carrier within 13 days
- [ ] Driver retains a copy for at least 7 days
- [ ] Logs available for inspection at any time

---

## HOS Exceptions

### Adverse Driving Conditions Exception

- [ ] Up to 2 additional hours of driving time allowed when invoked
- [ ] Up to 2 additional hours of the 14-hour window allowed when invoked
- [ ] Conditions must be unforeseen at dispatch (sudden fog, crash, unexpected weather)
- [ ] Predictable conditions (rush hour, normal congestion) do NOT qualify
- [ ] Does NOT extend the 70-hour weekly limit
- [ ] Driver must annotate the log with the cause when invoking
- [ ] Available as an option in the re-plan options screen during active trip

### CDL Short-Haul Exception

- [ ] Auto-detected when trip is within 150 air-mile radius of work reporting location
- [ ] Required: driver returns to and is released at the same location within 14 hours
- [ ] Required: 10+ consecutive hours off between shifts
- [ ] Driver still limited to 11 hours of driving
- [ ] Exempt from the 30-minute break requirement
- [ ] Time records may replace electronic logs if RODS required ≤ 8 days in any 30-day period
- [ ] Exception offered to driver when conditions are met

### Non-CDL Short-Haul Exception

- [ ] Auto-detected when vehicle does not require a CDL
- [ ] Required: operates within 150 air-mile radius of work reporting location
- [ ] Cannot drive past 14th hour more than 5 days in any 7-day period
- [ ] Cannot drive past 16th hour more than 2 days in any 7-day period
- [ ] Exempt from log requirements (carrier keeps time records only)
- [ ] Cannot use 16-hour exception or split sleeper if relying on this
- [ ] Exception offered to driver when conditions are met

### 16-Hour Short-Haul Exception

- [ ] Once-per-7-day extension of the 14-hour window to 16 hours
- [ ] Required: driver returns to work reporting location that day and for the prior 5 duty tours
- [ ] Required: released from duty within 16 hours
- [ ] Cannot be used by drivers operating under the non-CDL short-haul exception
- [ ] App tracks usage and prevents more than once per 7-day period
- [ ] Exception offered to driver when conditions are met

---

## Scope Decisions

The following are intentionally not in scope:

- Driver profile system with login, accounts, password reset, and email verification. uses browser-local persistence only.
- Cross-device sync of saved trips. 
- Split sleeper berth provision (Pattern B 7+3 split, Pattern C 7+ and 2+ non-consecutive split). Current supports continuous 10-hour rest only.
- Personal conveyance and yard moves as duty status options.
- Multi-carrier days (logging multiple carriers in a single 24-hour period).
- Team driving (two drivers in one truck with separate logs).
- International border crossings (Canada and Mexico routing and HOS rule differences).
- Truck-restricted routing (bridge heights, weight limits, HAZMAT routing).
- Toll road avoidance based on carrier preferences.
- DOT inspection mode (special view for roadside inspections).
- Carrier policy enforcement (custom rules overriding federal defaults).
- Onboarding tutorial, in-app HOS help, and FMCSA reference links.
- Privacy and data rights features (data export, retention policies).
- App reliability hardening (clock tampering detection, GPS spoofing detection, concurrent edit conflicts).
- Collecting carrier name, truck number, trailer number from the driver.
- Sharing trips between drivers
