# TrucBuddy

A mobile-first trip planner for US truck drivers. Enter a trip in four fields and get a truck-aware route, automatically scheduled fuel and rest stops that respect FMCSA Hours-of-Service rules, and printable ELD-style daily log sheets — all in one anonymous, device-local app.

**Live:** https://trucbuddy.vercel.app/

## Features

- **4-input trip form** — current location, pickup, dropoff, and current cycle hours used.
- **Truck-aware routing** — `driving-hgv` profile via OpenRouteService; rendered on an OSM map.
- **HOS-compliant schedule** — automatic 30-min breaks, 10-hr resets, and 34-hr restarts following 70/8 cycle rules.
- **Auto-placed stops** — fuel every ~1,000 mi and rest stops near truck-friendly locations from OSM (Overpass), with the option to swap any stop for a nearby alternative.
- **Drawn ELD daily logs** — visual 24-hour grid with status periods, totals, and remarks. One sheet per day, sign to lock, post-signing changes recorded as corrections.
- **Lite live tracking** — mark current status, add fuel/break events on the road, and reflow remaining schedule from "now."
- **Anonymous & private** — no accounts; trips are scoped to your device via an anonymous client ID.
