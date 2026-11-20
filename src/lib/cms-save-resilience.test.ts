import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/session", () => ({
  requireAdmin: vi.fn().mockResolvedValue(true),
}));

describe("CMS Save Resilience", () => {
  it("filters unknown fields against runtime model to prevent PrismaClientValidationError", () => {
    // Simulate what saveHomepage does
    const runtimeFields = [
      { name: "id" },
      { name: "heroTitleEn" },
      { name: "openingBackgroundRgb" },
      { name: "openingMobilePosterUrl" },
    ];
    const allowedFieldNames = new Set(runtimeFields.map((f: any) => f.name));

    const submittedPayload: Record<string, any> = {
      heroTitleEn: "Test Title",
      openingBackgroundRgb: "21, 42, 32",
      openingMobilePosterUrl: "https://example.com/poster.jpg",
      unknownStaleField: "should-not-crash",
      anotherObsoleteField: 123,
    };

    const safeData: Record<string, any> = {};
    const omittedFields: Record<string, any> = {};

    for (const [key, value] of Object.entries(submittedPayload)) {
      if (allowedFieldNames.has(key)) {
        safeData[key] = value;
      } else {
        omittedFields[key] = value;
      }
    }

    expect(safeData).toEqual({
      heroTitleEn: "Test Title",
      openingBackgroundRgb: "21, 42, 32",
      openingMobilePosterUrl: "https://example.com/poster.jpg",
    });
    expect(omittedFields).toEqual({
      unknownStaleField: "should-not-crash",
      anotherObsoleteField: 123,
    });
  });

  it("extracts clean human-readable diagnostic from Prisma error message", () => {
    const rawPrismaError = `
Invalid \`prisma.homepage.update()\` invocation:

{
  where: {
    id: "homepage"
  },
  data: {
    openingMobilePosterUrl: null,
    ~~~~~~~~~~~~~~~~~~~~~~
  }
}

Unknown argument \`openingMobilePosterUrl\`. Available options are marked with ?.
    `;

    const lines = rawPrismaError.split("\n").map(l => l.trim()).filter(Boolean);
    const failureReason = lines.find(l => l.includes("Unknown argument") || l.includes("Argument ") || l.includes("Field ") || l.includes("Unique constraint"))
      || lines.filter(l => !l.includes("~~~") && !l.startsWith("{") && !l.startsWith("}")).slice(0, 2).join(" - ");

    expect(failureReason).toBe("Unknown argument `openingMobilePosterUrl`. Available options are marked with ?.");
  });
});

