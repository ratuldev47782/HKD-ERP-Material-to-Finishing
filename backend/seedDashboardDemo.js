// seedRealHistoryData.js
//
// Seeds the API with the ACTUAL historical rack-card rows you pasted
// (Decathlon - Woven receiving/issuing history), instead of synthetic
// demo data. Unlike seedDashboardDemo.js, this does NOT try to net
// everything back to zero -- it reproduces the real end state: each
// row is received, fully inspected (no reject data was given, so this
// assumes a full pass), racked in its real RACK NO, and then -- if the
// row shows an ISSUE ROLL/YDS -- issued out by that exact amount, so
// the rack ends up holding INHAND ROLL/QTY, matching your sheet.
//
// Flow per row:
//   1. POST /material-receive          (RCVD ROLL / RCVD QTY)
//   2. POST /material-inspection/:id   (passed = full RCVD amount)
//   3. POST /location-assignment/:id   (racks the full RCVD amount at RACK NO)
//   4. If ISSUE ROLL/YDS > 0:
//        POST /cutting-requisition       (requestedYds == ISSUE YDS)
//        POST /cutting-issue/:reqItemId  (issues ISSUE ROLL/YDS from that rack)
//      -> leaves INHAND ROLL/QTY sitting in the rack, matching the sheet.
//
// Usage:
//   API_URL=http://192.169.8.98:5000 node seedRealHistoryData.js
//
// Requires Node 18+ (global fetch).
//
// ============================ ASSUMPTIONS FLAGGED ============================
// I don't have your actual controller/route source for these endpoints, so
// I'm inferring shapes from seedDashboardDemo.js's own comments + your
// schema column names. If any call throws, the printed error body/message
// will usually show the real expected shape -- paste it back and I'll patch:
//
// 1. POST /location-assignment/:itemId body -> { location, rollQty, yds }
// 2. POST /cutting-requisition body items[] -> { itemCodePdm, color, pcs,
//    percentage, consumption } with requestedYds computed server-side as
//    (pcs * consumption). I set pcs=1 and consumption=ISSUE_YDS so that
//    requestedYds lands exactly on the sheet's ISSUE YDS. If your server
//    computes it differently, the requisition's requestedYds (and hence
//    its fulfilled/partial status) may not match -- tell me the real
//    formula and I'll fix pcs/consumption instead of faking it this way.
// 3. GET /material-stock?itemCodePdm=... returns rows with { itemId,
//    itemCodePdm, location, ... } -- used below to find the allocationId
//    to issue against. Several rows in your sheet share the SAME item
//    code across DIFFERENT racks/receives (e.g. 1860326, 2994576,
//    2735981, 2843746, 2659740). To disambiguate I match on BOTH
//    itemCodePdm and location (RACK NO). If a single rack ever holds two
//    separate allocations of the same item code at once, this lookup is
//    ambiguous and will grab whichever row the API returns first for
//    that (itemCodePdm, location) pair -- flag it to me if that happens
//    and I'll add a rollQty-closeness tiebreaker.
// ==============================================================================

const BASE_URL = process.env.API_URL || "http://192.169.8.98:5000";

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`POST ${path} failed (${res.status}): ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`GET ${path} failed (${res.status}): ${json.message || JSON.stringify(json)}`);
  }
  return json;
}

// "2-Jun-25" / "28-Nov-24" -> "2025-06-02" / "2024-11-28"
function parseSheetDate(str) {
  const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const m = str.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!m) throw new Error(`Unrecognized date format: "${str}"`);
  const [, day, mon, yy] = m;
  const month = MONTHS[mon];
  if (!month) throw new Error(`Unrecognized month in date: "${str}"`);
  return `20${yy}-${month}-${day.padStart(2, "0")}`;
}

// Looks up the allocationId ("itemId" per /material-stock's own shape) for
// a given item code AT a given rack location, since several rows below
// share an item code across different racks/receives.
async function getAllocationId(itemCodePdm, location) {
  const json = await get(`/material-stock?itemCodePdm=${encodeURIComponent(itemCodePdm)}`);
  const row = (json.rows || []).find(
    (r) => r.itemCodePdm === itemCodePdm && r.location === location
  );
  if (!row) {
    throw new Error(
      `No rack allocation found for item ${itemCodePdm} @ ${location} -- was it racked yet?`
    );
  }
  return row.itemId; // allocationId
}

// ============================== THE DATA ==============================
// Transcribed 1:1 from the sheet you pasted. Blank ISSUE cells -> 0
// (nothing issued yet, INHAND == RCVD).
const ROWS = [
  { date: "2-Jun-25",  invoice: "HKDA-0341/25", season: "AW25",         po: "DW4559IM04",     sty: "332496",         model: "8645272", fabric: "reinforcement",   item: "reinforcement fabric",          itemCode: "1860326", color: "DKT-N07A BLACK",         rcvdQty: 1633,  rcvdRoll: 10, issueYds: 266,   issueRoll: 2,  rack: "G-J-19", supplier: "TAIHUA", origin: "China", desc: "REINF MORANE PA WR FF CO / 145cm" },
  { date: "28-Mar-25", invoice: "HKDA-0151/25", season: "AW25",         po: "DW4243IM04",     sty: "332496",         model: "8645272", fabric: "Reinforcement",   item: "reinforcement fabric",          itemCode: "1860326", color: "DKT-N07A BLACK",         rcvdQty: 6886,  rcvdRoll: 48, issueYds: 6886,  issueRoll: 48, rack: "G-I-14", supplier: "Taihua", origin: "China", desc: "REINF MORANE PA WR FF CO / 145cm" },
  { date: "28-Mar-25", invoice: "HKDA-0151/25", season: "AW25",         po: "DW4243IM04",     sty: "332496",         model: "8645272", fabric: "Reinforcement",   item: "reinforcement fabric",          itemCode: "1860326", color: "DKT-N07A BLACK",         rcvdQty: 5124,  rcvdRoll: 30, issueYds: 5124,  issueRoll: 30, rack: "G-W-8",  supplier: "Taihua", origin: "China", desc: "REINF MORANE PA WR FF CO / 145cm" },
  { date: "26-Oct-24", invoice: "46751",        season: "AW24 TO AW25", po: "DW3797IM04",     sty: "310632",         model: "",        fabric: "LINING",          item: "lining",                         itemCode: "2855868", color: "2855868-MC01307-",       rcvdQty: 3558,  rcvdRoll: 18, issueYds: 2121,  issueRoll: 11, rack: "G-R-25", supplier: "NICE",   origin: "BD",    desc: "" },
  { date: "3-Jun-24",  invoice: "HKDA-0301/24", season: "AW24 TO AW25", po: "DW3704IM04",     sty: "310632",         model: "8562644", fabric: "main fabric",     item: "fabric",                         itemCode: "2994576", color: "2994576-DKT-F16A BLUE",  rcvdQty: 80,    rcvdRoll: 1,  issueYds: 0,     issueRoll: 0,  rack: "G-X-19", supplier: "Taihua", origin: "China", desc: "REINFORC MORANE PA WR CO BB / 150cm" },
  { date: "13-Aug-24", invoice: "998",          season: "AW24 TO AW25", po: "REPLACE QTY",    sty: "310632",         model: "AIR RCVD",fabric: "main fabric",     item: "fabric",                         itemCode: "2994576", color: "2994576-DKT-F16A BLUE",  rcvdQty: 1147,  rcvdRoll: 11, issueYds: 0,     issueRoll: 0,  rack: "G-J-23", supplier: "Taihua", origin: "China", desc: "REINFORC MORANE PA WR CO BB / 150cm" },
  { date: "18-Jul-24", invoice: "HKDA-0413/24", season: "AW24 TO AW25", po: "DW3871IM04",     sty: "349264/349249",  model: "8827800", fabric: "Lining",          item: "Lining",                         itemCode: "4137688", color: "MC02848-L02B- L02B",     rcvdQty: 11824, rcvdRoll: 41, issueYds: 11578, issueRoll: 39, rack: "G-W-7",  supplier: "Sanli",  origin: "China", desc: "" },
  { date: "24-Jul-24", invoice: "HKDA-0452/24", season: "AW24 TO AW25", po: "DW3824IM04",     sty: "349249",         model: "8872167", fabric: "MAIN FABRIC",     item: "COMPO 5",                        itemCode: "4540855", color: "DKT-L02A BEIGE",         rcvdQty: 360,   rcvdRoll: 5,  issueYds: 274,   issueRoll: 4,  rack: "L-40",   supplier: "DEJUN",  origin: "CHINA", desc: "" },
  { date: "18-Jul-24", invoice: "HKDA-0413/24", season: "AW24 TO AW25", po: "DW3871IM04",     sty: "349249",         model: "8872167", fabric: "Main fabric",     item: "COMPO 1",                        itemCode: "4858695", color: "PAT19175-DUBLIN F10C",   rcvdQty: 7812,  rcvdRoll: 63, issueYds: 7246,  issueRoll: 57, rack: "G-J-23", supplier: "Sanli",  origin: "CHINA", desc: "ACRYL RPET FF CO TRANS A PT / 147 CM" },
  { date: "12-Oct-25", invoice: "HKDA-0660/25", season: "AW25",         po: "",               sty: "353081",         model: "8942345", fabric: "Main fabric",     item: "COMPO B",                        itemCode: "2780607", color: "DKT-A07A ORANGE",        rcvdQty: 110,   rcvdRoll: 1,  issueYds: 0,     issueRoll: 0,  rack: "G-X-19", supplier: "SANLI",  origin: "CHINA", desc: "OKOONA RPET FF CO BR TRANS A BB / 147 CM" },
  { date: "22-Jul-25", invoice: "HKDA-0458/25", season: "AW25",         po: "DW4595IM04",     sty: "325663",         model: "8587953", fabric: "main fabric",     item: "main fabric",                    itemCode: "2681702", color: "DKT-F16A BLUE",          rcvdQty: 270,   rcvdRoll: 2,  issueYds: 270,   issueRoll: 2,  rack: "G-F-3",  supplier: "SANLI",  origin: "China", desc: "OKOONA RPET FF CO BR TRANS A BB / 147 CM" },
  { date: "14-Dec-23", invoice: "HKDA-0616/23", season: "SS24 TO SS25", po: "DW3511IM04",     sty: "332661",         model: "8669147", fabric: "Main fabric",     item: "Main Fabric",                    itemCode: "2659740", color: "PAT03516-SQUAREBLACK",   rcvdQty: 3026,  rcvdRoll: 25, issueYds: 2244,  issueRoll: 18, rack: "G-H-10", supplier: "THT",    origin: "Vietnam", desc: "" },
  { date: "28-Nov-24", invoice: "HKDA-0803/24", season: "SS25",         po: "DW4085IM04",     sty: "332661",         model: "8669147", fabric: "Main Fabric",     item: "Main Fabric",                    itemCode: "2659740", color: "PAT03516-SQUAREBLACK",   rcvdQty: 1583,  rcvdRoll: 15, issueYds: 0,     issueRoll: 0,  rack: "G-H-10", supplier: "THT",    origin: "Vietnam", desc: "" },
  { date: "17-Jun-25", invoice: "HKDA-0344/25", season: "AW25",         po: "DW4426IM04 RE",  sty: "365466",         model: "8966296", fabric: "Lining",          item: "Pocket fabric",                  itemCode: "2735981", color: "DKT-G17C BLUE",          rcvdQty: 531,   rcvdRoll: 4,  issueYds: 0,     issueRoll: 0,  rack: "F-46",   supplier: "TEXWELL", origin: "China", desc: "CATS MM RPET / 152 CM" },
  { date: "1-Dec-25",  invoice: "B2",           season: "AW25",         po: "",               sty: "365466",         model: "",        fabric: "Lining",          item: "Pocket fabric",                  itemCode: "2735981", color: "DKT-G17C BLUE",          rcvdQty: 230,   rcvdRoll: 2,  issueYds: 0,     issueRoll: 0,  rack: "F-46",   supplier: "TEXWELL", origin: "China", desc: "CATS MM RPET / 152 CM" },
  { date: "17-Jun-25", invoice: "HKDA-0344/25", season: "AW25",         po: "DW4426IM04 RE",  sty: "365466",         model: "8966296", fabric: "Lining",          item: "Pocket fabric",                  itemCode: "2735981", color: "DKT-G17C BLUE",          rcvdQty: 1975,  rcvdRoll: 9,  issueYds: 1975,  issueRoll: 9,  rack: "QA",     supplier: "TEXWELL", origin: "China", desc: "CATS MM RPET / 152 CM" },
  { date: "17-Jun-25", invoice: "HKDA-0344/25", season: "AW25",         po: "DW4426IM04 RE",  sty: "365466",         model: "8966296", fabric: "Lining",          item: "Pocket fabric",                  itemCode: "2735981", color: "DKT-G17C BLUE",          rcvdQty: 1984,  rcvdRoll: 11, issueYds: 1984,  issueRoll: 11, rack: "K-20",   supplier: "TEXWELL", origin: "China", desc: "CATS MM RPET / 152 CM" },
  { date: "19-Jun-25", invoice: "HKDA-0372/25", season: "AW25",         po: "DW4559IM04",     sty: "325663",         model: "8587953", fabric: "Main fabric",     item: "yoke and reinforcement fabric",  itemCode: "2994576", color: "DKT-F16A BLUE",          rcvdQty: 303,   rcvdRoll: 3,  issueYds: 180,   issueRoll: 1,  rack: "G-X-19", supplier: "TAIHUA", origin: "China", desc: "REINF MORANE PA FF CO BB / 150 cm" },
  { date: "8-Dec-24",  invoice: "HKDA-0820/24", season: "SS25 to AW25", po: "DW4160IM04",     sty: "307368",         model: "8544274", fabric: "MAIN FABRIC",     item: "MAIN FABRIC",                    itemCode: "2742965", color: "DKT-G19B BLUE",          rcvdQty: 22395, rcvdRoll: 111, issueYds: 17733, issueRoll: 89, rack: "G-U-4",  supplier: "Suntion", origin: "China", desc: "P190T PES DD FF CO BR TRANS A / 148 CM" },
  { date: "17-Jul-25", invoice: "HKDA-0457/25", season: "AW25",         po: "DW4559IM04",     sty: "353081",         model: "8942345", fabric: "Main fabric",     item: "COMPO A",                        itemCode: "4137847", color: "DKT-A07A ORANGE",        rcvdQty: 4713,  rcvdRoll: 28, issueYds: 4713,  issueRoll: 28, rack: "G-J-17", supplier: "TAIHUA", origin: "CHINA", desc: "VIRGA RPET FF CO BR TR A BB / 145 CM" },
  { date: "17-Jun-25", invoice: "HKDA-0344/25", season: "AW25",         po: "DW4561IM04-3",   sty: "349264",         model: "8827800", fabric: "Lining",          item: "Brushed lining - DDY",           itemCode: "2783560", color: "DKT-L02A BEIGE",         rcvdQty: 340.1, rcvdRoll: 2,  issueYds: 230,   issueRoll: 1,  rack: "F-44",   supplier: "Texwell", origin: "China", desc: "BASIC LINING RPET BR / 152cm" },
  { date: "28-Mar-25", invoice: "HKDA-0151/25", season: "AW25",         po: "DW4401IM04",     sty: "312531/312478",  model: "8573837", fabric: "Main Fabric",     item: "Outer fabric",                   itemCode: "2843746", color: "DKT-N07A BLACK",         rcvdQty: 17458, rcvdRoll: 75, issueYds: 17458, issueRoll: 75, rack: "G-J-26", supplier: "Taihua", origin: "China", desc: "GLAZE PA DD WRFF / 144 CM" },
  { date: "31-Jul-25", invoice: "HKDA-0509/25", season: "AW25",         po: "DW4692IM04",     sty: "312531/312478",  model: "8573837", fabric: "Main fabric",     item: "Outer fabric",                   itemCode: "2843746", color: "DKT-N07A BLACK",         rcvdQty: 6446,  rcvdRoll: 31, issueYds: 1513,  issueRoll: 5,  rack: "G-W-13", supplier: "Suntion", origin: "China", desc: "GLAZE PA DD WRFF / 144 CM" },
];

const DEMO_BUYER = "Decathlon - Woven";
const DEMO_STYLE_STY = "DEMO-STYLE";   // seedDashboardDemo.js's placeholder cutting-requisition style;
                                        // real per-row STY NO/MODEL are used below instead where available.
const FLOOR = "A-2"; // no floor column in the sheet -- picking the same default seedDashboardDemo.js used.
                      // Tell me the real floor per row/buyer if this needs to vary.

async function seedRow(row, index) {
  const label = `[${index + 1}/${ROWS.length}] ${row.itemCode} / ${row.color} (${row.invoice})`;
  console.log(`\n--- ${label} ---`);

  // 1. Receive
  const receive = await post("/material-receive", {
    date: parseSheetDate(row.date),
    fromType: "Cina",
    warehouse: "K-2", // no warehouse column in the sheet -- same placeholder seedDashboardDemo.js used.
                       // Tell me the real warehouse per row if this needs to vary.
    buyer: DEMO_BUYER,
    supplier: row.supplier,
    season: row.season,
    po: row.po,
    item: row.item,
    invoiceNo: row.invoice,
    styles: [{ style: row.sty, model: row.model }],
    items: [
      {
        itemCodePdm: row.itemCode,
        color: row.color,
        fabricDetails: row.desc || row.fabric,
        rollQty: row.rcvdRoll,
        yds: row.rcvdQty,
      },
    ],
  });
  const item = receive.items[0];
  console.log(`  received: ${row.rcvdRoll} rolls / ${row.rcvdQty} yds -> itemId ${item.id}`);

  // 2. Inspect -- no reject data on the sheet, so this assumes a full pass.
  // If any of these rows actually had rejects, tell me the real passed
  // amounts and I'll wire in a rejectedRoll/rejectedYds per row instead.
  await post(`/material-inspection/${item.id}`, {
    passedRoll: row.rcvdRoll,
    passedYds: row.rcvdQty,
    note: `Backfilled from historical rack card (${row.invoice})`,
  });
  console.log(`  inspected: full pass`);

  // 3. Rack the full received amount at the sheet's real RACK NO.
  const assignment = await post(`/location-assignment/${item.id}`, {
    location: row.rack,
    rollQty: row.rcvdRoll,
    yds: row.rcvdQty,
  });
  console.log(`  racked at ${row.rack}: ${row.rcvdRoll} rolls / ${row.rcvdQty} yds`);
  console.log(`  location-assignment raw response:`, JSON.stringify(assignment));

  // Prefer the allocationId the assignment call just handed back over a
  // fresh GET lookup -- a GET-by-itemCodePdm/location lookup is ambiguous
  // whenever this same (itemCodePdm, location) pair already existed in the
  // system before this script ran (which is likely here, since this looks
  // like a real backend with real historical rows already loaded, not an
  // empty demo DB). Grabbing the id straight from the response we just
  // received has zero ambiguity.
  //
  // TODO once you confirm the real field name from the printed response
  // above: replace this guess-chain with the single correct key.
  const assignedAllocationId =
    assignment.id ?? assignment.allocationId ?? assignment.itemId ?? assignment.rackId ?? null;
  if (assignedAllocationId == null) {
    console.warn(
      `  ! could not find an allocation id in the location-assignment response -- falling back to the (ambiguous) GET lookup. Paste the response above back to me so I can fix this properly.`
    );
  }

  // 4. Issue back out the sheet's ISSUE ROLL/YDS, if any, leaving INHAND behind.
  if (row.issueYds > 0 || row.issueRoll > 0) {
    const req = await post("/cutting-requisition", {
      date: parseSheetDate(row.date),
      buyer: DEMO_BUYER,
      floor: FLOOR,
      season: row.season,
      style: row.sty || DEMO_STYLE_STY,
      model: row.model,
      items: [
        {
          itemCodePdm: row.itemCode,
          color: row.color,
          pcs: 1,
          percentage: 0,
          consumption: row.issueYds, // pcs(1) * consumption == requestedYds == row.issueYds -- see ASSUMPTIONS FLAGGED above
        },
      ],
    });
    const allocationId =
      assignedAllocationId != null
        ? assignedAllocationId
        : await getAllocationId(row.itemCode, row.rack);
    await post(`/cutting-issue/${req.items[0].id}`, {
      allocationId,
      rollQty: row.issueRoll,
      yds: row.issueYds,
    });
    console.log(`  issued: ${row.issueRoll} rolls / ${row.issueYds} yds -> inhand should read ${row.rcvdRoll - row.issueRoll} rolls / ${(row.rcvdQty - row.issueYds).toFixed(2)} yds`);
  } else {
    console.log(`  no issue on this row -- inhand stays at ${row.rcvdRoll} rolls / ${row.rcvdQty} yds`);
  }
}

async function main() {
  console.log(`Seeding ${ROWS.length} real history rows against ${BASE_URL}...`);
  for (let i = 0; i < ROWS.length; i++) {
    await seedRow(ROWS[i], i);
  }
  console.log(`\nDone. All ${ROWS.length} rows seeded.`);
}

main().catch((err) => {
  console.error("\n✖ Seed script failed:", err.message);
  console.error("(Everything before this point in the log already succeeded -- re-running from scratch will duplicate those rows, since material-receive has no idempotency key here.)");
  process.exit(1);
});