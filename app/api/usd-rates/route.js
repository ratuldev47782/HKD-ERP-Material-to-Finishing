import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/services/mongo";
import { usdRateModel } from "@/models/usd-rate-model";

function isValidYearMonth(v = "") {
  return /^\d{4}-\d{2}$/.test(String(v));
}

export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);

    const yearMonth = searchParams.get("yearMonth") || "";

    // single month fetch (most used)
    if (yearMonth) {
      if (!isValidYearMonth(yearMonth)) {
        return NextResponse.json(
          { error: "Invalid yearMonth. Use YYYY-MM (e.g. 2026-01)" },
          { status: 400 }
        );
      }

      const doc = await usdRateModel.findOne({ yearMonth }).lean();
      return NextResponse.json({ data: doc || null });
    }

    // list all (optional)
    const rows = await usdRateModel.find({}).sort({ yearMonth: -1 }).lean();
    return NextResponse.json({ data: rows });
  } catch (e) {
    return NextResponse.json(
      { error: e?.message || "USD rates load failed" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    await dbConnect();

    const body = await request.json();
    const yearMonth = String(body?.yearMonth || "").trim();
    const rateNum = Number(body?.rate);

    if (!isValidYearMonth(yearMonth)) {
      return NextResponse.json(
        { error: "Invalid yearMonth. Use YYYY-MM (e.g. 2026-01)" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(rateNum) || rateNum <= 0) {
      return NextResponse.json(
        { error: "Invalid rate. Must be a number > 0" },
        { status: 400 }
      );
    }

    const userId = request.headers.get("x-user-id") || "";
    const userName = request.headers.get("x-user-name") || "";

    const userObjId = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(userId)
      : null;

    const update = {
      $set: {
        rate: rateNum,
        updatedBy: userObjId,
        updatedByName: userName,
      },
      $setOnInsert: {
        yearMonth,
        createdBy: userObjId,
        createdByName: userName,
      },
    };

    const doc = await usdRateModel
      .findOneAndUpdate({ yearMonth }, update, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      })
      .lean();

    return NextResponse.json({ data: doc });
  } catch (e) {
    // duplicate unique index
    if (String(e?.code) === "11000") {
      return NextResponse.json(
        { error: "Rate for this month already exists. Try updating." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: e?.message || "USD rate save failed" },
      { status: 500 }
    );
  }
}
