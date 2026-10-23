# Singapore Haze Map

A mobile-friendly web application displaying real-time haze and air-quality conditions across Singapore on an interactive keyless MapLibre map.

## Features

- **Live Singapore Government Data**: Automatically retrieves real-time 24-Hour PSI and 1-Hour/24-Hour PM2.5 readings from the National Environment Agency (NEA) via official `data.gov.sg` open data APIs.
- **Serverless Architecture**: All haze requests route through the Vercel serverless function `GET /api/haze` with in-memory caching and on-demand refresh capability.
- **Interactive MapLibre GL JS**:
  - Centered on Singapore (`[103.8198, 1.3521]`).
  - Keyless OpenStreetMap basemap — requires no Google Maps API key, no Google billing, and no Mapbox access token.
  - GeoJSON data layer with official PSI color-coding (Good, Moderate, Unhealthy, Very Unhealthy, Hazardous).
  - Prominent regional badges and interactive popups with regional air-quality breakdowns and NEA health advisories.
  - Seamless style switcher: **Clean Light** (desaturated high-contrast canvas) and **OSM Detailed**.
- **Compact Summary Panel**: Highlights the highest regional PSI and PM2.5 values, region names, and last updated time.
- **User Geolocation**: Optional "Show My Location" button with browser Geolocation API and graceful permission denial handling.
- **Mobile-First Design**: Accessible touch targets, responsive layout, tabular figures, and WCAG AA contrast.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Mapping**: MapLibre GL JS, OpenStreetMap
- **Backend / Serverless**: Vercel Serverless Function (`api/haze.js`), Node.js
- **Data Source**: Singapore National Environment Agency (NEA) via `data.gov.sg`

## Getting Started

### Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Production Build

```bash
npm run build
```

The app is ready for instant deployment to [Vercel](https://vercel.com).
