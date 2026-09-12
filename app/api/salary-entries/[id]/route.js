// app/api/salary-entries/[id]/route.js
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/services/mongo";
import { salaryEntryModel } from "@/models/salary-entry-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAuthHeaders(req) {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") || "";
  return { userId, userRole };
}

function canModify(entry, userId, userRole) {
  if (!userId) return false;
  const isOwner = String(entry.createdBy) === String(userId);
  const isAdmin = ["Admin", "SuperAdmin"].includes(userRole);
  return isOwner || isAdmin;
}

function normalizeMongoError(err) {
  if (err?.code === 11000) {
    return { status: 409, message: "Duplicate: same Factory + YearMonth + Floor + Line already exists." };
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

// ✅ Next.js 15+ params can be async → await context.params
async function getIdFromContext(context) {
  const p = await context.params; // params is Promise in your setup
  return p?.id;
}

export async function PUT(request, context) {
  try {
    await dbConnect();

    const { userId, userRole } = getAuthHeaders(request);
    if (!userId) return NextResponse.json({ message: "Missing user id" }, { status: 401 });
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ message: "Invalid user id", error: userId }, { status: 400 });
    }

    const id = await getIdFromContext(context);
    if (!id) {
      return NextResponse.json({ message: "Missing entry id param" }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ message: "Invalid entry id", error: id }, { status: 400 });
    }

    const entry = await salaryEntryModel.findById(id);
    if (!entry) return NextResponse.json({ message: "Not found" }, { status: 404 });

    if (!canModify(entry, userId, userRole)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { factory, yearMonth, floor, line, salaryDirect, salaryIndirect } = body;

    entry.factory = factory;
    entry.yearMonth = yearMonth;
    entry.floor = floor;
    entry.line = Number(line);
    entry.salaryDirect = Number(salaryDirect);
    entry.salaryIndirect = Number(salaryIndirect);

    await entry.save();

    return NextResponse.json({ data: entry }, { status: 200 });
  } catch (err) {
    const norm = normalizeMongoError(err);
    return NextResponse.json(
      { message: "Failed to update entry", error: norm.error || String(err) },
      { status: norm.status || 500 }
    );
  }
}

export async function DELETE(request, context) {
  try {
    await dbConnect();

    const { userId, userRole } = getAuthHeaders(request);
    if (!userId) return NextResponse.json({ message: "Missing user id" }, { status: 401 });
    if (!mongoose.isValidObjectId(userId)) {
      return NextResponse.json({ message: "Invalid user id", error: userId }, { status: 400 });
    }

    const id = await getIdFromContext(context);
    if (!id) {
      return NextResponse.json({ message: "Missing entry id param" }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ message: "Invalid entry id", error: id }, { status: 400 });
    }

    const entry = await salaryEntryModel.findById(id);
    if (!entry) return NextResponse.json({ message: "Not found" }, { status: 404 });

    if (!canModify(entry, userId, userRole)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await salaryEntryModel.findByIdAndDelete(id);
    return NextResponse.json({ message: "Deleted" }, { status: 200 });
  } catch (err) {
    const norm = normalizeMongoError(err);
    return NextResponse.json(
      { message: "Failed to delete entry", error: norm.error || String(err) },
      { status: norm.status || 500 }
    );
  }
}
