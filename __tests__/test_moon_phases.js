const { derivePhaseFromData } = require("../tools/moon_phases");

const tests = [
  // API returns negative illumination for waning phases
  { illumination: "-99.95", angle: 182.66, expected: "Full Moon" },
  { illumination: "99.88",  angle: 175.95, expected: "Full Moon" },
  { illumination: "-99.93", angle: 182.99, expected: "Full Moon" },

  // Waxing side
  { illumination: "97.94",  angle: 165.0,  expected: "Waxing Gibbous" },
  { illumination: "55.0",   angle: 90.0,   expected: "Waxing Gibbous" },
  { illumination: "50.0",   angle: 90.0,   expected: "First Quarter" },
  { illumination: "25.0",   angle: 45.0,   expected: "Waxing Crescent" },
  { illumination: "0.5",    angle: 5.0,    expected: "Waxing Crescent" },

  // Waning side (negative illumination from API)
  { illumination: "-98.29", angle: 195.04, expected: "Waning Gibbous" },
  { illumination: "-97.94", angle: 195.0,  expected: "Waning Gibbous" },
  { illumination: "-55.0",  angle: 270.0,  expected: "Waning Gibbous" },
  { illumination: "-50.0",  angle: 270.0,  expected: "Last Quarter" },
  { illumination: "-25.0",  angle: 315.0,  expected: "Waning Crescent" },

  // Waxing crescent near new moon
  { illumination: "0.50", angle: 8.14, expected: "Waxing Crescent" },

  // New Moon threshold
  { illumination: "-0.19", angle: 354.97, expected: "New Moon" },
  { illumination: "-0.18", angle: 355.19, expected: "New Moon" },
];

let passed = 0;
let failed = 0;

for (const { illumination, angle, expected } of tests) {
  const result = derivePhaseFromData(illumination, angle);
  const ok = result === expected;

  if (ok) {
    console.log(`✅ illumination=${illumination} angle=${angle} → ${result}`);
    passed++;
  } else {
    console.log(`❌ illumination=${illumination} angle=${angle} → got "${result}", expected "${expected}"`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);