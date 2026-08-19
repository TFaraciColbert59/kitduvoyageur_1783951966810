---
name: nextjs-performance
description: Next.js 15 and React performance optimization for LKDV.
---

# Next.js Performance

Optimize for:
- mobile
- Core Web Vitals
- low bandwidth
- fast initial rendering
- smooth interactions

## Rules

Before optimizing:
1. Identify the actual bottleneck.
2. Inspect existing implementation.
3. Avoid premature optimization.
4. Do not sacrifice functionality for insignificant gains.

## Next.js

Prefer:
- Server Components where appropriate
- dynamic imports for heavy client components
- streaming/loading states
- appropriate caching
- server-side data fetching when beneficial
- next/image for images
- minimal client JavaScript

Be careful with:
- Leaflet
- React-Leaflet
- Recharts
- Framer Motion
- large client components

Heavy browser-only libraries should not unnecessarily load on every route.

## React

Avoid:
- unnecessary re-renders
- huge Context providers
- duplicated state
- expensive calculations during render
- unstable list keys

Use memoization only when it provides measurable value.

## Maps

Map pages are performance-sensitive.

Prefer:
- lazy loading
- viewport-based data
- clustering
- simplified geometries
- pagination
- server-side filtering
- avoiding loading all trails at once

## Mobile

LKDV is heavily mobile-oriented.

Prioritize:
- touch responsiveness
- fast first paint
- smooth scrolling
- low memory usage
- small JavaScript payloads
- graceful loading states
