
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No image was provided." },
        { status: 400 }
      );
    }

    const extension = ALLOWED_TYPES[file.type];

    if (!extension) {
      return NextResponse.json(
        { error: "Only JPG, PNG, and WebP images are allowed." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 5 MB." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Verify the file's actual image signature.
    const isJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    const isPng =
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const isWebp =
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";

    const validImage =
      (extension === "jpg" && isJpeg) ||
      (extension === "png" && isPng) ||
      (extension === "webp" && isWebp);

    if (!validImage) {
      return NextResponse.json(
        { error: "File content is not a valid supported image." },
        { status: 400 }
      );
    }

    const filename = `${randomUUID()}.${extension}`;

    const uploadDirectory = path.join(
      process.cwd(),
      "public",
      "uploads"
    );

    await mkdir(uploadDirectory, { recursive: true });

    const filePath = path.join(uploadDirectory, filename);

    await writeFile(filePath, bytes, { flag: "wx" });

    return NextResponse.json(
      {
        imageUrl: `/uploads/${filename}`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Image upload failed:", error);

    return NextResponse.json(
      { error: "Failed to upload image." },
      { status: 500 }
    );
  }
}
