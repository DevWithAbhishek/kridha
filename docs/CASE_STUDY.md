## The Problem
Udaan requires 50kg+ minimum orders. A kirana owner needing 8kg mustard oil
from a mill 3km away has no platform — calls, negotiates, pays cash. Zero
payment protection, zero order history.

## The Insight
Delivery is the constraint, not the market. Remove delivery → remove minimum order.
Buyers self-pickup → suppliers serve micro-orders profitably.

## Positioning vs Udaan

| Dimension | Udaan | Kridha |
|---|---|---|
| Model | B2B delivery | B2B+B2C self-pickup |
| Min order | 50kg+ | ₹1,000 per seller |
| Language | English | Hindi-first |
| Suppliers | Large distributors | Farmers, mills, local |
| Payment | Credit-heavy | Advance + on-pickup |

## Technical Decisions

- Phone + PIN: UP Tier-2 users have phones, not Gmail. PIN faster than password.
- PostGIS over Elasticsearch: PostgreSQL already in stack. ST_DWithin + GIST handles India-scale.
- Two-phase Razorpay: advance confirms booking, remaining at pickup after inspection.
- Order → SubOrder: multi-seller checkout. Each seller independent OTP, pickup, payout.
- Hindi-first: notification content per user.preferredLang, resolved at creation.

## Stage 1 Outcome
61 API endpoints live on Vercel. PostgreSQL on Neon with PostGIS.
22 Prisma models. 39 error codes. 19 system invariants. ₹0/month.