// seedDashboardDemo.js
//
// Seeds sample data so the dashboard's "Stock Batches · Status Breakdown"
// and "Cutting Requisitions · Fulfillment Status" pie charts (both
// date-filtered to TODAY) have something to show for all 5 / 3 statuses.
//
// IMPORTANT: designed to leave "Available Roll" and "Available Roll &
// Yds" untouched. Those two panels sum every rack allocation's
// availableRoll/Yds, all-time. A batch can only reach "approved" or
// "partial" status if it has a real rack row -- there's no way around
// that. So for those two statuses, this script racks the stock and then
// immediately issues the SAME amount back out again (via the cutting
// requisitions it creates anyway), draining the rack back to 0/0. Net
// effect on the two "Available" bar charts: zero. The batch's `status`
// field is untouched by issuing, so it still shows correctly in the
// Status Breakdown pie.
//
// Buyer is set to "Decathlon - Woven" -- since that's a real existing
// buyer, the demo racks merge into its existing bar/entry in the Buyer
// and Item Code charts instead of creating a new one, and net out to the
// same value as before this script ran (because the racks end at 0/0).
//
// Usage:
//   API_URL=http://192.169.8.98:5000 node seedDashboardDemo.js
// (defaults to http://192.169.8.98:5000 if API_URL isn't set)
//
// Requires Node 18+ (uses global fetch).
//
// ASSUMPTION FLAGGED: I don't have the source for
// POST /location-assignment/:itemId, so its request body below
// ({ location, rollQty, yds }) is inferred from the column names used
// everywhere else in your schema/controllers. If that step throws, the
// error message printed will show the real body shape it expects --
// paste that back to me and I'll fix the script.

const BASE_URL = process.env.API_URL || "http://192.169.8.98:5000";
const TODAY = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
const DEMO_BUYER = "Decathlon - Woven"; // change this if you want a different name

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

function baseReceive(overrides) {
  return {
    date: TODAY,
    fromType: "Import",
    warehouse: "K-2",
    buyer: DEMO_BUYER,
    supplier: "Demo Supplier",
    season: "SS26",
    po: "DEMO-PO-01",
    item: "Demo Item",
    styles: [{ style: "DEMO-STYLE", model: "DEMO-MODEL" }],
    ...overrides,
  };
}

// Looks up an allocation's id (== "itemId" in /material-stock's response,
// per its own comments) for a given Item Code/PDM.
async function getAllocationId(itemCodePdm) {
  const json = await get(`/material-stock?itemCodePdm=${encodeURIComponent(itemCodePdm)}`);
  const row = (json.rows || []).find((r) => r.itemCodePdm === itemCodePdm);
  if (!row) throw new Error(`No rack allocation found for ${itemCodePdm} -- was it racked yet?`);
  return row.itemId; // allocationId
}

async function main() {
  console.log(`Seeding dashboard demo data against ${BASE_URL}, dated ${TODAY}...\n`);

  // ================= Stock batch statuses =================

  // A) approved -- fully inspected + fully racked, then fully issued back
  //    out so the rack ends at 0/0 (status stays "approved" -- that field
  //    is set at assignment time and untouched by issuing).
  const receiveA = await post("/material-receive", baseReceive({
    invoiceNo: `DEMO-A-${Date.now()}`,
    items: [{ itemCodePdm: "DASH-TEST-01", color: "Black", fabricDetails: "Demo fabric A", rollQty: 100, yds: 1000 }],
  }));
  const itemA = receiveA.items[0];
  await post(`/material-inspection/${itemA.id}`, { passedRoll: 100, passedYds: 1000, note: "Demo full pass" });
  await post(`/location-assignment/${itemA.id}`, { location: "DEMO-RACK-1", rollQty: 100, yds: 1000 });
  console.log("✔ approved batch:", itemA.id);

  // B) partial -- fully inspected, only PART racked (racked portion is
  //    then fully issued back out too, so the rack ends at 0/0 -- but
  //    the batch's unassignedRoll/Yds still has leftovers, so status
  //    correctly stays "partial").
  const receiveB = await post("/material-receive", baseReceive({
    invoiceNo: `DEMO-B-${Date.now()}`,
    items: [{ itemCodePdm: "DASH-TEST-02", color: "Navy", fabricDetails: "Demo fabric B", rollQty: 100, yds: 1000 }],
  }));
  const itemB = receiveB.items[0];
  await post(`/material-inspection/${itemB.id}`, { passedRoll: 100, passedYds: 1000, note: "Demo full pass" });
  await post(`/location-assignment/${itemB.id}`, { location: "DEMO-RACK-2", rollQty: 40, yds: 400 });
  console.log("✔ partial batch:", itemB.id);

  // C) pending -- inspected, nothing racked at all -- no stock impact.
  const receiveC = await post("/material-receive", baseReceive({
    invoiceNo: `DEMO-C-${Date.now()}`,
    items: [{ itemCodePdm: "DASH-TEST-03", color: "Grey", fabricDetails: "Demo fabric C", rollQty: 50, yds: 500 }],
  }));
  const itemC = receiveC.items[0];
  await post(`/material-inspection/${itemC.id}`, { passedRoll: 50, passedYds: 500, note: "Demo full pass" });
  console.log("✔ pending batch:", itemC.id);

  // D) pending_inspection -- just received, untouched -- no stock impact.
  const receiveD = await post("/material-receive", baseReceive({
    invoiceNo: `DEMO-D-${Date.now()}`,
    items: [{ itemCodePdm: "DASH-TEST-04", color: "White", fabricDetails: "Demo fabric D", rollQty: 50, yds: 500 }],
  }));
  console.log("✔ pending_inspection batch:", receiveD.items[0].id);

  // E) rejected -- inspected, 0 passed -- never gets a rack row.
  const receiveE = await post("/material-receive", baseReceive({
    invoiceNo: `DEMO-E-${Date.now()}`,
    items: [{ itemCodePdm: "DASH-TEST-05", color: "Red", fabricDetails: "Demo fabric E", rollQty: 30, yds: 300 }],
  }));
  const itemE = receiveE.items[0];
  await post(`/material-inspection/${itemE.id}`, { passedRoll: 0, passedYds: 0, note: "Demo full reject" });
  console.log("✔ rejected batch:", itemE.id);

  // ================= Cutting requisition statuses =================
  // Also doubles as the "issue it all back out" step for A and B above.

  // 1) fulfilled -- issue rack A's full 100/1000 (== requestedYds), fully
  //    draining it back to 0/0.
  const req1 = await post("/cutting-requisition", {
    date: TODAY, buyer: DEMO_BUYER, floor: "A-2", season: "SS26", style: "DEMO-STYLE", model: "DEMO-MODEL",
    items: [{ itemCodePdm: "DASH-TEST-01", color: "Black", pcs: 100, percentage: 0, consumption: 10 }], // requestedYds = 1000
  });
  const allocA = await getAllocationId("DASH-TEST-01");
  await post(`/cutting-issue/${req1.items[0].id}`, { allocationId: allocA, rollQty: 100, yds: 1000 });
  console.log("✔ fulfilled requisition:", req1.id);

  // 2) partial -- issue rack B's full 40/400, but requestedYds is set
  //    higher (500) so status stays "partial" even though the rack itself
  //    is fully drained back to 0/0.
  const req2 = await post("/cutting-requisition", {
    date: TODAY, buyer: DEMO_BUYER, floor: "A-2", season: "SS26", style: "DEMO-STYLE", model: "DEMO-MODEL",
    items: [{ itemCodePdm: "DASH-TEST-02", color: "Navy", pcs: 100, percentage: 0, consumption: 5 }], // requestedYds = 500
  });
  const allocB = await getAllocationId("DASH-TEST-02");
  await post(`/cutting-issue/${req2.items[0].id}`, { allocationId: allocB, rollQty: 40, yds: 400 });
  console.log("✔ partial requisition:", req2.id);

  // 3) pending -- no issue at all, unrelated item code, never touches a
  //    rack -- no stock impact.
  const req3 = await post("/cutting-requisition", {
    date: TODAY, buyer: DEMO_BUYER, floor: "A-2", season: "SS26", style: "DEMO-STYLE", model: "DEMO-MODEL",
    items: [{ itemCodePdm: "DASH-TEST-06", color: "Green", pcs: 50, percentage: 0, consumption: 2 }],
  });
  console.log("✔ pending requisition:", req3.id);

  console.log(`\nDone. Refresh the dashboard with date = ${TODAY} to see it.`);
  console.log(`(Racks DEMO-RACK-1 / DEMO-RACK-2 are now at 0/0 -- Available Roll totals unaffected.)`);
}

main().catch((err) => {
  console.error("\n✖ Seed script failed:", err.message);
  process.exit(1);
});

// ---------------------------------------------------------------------
// CLEANUP NOTE: material-receive DELETE and cutting-requisition DELETE
// both refuse once a batch has rack stock ("partial"/"approved") or an
// item has been issued against -- which every record this script creates
// hits on purpose. To fully remove this demo data later you'll need a
// direct DB delete (cascades will clean up child rows via the FKs
// already defined in schema.mysql.js) rather than the REST API. Ask me
// if you want a script for that too.
// ---------------------------------------------------------------------