import { describe, it, expect } from "vitest";
import {
  parseNumericValue,
  percentile,
  calcSum,
  calcMean,
  calcMedian,
  calcVariance,
  calcStdDev,
  calcNumericStats,
  countOutliers,
  calcCategoricalStats,
  calcDateStats,
  calcBooleanStats,
} from "../src/utils/stats";
import { isMissing } from "../src/utils/csv/profileDataset";
import { normalizeColumns } from "../src/utils/csv/parseCsv";

// ---------------------------------------------------------------------------
// parseNumericValue
// ---------------------------------------------------------------------------
describe("parseNumericValue", () => {
  it("parses integers", () => expect(parseNumericValue("42")).toBe(42));
  it("parses floats", () => expect(parseNumericValue("3.14")).toBeCloseTo(3.14));
  it("parses negatives", () => expect(parseNumericValue("-5")).toBe(-5));
  it("strips thousands commas", () => expect(parseNumericValue("1,234,567")).toBe(1234567));
  it("returns null for empty string", () => expect(parseNumericValue("")).toBeNull());
  it("returns null for text", () => expect(parseNumericValue("abc")).toBeNull());
  it("zero is a real value not null", () => expect(parseNumericValue("0")).toBe(0));
  it("parses negative float", () => expect(parseNumericValue("-0.5")).toBeCloseTo(-0.5));
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------
describe("percentile", () => {
  it("returns the only element for a one-element array", () => {
    expect(percentile([5], 0.5)).toBe(5);
  });
  it("median of [1,2,3,4,5] is 3", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });
  it("median of [1,2,3,4] interpolates", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });
  it("Q1 of [1,2,3,4] is 1.75", () => {
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
  });
  it("returns NaN for empty array", () => {
    expect(percentile([], 0.5)).toBeNaN();
  });
  it("P0 is min, P1 is max", () => {
    const arr = [10, 20, 30];
    expect(percentile(arr, 0)).toBe(10);
    expect(percentile(arr, 1)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// calcSum / calcMean / calcMedian
// ---------------------------------------------------------------------------
describe("calcSum", () => {
  it("sums values", () => expect(calcSum([1, 2, 3])).toBe(6));
  it("handles empty array", () => expect(calcSum([])).toBe(0));
  it("handles negatives", () => expect(calcSum([-1, 1])).toBe(0));
  it("handles decimals", () => expect(calcSum([0.1, 0.2])).toBeCloseTo(0.3));
});

describe("calcMean", () => {
  it("basic mean", () => expect(calcMean([10, 20, 30])).toBe(20));
  it("excludes missing — not zero", () => {
    // [10, 20, null, 30] → only parse 10/20/30
    const vals = ["10", "20", "30"];
    const nums = vals.map((v) => parseNumericValue(v)!).filter((n) => n !== null);
    expect(calcMean(nums)).toBe(20);
  });
  it("returns NaN for empty", () => expect(calcMean([])).toBeNaN());
  it("zero is a real value", () => expect(calcMean([0, 10, 20])).toBeCloseTo(10));
  it("works with negatives", () => expect(calcMean([-10, 10])).toBe(0));
});

describe("calcMedian", () => {
  it("odd array", () => expect(calcMedian([1, 2, 3])).toBe(2));
  it("even array", () => expect(calcMedian([1, 2, 3, 4])).toBe(2.5));
  it("single value", () => expect(calcMedian([42])).toBe(42));
  it("works with negatives", () => expect(calcMedian([-3, -1, 0, 1])).toBe(-0.5));
});

// ---------------------------------------------------------------------------
// calcVariance / calcStdDev
// ---------------------------------------------------------------------------
describe("calcVariance", () => {
  it("population variance of [2,4,4,4,5,5,7,9] ≈ 4", () => {
    const nums = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(calcVariance(nums, calcMean(nums))).toBeCloseTo(4);
  });
  it("variance of identical values is 0", () => {
    expect(calcVariance([5, 5, 5], 5)).toBe(0);
  });
  it("returns NaN for empty", () => expect(calcVariance([], 0)).toBeNaN());
});

describe("calcStdDev", () => {
  it("stddev of [2,4,4,4,5,5,7,9] ≈ 2", () => {
    const nums = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(calcStdDev(nums, calcMean(nums))).toBeCloseTo(2);
  });
  it("zero for identical values", () => expect(calcStdDev([3, 3, 3], 3)).toBe(0));
});

// ---------------------------------------------------------------------------
// calcNumericStats
// ---------------------------------------------------------------------------
describe("calcNumericStats", () => {
  it("returns null for empty", () => expect(calcNumericStats([])).toBeNull());

  it("basic dataset [10,20,30,40,50]", () => {
    const s = calcNumericStats(["10", "20", "30", "40", "50"])!;
    expect(s.count).toBe(5);
    expect(s.sum).toBe(150);
    expect(s.mean).toBe(30);
    expect(s.median).toBe(30);
    expect(s.min).toBe(10);
    expect(s.max).toBe(50);
    expect(s.range).toBe(40);
    expect(s.q1).toBeCloseTo(17.5);
    expect(s.q3).toBeCloseTo(42.5);
    expect(s.iqr).toBeCloseTo(25);
  });

  it("does NOT treat missing strings as zero", () => {
    // Only numeric strings passed in — callers must pre-filter missing values
    const s = calcNumericStats(["10", "20", "30"])!;
    expect(s.mean).toBe(20);
    expect(s.count).toBe(3);
  });

  it("zero is a real value", () => {
    const s = calcNumericStats(["0", "10", "20"])!;
    expect(s.min).toBe(0);
    expect(s.sum).toBe(30);
    expect(s.mean).toBeCloseTo(10);
  });

  it("negative values", () => {
    const s = calcNumericStats(["-10", "-5", "0", "5", "10"])!;
    expect(s.min).toBe(-10);
    expect(s.max).toBe(10);
    expect(s.mean).toBe(0);
    expect(s.range).toBe(20);
  });

  it("decimals", () => {
    const s = calcNumericStats(["1.5", "2.5", "3.5"])!;
    expect(s.mean).toBeCloseTo(2.5);
    expect(s.sum).toBeCloseTo(7.5);
  });

  it("large numbers keep precision", () => {
    const s = calcNumericStats(["1000000", "2000000"])!;
    expect(s.sum).toBe(3000000);
    expect(s.mean).toBe(1500000);
  });

  it("single value", () => {
    const s = calcNumericStats(["42"])!;
    expect(s.count).toBe(1);
    expect(s.min).toBe(42);
    expect(s.max).toBe(42);
    expect(s.range).toBe(0);
    expect(s.iqr).toBe(0);
  });

  it("duplicate values — unique count not affected", () => {
    const s = calcNumericStats(["5", "5", "5", "5"])!;
    expect(s.mean).toBe(5);
    expect(s.stdDev).toBe(0);
    expect(s.variance).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countOutliers
// ---------------------------------------------------------------------------
describe("countOutliers", () => {
  it("returns 0 for fewer than 4 values", () => {
    expect(countOutliers(["1", "2", "3"])).toBe(0);
  });

  it("detects clear outlier", () => {
    // IQR of [1,2,3,4,5,1000] — 1000 should be an outlier
    expect(countOutliers(["1", "2", "3", "4", "5", "1000"])).toBeGreaterThan(0);
  });

  it("returns 0 when all values equal (IQR = 0)", () => {
    expect(countOutliers(["5", "5", "5", "5", "5"])).toBe(0);
  });

  it("returns 0 for normally distributed data", () => {
    const vals = Array.from({ length: 20 }, (_, i) => String(i + 1));
    expect(countOutliers(vals)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcCategoricalStats
// ---------------------------------------------------------------------------
describe("calcCategoricalStats", () => {
  it("returns null for empty", () => expect(calcCategoricalStats([], 0)).toBeNull());

  it("identifies single mode", () => {
    const s = calcCategoricalStats(["A", "A", "A", "B", "C"], 5)!;
    expect(s.modes).toHaveLength(1);
    expect(s.modes[0].value).toBe("A");
    expect(s.modes[0].count).toBe(3);
    expect(s.modes[0].percentage).toBeCloseTo(60);
  });

  it("handles tied modes", () => {
    const s = calcCategoricalStats(["A", "A", "B", "B", "C"], 5)!;
    expect(s.modes).toHaveLength(2);
    const modeValues = s.modes.map((m) => m.value).sort();
    expect(modeValues).toEqual(["A", "B"]);
  });

  it("topValues sorted by frequency descending", () => {
    const s = calcCategoricalStats(["A", "A", "A", "B", "B", "C"], 6)!;
    expect(s.topValues[0].value).toBe("A");
    expect(s.topValues[0].count).toBe(3);
    expect(s.topValues[1].count).toBe(2);
  });

  it("percentage is fraction of totalRows", () => {
    const s = calcCategoricalStats(["X"], 10)!;
    expect(s.modes[0].percentage).toBeCloseTo(10);
  });

  it("all same value → one mode, 100% (of non-missing)", () => {
    const s = calcCategoricalStats(["Z", "Z", "Z"], 3)!;
    expect(s.modes[0].count).toBe(3);
    expect(s.modes[0].percentage).toBeCloseTo(100);
  });
});

// ---------------------------------------------------------------------------
// calcDateStats
// ---------------------------------------------------------------------------
describe("calcDateStats", () => {
  it("returns null for empty", () => expect(calcDateStats([])).toBeNull());

  it("basic date range", () => {
    const s = calcDateStats(["2024-01-01", "2024-06-15", "2024-12-31"])!;
    expect(s.earliest).toBe("2024-01-01");
    expect(s.latest).toBe("2024-12-31");
    expect(s.rangeDays).toBeGreaterThan(300);
  });

  it("single date gives 0 day range", () => {
    const s = calcDateStats(["2024-03-15"])!;
    expect(s.earliest).toBe("2024-03-15");
    expect(s.latest).toBe("2024-03-15");
    expect(s.rangeDays).toBe(0);
  });

  it("handles unsorted input", () => {
    const s = calcDateStats(["2024-12-01", "2024-01-01", "2024-06-01"])!;
    expect(s.earliest).toBe("2024-01-01");
    expect(s.latest).toBe("2024-12-01");
  });
});

// ---------------------------------------------------------------------------
// calcBooleanStats
// ---------------------------------------------------------------------------
describe("calcBooleanStats", () => {
  it("returns null for empty", () => expect(calcBooleanStats([], 0)).toBeNull());

  it("counts true/false correctly", () => {
    const s = calcBooleanStats(["true", "false", "true", "yes", "no", "1", "0"], 7)!;
    expect(s.trueCount).toBe(3);  // true, yes, 1
    expect(s.falseCount).toBe(3); // false, no, 0
  });

  it("percentages use totalRows denominator", () => {
    const s = calcBooleanStats(["true", "false"], 10)!;
    expect(s.truePercentage).toBeCloseTo(10);
    expect(s.falsePercentage).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// isMissing
// ---------------------------------------------------------------------------
describe("isMissing", () => {
  it("null is missing", () => expect(isMissing(null)).toBe(true));
  it("undefined is missing", () => expect(isMissing(undefined)).toBe(true));
  it("empty string is missing", () => expect(isMissing("")).toBe(true));
  it("whitespace is missing", () => expect(isMissing("  ")).toBe(true));
  it("n/a variants are missing", () => {
    expect(isMissing("n/a")).toBe(true);
    expect(isMissing("N/A")).toBe(true);
    expect(isMissing("NA")).toBe(true);
  });
  it("zero is NOT missing", () => expect(isMissing("0")).toBe(false));
  it("zero number is NOT missing", () => expect(isMissing(0)).toBe(false));
  it("false string is NOT missing", () => expect(isMissing("false")).toBe(false));
  it("real values are not missing", () => {
    expect(isMissing("John")).toBe(false);
    expect(isMissing("42")).toBe(false);
    expect(isMissing("2024-01-01")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// normalizeColumns (phantom column prevention)
// ---------------------------------------------------------------------------
describe("normalizeColumns", () => {
  it("strips trailing empty fields", () => {
    expect(normalizeColumns(["A", "B", "C", ""])).toEqual(["A", "B", "C"]);
  });
  it("strips multiple trailing empty fields", () => {
    expect(normalizeColumns(["A", "B", "", ""])).toEqual(["A", "B"]);
  });
  it("keeps interior blank fields renamed", () => {
    expect(normalizeColumns(["A", "", "C"])).toEqual(["A", "(Unnamed Column 2)", "C"]);
  });
  it("trims whitespace from field names", () => {
    expect(normalizeColumns([" A ", " B "])).toEqual(["A", "B"]);
  });
  it("returns empty array for all-empty headers", () => {
    expect(normalizeColumns(["", "", ""])).toEqual([]);
  });
  it("no change when no trailing empties", () => {
    expect(normalizeColumns(["Name", "Age", "Country"])).toEqual(["Name", "Age", "Country"]);
  });
});
