// app/api/salary-entries/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/services/mongo";
import { salaryEntryModel } from "@/models/salary-entry-model";

export const runtime = "nodejs";          // ✅ force node runtime for mongoose
export const dynamic = "force-dynamic";

function getAuthHeaders(req) {
  const userId = req.headers.get("x-user-id");
  const userName = req.headers.get("x-user-name") || "";
  const userRole = req.headers.get("x-user-role") || "";
  return { userId, userName, userRole };
}

function badRequest(message, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status: 400 });
}

function normalizeMongoError(err) {
  // ✅ better error messages
  if (err?.code === 11000) {
    return { status: 409, message: "This month entry already exists for the same Factory + Floor + Line." };
  }
  if (err?.name === "ValidationError") {
    return {
      status: 400,
      message: "Validation error",
      error: Object.values(err.errors).map((e) => e.message).join(", "),
    };
  }
  if (err?.name === "CastError") {
    return { status: 400, message: "Invalid id format", error: err.message };
  }
  return { status: 500, message: "Failed", error: err?.message || String(err) };
}

// GET /api/salary-entries?factory=&yearMonth=&floor=&line=&mine=1
export async function GET(request) {
  try {
    await dbConnect();

    const url = new URL(request.url);
    const sp = url.searchParams;

    const factory = sp.get("factory");
    const yearMonth = sp.get("yearMonth");
    const floor = sp.get("floor");
    const line = sp.get("line");
    const mine = sp.get("mine");

    const { userId } = getAuthHeaders(request);

    const filter = {};
    if (factory) filter.factory = factory;
    if (yearMonth) filter.yearMonth = yearMonth;
    if (floor) filter.floor = floor;
    if (line) filter.line = Number(line);

    if (mine === "1") {
      if (!userId) return NextResponse.json({ message: "Missing user id" }, { status: 401 });
      if (!mongoose.isValidObjectId(userId)) {
        return badRequest("Invalid user id", { error: `userId is not a valid ObjectId: ${userId}` });
      }
      filter.createdBy = new mongoose.Types.ObjectId(userId);
    }

    const data = await salaryEntryModel
      .find(filter)
      .sort({ yearMonth: -1, factory: 1, floor: 1, line: 1 })
      .lean();

    return NextResponse.json({ data }, { status: 200 });
  } catch (err) {
    const norm = normalizeMongoError(err);
    return NextResponse.json(
      { message: "Failed to fetch entries", error: norm.error || String(err) },
      { status: norm.status || 500 }
    );
  }
}

// POST /api/salary-entries
export async function POST(request) {
  try {
    await dbConnect();

    const { userId, userName } = getAuthHeaders(request);

    if (!userId) {
      return NextResponse.json({ message: "Missing user id" }, { status: 401 });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return badRequest("Invalid user id", { error: `userId is not a valid ObjectId: ${userId}` });
    }

    const body = await request.json();
    const { factory, yearMonth, floor, line, salaryDirect, salaryIndirect } = body;

    const doc = await salaryEntryModel.create({
      factory,
      yearMonth,
      floor,
      line: Number(line),
      salaryDirect: Number(salaryDirect),
      salaryIndirect: Number(salaryIndirect),
      createdBy: new mongoose.Types.ObjectId(userId),
      createdByName: userName,
    });

    return NextResponse.json({ data: doc }, { status: 201 });
  } catch (err) {
    const norm = normalizeMongoError(err);

    if (norm.status === 409) {
      return NextResponse.json({ message: norm.message }, { status: 409 });
    }
    return NextResponse.json(
      { message: "Failed to create entry", error: norm.error || (err?.message || String(err)) },
      { status: norm.status || 500 }
    );
  }
}
