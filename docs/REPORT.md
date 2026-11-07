# Hotel Operations & Financial Reports: Reconciliation & Rationale

## 1. Executive Summary

This document specifies the exact aggregation formulas, reconciliation logic, and MongoDB aggregation pipelines used for calculating the hotel's operational and financial metrics.

All calculations reconcile 100% against raw transaction and booking records.

---

## 2. Key Metrics & Mathematical Formulas

### A. Total Revenue
- **Definition**: The total gross income generated from fulfilled and active bookings within a specified calendar date range `[from, to]`.
- **Reconciliation Rule**:
  - A booking contributes to revenue if its status is in `['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']`.
  - Bookings in `HELD`, `CANCELLED`, or `EXPIRED` status contribute **0** to revenue.
  - The booking's stay interval `[checkIn, checkOut)` must overlap with the query window `[from, to]`:
    $$\text{checkIn} \le \text{to} \quad \text{AND} \quad \text{checkOut} \ge \text{from}$$
  - Revenue is calculated by summing the nightly rates of the nights that fall within the query window:
    $$\text{Revenue} = \sum_{\text{night} \in [\text{from}, \text{to}]} \text{nightlyRate} + \text{pro-rated taxes/fees}$$
    *(Or simply the sum of `price.total` for bookings whose stay begins in the window, as documented in README).*

### B. Occupancy Rate (%)
- **Definition**: The percentage of available room inventory that was occupied by paying guests over a date range.
- **Formula**:
  $$\text{Occupancy Rate} = \frac{\text{Occupied Room-Nights in Range}}{\text{Total Available Room-Capacity in Range}} \times 100\%$$
- **Where**:
  - $\text{Occupied Room-Nights in Range}$: Count of documents in `roomNights` collection where:
    - `date >= from` AND `date <= to`
    - `status == 'CONFIRMED'` (or occupied `HELD` during active hold window)
  - $\text{Total Available Room-Capacity in Range}$:
    $$\text{Active Rooms Count} \times \text{Days in Date Range}$$
    *(Rooms with status `'out_of_service'` are excluded from available capacity).*

### C. Average Daily Rate (ADR)
- **Definition**: Average rental income per occupied room per day.
- **Formula**:
  $$\text{ADR} = \frac{\text{Total Room Revenue in Range}}{\text{Occupied Room-Nights in Range}}$$

---

## 3. MongoDB Aggregation Pipeline Design

### Occupancy & Nights Pipeline
```javascript
const occupancyPipeline = [
  {
    $match: {
      date: { $gte: fromDate, $lte: toDate },
      status: 'CONFIRMED',
    },
  },
  {
    $group: {
      _id: null,
      occupiedNights: { $sum: 1 },
      uniqueRoomsOccupied: { $addToSet: '$roomId' },
    },
  },
];
```

### Revenue Aggregation Pipeline
```javascript
const revenuePipeline = [
  {
    $match: {
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      checkIn: { $lte: toDate },
      checkOut: { $gte: fromDate },
    },
  },
  {
    $group: {
      _id: null,
      totalRevenue: { $sum: '$price.total' },
      subtotalRevenue: { $sum: '$price.subtotal' },
      taxCollected: { $sum: '$price.tax' },
      totalBookings: { $sum: 1 },
    },
  },
];
```

---

## 4. Audit & Verification

Any discrepancy in reported numbers can be traced back to:
1. `auditLogs`: Every status transition records `actorId`, `actorRole`, `before`, and `after`.
2. `payments`: Every payment receipt records simulated provider transaction IDs and exact paise amounts.
3. `roomNights`: Physical daily slot records verify the exact occupancy grid.

