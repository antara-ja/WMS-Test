# WMS Real-Time Dashboard — Full Spec for Claude Code

## Overview

Build a real-time warehouse management dashboard with 3 main views, a global item search feature, and WebSocket-based live updates. This is for a **bridal gown warehouse** — the inventory is dresses (items have style numbers, color codes, sizes).

**Stack:** React frontend + Express backend (separate projects in a monorepo). Push to GitHub.

**Database:** MongoDB (`wms_db` database). Connection string will be provided as an env variable `MONGODB_URI`.

---

## Architecture

```
wms-dashboard/
├── client/                    # React app (Vite or CRA)
│   ├── src/
│   │   ├── components/
│   │   │   ├── HeatmapGrid/   # Chart 1 — aisle × level heatmap
│   │   │   ├── MovementChart/  # Chart 2 — inventory movement timeline
│   │   │   ├── AgingTable/     # Chart 3 — aging inventory
│   │   │   ├── SearchBar/      # Global item search
│   │   │   ├── DetailPanel/    # Drill-down sidebar
│   │   │   └── Layout/         # Dashboard shell, header, stats cards
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts # WebSocket connection hook
│   │   │   └── useInventory.ts # Data fetching/state
│   │   └── utils/
│   │       └── heatColors.ts   # Color scale logic
│   └── package.json
├── server/                    # Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── inventory.ts    # Heatmap data endpoints
│   │   │   ├── adjustments.ts  # Movement data endpoints
│   │   │   ├── aging.ts        # Aging inventory endpoint
│   │   │   └── search.ts       # Item search endpoint
│   │   ├── services/
│   │   │   ├── mongodb.ts      # Connection singleton
│   │   │   └── changeStream.ts # MongoDB Change Stream → WebSocket
│   │   └── index.ts            # Express + WebSocket server
│   └── package.json
├── .env.example
└── README.md
```

---

## Database Schema Reference

All data lives in database `wms_db`. Here are the key collections and their schemas:

### `locationInventory` (~3,083 docs)
This is the PRIMARY collection for Chart 1. Each document = one bin location.

```json
{
  "warehouseCode": "US",
  "locationId": 21457,
  "locationLookupCode": "L-01-005",   // Format: "{Aisle}-{Row}-{Bin}"
  "items": [
    {
      "company": "US",
      "division": "001",
      "itemNumber": "11379",           // Style number — used for search
      "colorCode": "IVIVL",            // Color code — used for search
      "description": "Lanie - Stretch crepe fit and flare gown...",
      "itemQuantity": 8,               // Total qty of this item at this location
      "sizes": [
        { "sizeNumber": 9, "size": "16", "quantity": 8 }
      ],
      "lastTransactionDate": "2026-03-17T04:00:00Z",  // KEY for aging chart
      "details": [
        {
          "customer": "HOUSE",          // Customer allocation
          "customerPoNumber": "16134",
          "countryOfOrigin": "China",
          "date": "2026-01-23T17:07:12.649Z",
          "quantity": 8,
          "sizes": [{ "sizeNumber": 9, "size": "16", "quantity": 8 }]
        }
      ]
    }
  ],
  "pallets": [],
  "cartons": [],
  "shippingCartons": [],
  "bins": []
}
```

**IMPORTANT — locationLookupCode format:**
- `{Aisle}-{Row}-{Bin}` e.g., `L-01-005` = Aisle L, Row 01, Bin 005
- The "Row" number maps to "Level" in the UI: Row 01 = Level 1 (L01, ground floor), Row 02 = Level 2 (L02), etc.
- Some locations have non-numeric rows like `A-RETURNS` — filter these out for the heatmap
- **Aisles to include:** A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, Q (16 aisles)
- **Ignore these aisles** (exclude from all queries and UI): 1OFF, 98, CYNDI, FAB, INC, INS, OPS, PB, QIK, REF, RET, Z, jennifer, miguel, moises
- Most aisles have rows 01-04 or 01-05. Only include rows with numeric names (01, 02, etc.) in the grid.

### `adjustments` (~166,855 docs)
Used for Chart 2 (movement timeline) and could supplement real-time updates.

```json
{
  "adjustmentId": 166670,
  "userId": "erick",
  "warehouseCode": "US",
  "sourceLocationCode": "Z-SHIPPING001",
  "destinationLocationCode": "",
  "adjustmentType": "Transfer",     // "Transfer" (163k), "In" (2.7k), or "Out" (387)
  "transactionType": "Invoice",
  "transactionNumber": "567539",
  "adjustmentDetails": {
    "items": [{
      "itemNumber": "66345",
      "colorCode": "SDIV",
      "quantity": 1,
      "sizes": [{ "size": "14", "quantity": 1 }]
    }]
  },
  "createdAt": "2026-03-24T19:38:09.381Z"
}
```

### `locations` (~6,104 docs)
Location hierarchy metadata. Useful for understanding structure.

```json
{
  "locationId": 19764,
  "locationCode": "A",
  "lookupCode": "A",
  "locationType": "Aisle",       // Types: Warehouse, Aisle, Row, Bin
  "locationArea": "PickAndPack",
  "parentLookupCode": "US",
  "warehouseCode": "US",
  "isActive": true
}
```

### `locationHierarchy` (28 docs)
Defines the hierarchy: Warehouse → Aisle → Row → Bin

---

## Chart 1: Aisle × Level Heatmap Grid (PRIMARY FEATURE)

### Visual Design
A data grid/matrix table:
- **Columns** = Aisles: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, Q (16 columns)
- **Rows** = Levels: L01, L02, L03, L04, L05 (5 rows — only numeric row values)
- **Each cell** shows the total dress count for that aisle/level combination
- **Cell background color** = heatmap intensity based on quantity

### Color Scale
Use these ranges (matching the reference screenshot):
| Range | Color | Meaning |
|-------|-------|---------|
| 0 | Light pink/red border, white bg | Empty |
| 1–49 | Very light beige | Low |
| 50–199 | Light blue | Medium-low |
| 200–499 | Medium blue | Medium |
| 500–999 | Dark blue | High |
| 1,000+ | Darkest blue | Very high |

### Toggle Views (buttons above the grid)
Four view modes that change what each cell displays:
1. **Dress count** (default) — total `itemQuantity` sum
2. **Avg per bin** — total qty ÷ number of bins in that aisle/level
3. **Empty bins** — count of bins with 0 items (show as red-scale heatmap)
4. **Pick frequency** — count of adjustments (Transfers) from that aisle/level in last 7 days

### Summary Stat Cards (above the grid)
Four cards that update based on the current toggle view:
- Total dresses in warehouse (all aisles)
- Dresses at level 1 (ground floor, no ladder needed)
- Dresses at levels 2–5 (require ladder)
- Completely empty L01 aisles (count of aisles with zero ground-floor stock)

### Backend API: `GET /api/inventory/heatmap`

```javascript
// Core aggregation pipeline for the heatmap
db.locationInventory.aggregate([
  { $match: { warehouseCode: "US" } },
  { $project: {
      parts: { $split: ["$locationLookupCode", "-"] },
      totalItems: { $sum: "$items.itemQuantity" },
      itemCount: { $size: "$items" },
      hasItems: { $gt: [{ $size: "$items" }, 0] }
  }},
  { $match: { $expr: { $and: [
      { $gte: [{ $size: "$parts" }, 3] },
      { $regexMatch: { input: { $arrayElemAt: ["$parts", 1] }, regex: /^\d+$/ } }
  ]}}},
  { $project: {
      aisle: { $arrayElemAt: ["$parts", 0] },
      level: { $arrayElemAt: ["$parts", 1] },
      bin: { $arrayElemAt: ["$parts", 2] },
      totalItems: 1,
      itemCount: 1,
      hasItems: 1
  }},
  { $group: {
      _id: { aisle: "$aisle", level: "$level" },
      totalQuantity: { $sum: "$totalItems" },
      totalSKUs: { $sum: "$itemCount" },
      binCount: { $sum: 1 },
      occupiedBins: { $sum: { $cond: ["$hasItems", 1, 0] } },
      emptyBins: { $sum: { $cond: ["$hasItems", 0, 1] } }
  }},
  // Only include the 16 active aisles, exclude ignored ones
  { $match: { "_id.aisle": { $in: ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","Q"] }, "_id.level": { $regex: /^\d+$/ } } },
  { $sort: { "_id.aisle": 1, "_id.level": 1 } }
])
```

### Drill-Down Interaction
- **Click a cell** → opens a side panel showing all bins within that aisle/level
- Panel shows: list of bins, each with item details (style#, color, qty, sizes, customer, last transaction date)
- **Click a column header (aisle)** → highlights column, shows aisle-level summary
- **Click a row header (level)** → highlights row, shows cross-aisle comparison

### Backend API: `GET /api/inventory/detail/:aisle/:level`

```javascript
// Get individual bins for a specific aisle/level
db.locationInventory.aggregate([
  { $match: {
      warehouseCode: "US",
      locationLookupCode: { $regex: `^${aisle}-${level}-` }
  }},
  { $project: {
      locationLookupCode: 1,
      items: {
        $map: {
          input: "$items",
          as: "item",
          in: {
            itemNumber: "$$item.itemNumber",
            colorCode: "$$item.colorCode",
            description: "$$item.description",
            quantity: "$$item.itemQuantity",
            sizes: "$$item.sizes",
            lastTransaction: "$$item.lastTransactionDate",
            customer: { $arrayElemAt: ["$$item.details.customer", 0] }
          }
        }
      },
      totalQty: { $sum: "$items.itemQuantity" }
  }},
  { $sort: { locationLookupCode: 1 } }
])
```

---

## Chart 2: Inventory Movement Timeline

A line or area chart showing inventory movement over time.

### Visual Design
- **X-axis**: Date (last 30 days by default, with date range picker)
- **Y-axis**: Number of items moved
- **Three lines/areas**: Transfers (dominant), In, Out
- Color-coded: Transfers = blue, In = green, Out = red

### Backend API: `GET /api/adjustments/timeline?days=30`

```javascript
db.adjustments.aggregate([
  { $match: {
      warehouseCode: "US",
      createdAt: { $gte: thirtyDaysAgo }
  }},
  { $group: {
      _id: {
        date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        type: "$adjustmentType"
      },
      count: { $sum: 1 },
      totalQty: { $sum: {
        $reduce: {
          input: "$adjustmentDetails.items",
          initialValue: 0,
          in: { $add: ["$$value", { $ifNull: ["$$this.quantity", 0] }] }
        }
      }}
  }},
  { $sort: { "_id.date": 1 } }
])
```

---

## Chart 3: Aging Inventory

A sortable table showing items that have been sitting in their location the longest without any movement.

### Visual Design
- Table with columns: Location, Style#, Color, Description, Qty, Customer, Days Since Last Move
- Color-coded rows by age: 
  - < 30 days: white/normal
  - 30–60 days: light yellow
  - 60–90 days: light orange
  - 90+ days: light red
- Sortable by any column (default: Days Since Last Move descending)
- Filterable by aisle
- Pagination (show 25 per page)

### Backend API: `GET /api/inventory/aging?minDays=0&aisle=&page=1&limit=25`

```javascript
db.locationInventory.aggregate([
  { $match: { warehouseCode: "US", "items.0": { $exists: true } } },
  { $unwind: "$items" },
  { $project: {
      locationLookupCode: 1,
      aisle: { $arrayElemAt: [{ $split: ["$locationLookupCode", "-"] }, 0] },
      itemNumber: "$items.itemNumber",
      colorCode: "$items.colorCode",
      description: "$items.description",
      quantity: "$items.itemQuantity",
      customer: { $arrayElemAt: ["$items.details.customer", 0] },
      lastTransaction: "$items.lastTransactionDate",
      daysSinceMove: {
        $dateDiff: {
          startDate: "$items.lastTransactionDate",
          endDate: new Date(),
          unit: "day"
        }
      }
  }},
  // Optional: filter by minimum days and aisle
  { $sort: { daysSinceMove: -1 } },
  { $skip: (page - 1) * limit },
  { $limit: limit }
])
```

### Real Data Insight
The oldest items in the warehouse haven't moved since June 16, 2025 — that's 280+ days. These are in Aisle D, Row 02 (styles LV095, LV096, 11354). This chart will immediately surface these.

---

## Global Item Search

### Visual Design
- Search bar at the top of the dashboard
- Type a style number (e.g., "66345") or color code ("SDIV") or description keyword
- Results appear as a dropdown list showing: style#, color, total qty in warehouse, number of locations
- Clicking a result highlights all matching cells in the heatmap grid
- Option to expand and see every bin location where that item exists

### Backend API: `GET /api/search?q=66345`

```javascript
db.locationInventory.aggregate([
  { $match: { warehouseCode: "US", "items.0": { $exists: true } } },
  { $unwind: "$items" },
  { $match: {
      $or: [
        { "items.itemNumber": { $regex: query, $options: "i" } },
        { "items.colorCode": { $regex: query, $options: "i" } },
        { "items.description": { $regex: query, $options: "i" } }
      ]
  }},
  { $group: {
      _id: { itemNumber: "$items.itemNumber", colorCode: "$items.colorCode" },
      description: { $first: "$items.description" },
      totalQuantity: { $sum: "$items.itemQuantity" },
      locations: { $push: {
        location: "$locationLookupCode",
        quantity: "$items.itemQuantity",
        sizes: "$items.sizes"
      }},
      locationCount: { $sum: 1 }
  }},
  { $sort: { totalQuantity: -1 } },
  { $limit: 20 }
])
```

---

## Real-Time: WebSocket via MongoDB Change Streams

### Server-Side
Watch the `adjustments` collection for new inserts (this is the most active collection — it gets new docs every time inventory moves).

```javascript
const pipeline = [{ $match: { operationType: "insert" } }];
const changeStream = db.collection("adjustments").watch(pipeline, {
  fullDocument: "updateLookup"
});

changeStream.on("change", (change) => {
  const adj = change.fullDocument;
  // Broadcast to all connected WebSocket clients
  wss.clients.forEach(client => {
    client.send(JSON.stringify({
      type: "ADJUSTMENT",
      data: {
        id: adj.adjustmentId,
        user: adj.userId,
        type: adj.adjustmentType,
        from: adj.sourceLocationCode,
        to: adj.destinationLocationCode,
        items: adj.adjustmentDetails?.items?.map(i => ({
          style: i.itemNumber,
          color: i.colorCode,
          qty: i.quantity
        })),
        timestamp: adj.createdAt
      }
    }));
  });
});
```

### Client-Side
- On receiving a WebSocket message, update the relevant cell in the heatmap
- Flash/animate the affected cell briefly to show the change
- Update the stat cards
- Append to the activity feed if Chart 2 is showing live data
- Show a small toast notification: "erick moved 1x 66345/SDIV from Z-SHIPPING001"

### Fallback
If WebSocket disconnects, fall back to polling every 30 seconds.

---

## UI Design Notes

- Clean, data-dense dashboard — not flashy. Think Grafana / Metabase aesthetic.
- Dark mode by default (warehouse managers often look at screens in dim environments) with light mode toggle
- The heatmap grid should be the largest element, taking up ~60% of the viewport
- Charts 2 and 3 sit below or beside the heatmap
- The search bar is persistent in the top header
- Use a monospace or tabular font for numbers in the grid cells so they align cleanly
- Responsive but desktop-first (this will primarily be viewed on wall-mounted screens or office monitors)

### Suggested Libraries
- **Recharts** or **Chart.js** for Chart 2 (timeline)
- **TanStack Table** for Chart 3 (aging table with sorting/filtering/pagination)
- **Tailwind CSS** for styling
- **Socket.io** for WebSocket (handles reconnection/fallback automatically)
- **shadcn/ui** for UI components (cards, buttons, search input, toggles)

---

## Environment Variables

```env
MONGODB_URI=mongodb+srv://...        # MongoDB connection string
PORT=3001                             # Express server port
CLIENT_PORT=5173                      # React dev server port
WS_PORT=3001                          # WebSocket (same as Express)
```

---

## Getting Started (for Claude Code)

1. Initialize the monorepo with `client/` and `server/` directories
2. Set up Express with MongoDB connection in `server/`
3. Set up React with Vite in `client/`
4. Build Chart 1 (heatmap grid) first — it's the core feature
5. Add the search bar
6. Add Chart 2 and Chart 3
7. Wire up WebSocket with Change Streams
8. Add drill-down panel
9. Push to GitHub

---

## Notes on the Data

- **Warehouse code is always "US"** — filter by `warehouseCode: "US"` on every query
- **Aisles for the heatmap:** A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, Q (16 aisles)
- **Ignored aisles** (exclude everywhere): 1OFF, 98, CYNDI, FAB, INC, INS, OPS, PB, QIK, REF, RET, Z, jennifer, miguel, moises
- **Levels (rows) are 01–05** but not all aisles have all 5 levels. B and C have 5, some others have 4.
- **locationLookupCode format:** `{Aisle}-{Row}-{Bin}` e.g., `L-01-005`
- **Items are dresses** — descriptions include style names and fabric details
- **The `adjustments` collection** is the activity log: 163k Transfers, 2.7k In, 387 Out
- **Oldest unmoved items** date to June 2025 (280+ days) — mostly in Aisle D
- **Aisle B row 01** is an outlier with 7,380 items — likely bulk storage. The heatmap should handle this gracefully (darkest color, but don't let it wash out the rest of the scale)
