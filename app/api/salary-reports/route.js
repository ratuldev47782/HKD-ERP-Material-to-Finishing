//app\api\salary-reports\route.js
import { NextResponse } from "next/server";
import { dbConnect } from "@/services/mongo";
import { salaryEntryModel } from "@/models/salary-entry-model";

export async function GET(request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);

    const view = searchParams.get("view") || "line"; // line | floor | month | year
    const factory = searchParams.get("factory") || "";

    // line/floor filters
    const yearMonth = searchParams.get("yearMonth") || "";
    const floor = searchParams.get("floor") || "";

    // month/year range filters
    let startYM = searchParams.get("startYM") || "";
    let endYM = searchParams.get("endYM") || "";
    if (startYM && endYM && startYM > endYM) {
      const tmp = startYM;
      startYM = endYM;
      endYM = tmp;
    }

    const match = {};
    if (factory) match.factory = factory;

    // ✅ Line/Floor: exact yearMonth + floor
    if (view === "line" || view === "floor") {
      if (yearMonth) match.yearMonth = yearMonth;
      if (floor) match.floor = floor;
    }

    // ✅ Month/Year: date range
    if (view === "month" || view === "year") {
      const ymRange = {};
      if (startYM) ymRange.$gte = startYM;
      if (endYM) ymRange.$lte = endYM;
      if (Object.keys(ymRange).length) match.yearMonth = ymRange;
    }

    // Shared stages: attach USD rate by yearMonth and compute USD amounts
    const withUsdStages = [
      {
        $lookup: {
          from: "usd_rates",
          localField: "yearMonth",
          foreignField: "yearMonth",
          as: "rateDoc",
        },
      },
      {
        $addFields: {
          usdRate: { $ifNull: [{ $arrayElemAt: ["$rateDoc.rate", 0] }, null] },
        },
      },
      {
        $addFields: {
          salaryDirectUSD: {
            $cond: [
              { $gt: ["$usdRate", 0] },
              { $divide: ["$salaryDirect", "$usdRate"] },
              null,
            ],
          },
          salaryIndirectUSD: {
            $cond: [
              { $gt: ["$usdRate", 0] },
              { $divide: ["$salaryIndirect", "$usdRate"] },
              null,
            ],
          },
          salaryTotalUSD: {
            $cond: [
              { $gt: ["$usdRate", 0] },
              { $divide: ["$salaryTotal", "$usdRate"] },
              null,
            ],
          },
          missingRate: {
            $cond: [{ $gt: ["$usdRate", 0] }, 0, 1],
          },
        },
      },
      { $project: { rateDoc: 0 } },
    ];

    // ---------- pipelines ----------
    if (view === "line") {
      const [result] = await salaryEntryModel.aggregate([
        { $match: match },
        ...withUsdStages,
        {
          $facet: {
            byFloorLine: [
              {
                $group: {
                  _id: { floor: "$floor", line: "$line" },
                  salaryDirect: { $sum: "$salaryDirect" },
                  salaryIndirect: { $sum: "$salaryIndirect" },
                  salaryTotal: { $sum: "$salaryTotal" },
                  salaryDirectUSD: { $sum: "$salaryDirectUSD" },
                  salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
                  salaryTotalUSD: { $sum: "$salaryTotalUSD" },
                  missingRateCount: { $sum: "$missingRate" },
                },
              },
              {
                $project: {
                  _id: 0,
                  floor: "$_id.floor",
                  line: "$_id.line",
                  salaryDirect: 1,
                  salaryIndirect: 1,
                  salaryTotal: 1,
                  salaryDirectUSD: 1,
                  salaryIndirectUSD: 1,
                  salaryTotalUSD: 1,
                  missingRateCount: 1,
                },
              },
              { $sort: { floor: 1, line: 1 } },
            ],
            floorTotals: [
              {
                $group: {
                  _id: "$floor",
                  salaryDirect: { $sum: "$salaryDirect" },
                  salaryIndirect: { $sum: "$salaryIndirect" },
                  salaryTotal: { $sum: "$salaryTotal" },
                  salaryDirectUSD: { $sum: "$salaryDirectUSD" },
                  salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
                  salaryTotalUSD: { $sum: "$salaryTotalUSD" },
                  missingRateCount: { $sum: "$missingRate" },
                },
              },
              {
                $project: {
                  _id: 0,
                  floor: "$_id",
                  salaryDirect: 1,
                  salaryIndirect: 1,
                  salaryTotal: 1,
                  salaryDirectUSD: 1,
                  salaryIndirectUSD: 1,
                  salaryTotalUSD: 1,
                  missingRateCount: 1,
                },
              },
              { $sort: { floor: 1 } },
            ],
            grand: [
              {
                $group: {
                  _id: null,
                  salaryDirect: { $sum: "$salaryDirect" },
                  salaryIndirect: { $sum: "$salaryIndirect" },
                  salaryTotal: { $sum: "$salaryTotal" },
                  salaryDirectUSD: { $sum: "$salaryDirectUSD" },
                  salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
                  salaryTotalUSD: { $sum: "$salaryTotalUSD" },
                  missingRateCount: { $sum: "$missingRate" },
                },
              },
              {
                $project: {
                  _id: 0,
                  salaryDirect: 1,
                  salaryIndirect: 1,
                  salaryTotal: 1,
                  salaryDirectUSD: 1,
                  salaryIndirectUSD: 1,
                  salaryTotalUSD: 1,
                  missingRateCount: 1,
                },
              },
            ],
          },
        },
      ]);

      const byFloorLine = result?.byFloorLine || [];
      const floorTotals = result?.floorTotals || [];
      const grandTotals = result?.grand?.[0] || {
        salaryDirect: 0,
        salaryIndirect: 0,
        salaryTotal: 0,
        salaryDirectUSD: 0,
        salaryIndirectUSD: 0,
        salaryTotalUSD: 0,
        missingRateCount: 0,
      };

      // group rows per floor
      const map = new Map();
      for (const r of byFloorLine) {
        if (!map.has(r.floor)) map.set(r.floor, []);
        map.get(r.floor).push(r);
      }

      const floors = Array.from(map.keys())
        .sort()
        .map((fl) => {
          const rows = (map.get(fl) || []).sort(
            (a, b) => Number(a.line) - Number(b.line)
          );
          const ft = floorTotals.find((x) => x.floor === fl) || {
            floor: fl,
            salaryDirect: 0,
            salaryIndirect: 0,
            salaryTotal: 0,
            salaryDirectUSD: 0,
            salaryIndirectUSD: 0,
            salaryTotalUSD: 0,
            missingRateCount: 0,
          };
          return { floor: fl, rows, floorTotals: ft };
        });

      return NextResponse.json({
        view: "line",
        filters: { factory, yearMonth, floor, startYM, endYM },
        data: { floors, grandTotals },
      });
    }

    if (view === "floor") {
      const rows = await salaryEntryModel.aggregate([
        { $match: match },
        ...withUsdStages,
        {
          $group: {
            _id: "$floor",
            salaryDirect: { $sum: "$salaryDirect" },
            salaryIndirect: { $sum: "$salaryIndirect" },
            salaryTotal: { $sum: "$salaryTotal" },
            salaryDirectUSD: { $sum: "$salaryDirectUSD" },
            salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
            salaryTotalUSD: { $sum: "$salaryTotalUSD" },
            missingRateCount: { $sum: "$missingRate" },
          },
        },
        {
          $project: {
            _id: 0,
            floor: "$_id",
            salaryDirect: 1,
            salaryIndirect: 1,
            salaryTotal: 1,
            salaryDirectUSD: 1,
            salaryIndirectUSD: 1,
            salaryTotalUSD: 1,
            missingRateCount: 1,
          },
        },
        { $sort: { floor: 1 } },
      ]);

      const grandTotals = rows.reduce(
        (acc, r) => ({
          salaryDirect: acc.salaryDirect + (r.salaryDirect || 0),
          salaryIndirect: acc.salaryIndirect + (r.salaryIndirect || 0),
          salaryTotal: acc.salaryTotal + (r.salaryTotal || 0),
          salaryDirectUSD: acc.salaryDirectUSD + (r.salaryDirectUSD || 0),
          salaryIndirectUSD: acc.salaryIndirectUSD + (r.salaryIndirectUSD || 0),
          salaryTotalUSD: acc.salaryTotalUSD + (r.salaryTotalUSD || 0),
          missingRateCount: acc.missingRateCount + (r.missingRateCount || 0),
        }),
        {
          salaryDirect: 0,
          salaryIndirect: 0,
          salaryTotal: 0,
          salaryDirectUSD: 0,
          salaryIndirectUSD: 0,
          salaryTotalUSD: 0,
          missingRateCount: 0,
        }
      );

      return NextResponse.json({
        view: "floor",
        filters: { factory, yearMonth, floor, startYM, endYM },
        data: { rows, grandTotals },
      });
    }

    if (view === "month") {
      const rows = await salaryEntryModel.aggregate([
        { $match: match },
        ...withUsdStages,
        {
          $group: {
            _id: "$yearMonth",
            salaryDirect: { $sum: "$salaryDirect" },
            salaryIndirect: { $sum: "$salaryIndirect" },
            salaryTotal: { $sum: "$salaryTotal" },
            salaryDirectUSD: { $sum: "$salaryDirectUSD" },
            salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
            salaryTotalUSD: { $sum: "$salaryTotalUSD" },
            missingRateCount: { $sum: "$missingRate" },
          },
        },
        {
          $project: {
            _id: 0,
            yearMonth: "$_id",
            salaryDirect: 1,
            salaryIndirect: 1,
            salaryTotal: 1,
            salaryDirectUSD: 1,
            salaryIndirectUSD: 1,
            salaryTotalUSD: 1,
            missingRateCount: 1,
          },
        },
        { $sort: { yearMonth: 1 } },
      ]);

      const grandTotals = rows.reduce(
        (acc, r) => ({
          salaryDirect: acc.salaryDirect + (r.salaryDirect || 0),
          salaryIndirect: acc.salaryIndirect + (r.salaryIndirect || 0),
          salaryTotal: acc.salaryTotal + (r.salaryTotal || 0),
          salaryDirectUSD: acc.salaryDirectUSD + (r.salaryDirectUSD || 0),
          salaryIndirectUSD: acc.salaryIndirectUSD + (r.salaryIndirectUSD || 0),
          salaryTotalUSD: acc.salaryTotalUSD + (r.salaryTotalUSD || 0),
          missingRateCount: acc.missingRateCount + (r.missingRateCount || 0),
        }),
        {
          salaryDirect: 0,
          salaryIndirect: 0,
          salaryTotal: 0,
          salaryDirectUSD: 0,
          salaryIndirectUSD: 0,
          salaryTotalUSD: 0,
          missingRateCount: 0,
        }
      );

      return NextResponse.json({
        view: "month",
        filters: { factory, startYM, endYM },
        data: { rows, grandTotals },
      });
    }

    if (view === "year") {
      const rows = await salaryEntryModel.aggregate([
        { $match: match },
        ...withUsdStages,
        { $addFields: { year: { $substrBytes: ["$yearMonth", 0, 4] } } },
        {
          $group: {
            _id: "$year",
            salaryDirect: { $sum: "$salaryDirect" },
            salaryIndirect: { $sum: "$salaryIndirect" },
            salaryTotal: { $sum: "$salaryTotal" },
            salaryDirectUSD: { $sum: "$salaryDirectUSD" },
            salaryIndirectUSD: { $sum: "$salaryIndirectUSD" },
            salaryTotalUSD: { $sum: "$salaryTotalUSD" },
            missingRateCount: { $sum: "$missingRate" },
          },
        },
        {
          $project: {
            _id: 0,
            year: "$_id",
            salaryDirect: 1,
            salaryIndirect: 1,
            salaryTotal: 1,
            salaryDirectUSD: 1,
            salaryIndirectUSD: 1,
            salaryTotalUSD: 1,
            missingRateCount: 1,
          },
        },
        { $sort: { year: 1 } },
      ]);

      const grandTotals = rows.reduce(
        (acc, r) => ({
          salaryDirect: acc.salaryDirect + (r.salaryDirect || 0),
          salaryIndirect: acc.salaryIndirect + (r.salaryIndirect || 0),
          salaryTotal: acc.salaryTotal + (r.salaryTotal || 0),
          salaryDirectUSD: acc.salaryDirectUSD + (r.salaryDirectUSD || 0),
          salaryIndirectUSD: acc.salaryIndirectUSD + (r.salaryIndirectUSD || 0),
          salaryTotalUSD: acc.salaryTotalUSD + (r.salaryTotalUSD || 0),
          missingRateCount: acc.missingRateCount + (r.missingRateCount || 0),
        }),
        {
          salaryDirect: 0,
          salaryIndirect: 0,
          salaryTotal: 0,
          salaryDirectUSD: 0,
          salaryIndirectUSD: 0,
          salaryTotalUSD: 0,
          missingRateCount: 0,
        }
      );

      return NextResponse.json({
        view: "year",
        filters: { factory, startYM, endYM },
        data: { rows, grandTotals },
      });
    }

    return NextResponse.json({ error: "Invalid view." }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "Report load failed" },
      { status: 500 }
    );
  }
}
