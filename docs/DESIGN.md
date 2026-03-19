# DESIGN.md — Kridha Architectural Decisions

## 1. PostGIS for Geospatial Queries

**Decision:** Use PostGIS extension on Neon PostgreSQL for radius-based product discovery.

**Why:** ST_DWithin() computes distance at query time from stored latitude/longitude columns. Enables "show products within 10km" without a separate geospatial service.

**Setup:** `CREATE EXTENSION IF NOT EXISTS postgis;` run in Neon SQL Editor before first migration.

**Index:** `@@index([latitude, longitude])` on Product model for query performance.