const sweph = require("swisseph");

sweph.swe_set_ephe_path('./ephemeris/');

const PLANETS = [
  { id: sweph.SE_SUN,     name: "Sun" },
  { id: sweph.SE_MERCURY, name: "Mercury" },
  { id: sweph.SE_VENUS,   name: "Venus" },
  { id: sweph.SE_MARS,    name: "Mars" },
  { id: sweph.SE_JUPITER, name: "Jupiter" },
  { id: sweph.SE_SATURN,  name: "Saturn" },
  { id: sweph.SE_URANUS,  name: "Uranus" },
  { id: sweph.SE_NEPTUNE, name: "Neptune" },
  { id: sweph.SE_PLUTO,   name: "Pluto" },
];

const ASPECTS = [
  { name: "conjunct", angle: 0,   orb: 8 },
  { name: "sextile",     angle: 60,  orb: 6 },
  { name: "square",      angle: 90,  orb: 8 },
  { name: "trine",       angle: 120, orb: 8 },
  { name: "opposite",  angle: 180, orb: 8 },
];

// 🔹 Get current Julian Day
function getCurrentJulianDay(date = null) {
  const now = date || new Date();
  return sweph.swe_julday(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    now.getUTCDate(),
    now.getUTCHours() + now.getUTCMinutes() / 60, // ✅ UTC
    sweph.SE_GREG_CAL
  );
}

function getPlanetLongitudeAndSpeed(julianDay, planetId) {
  return new Promise((resolve, reject) => {
    sweph.swe_calc_ut(julianDay, planetId, sweph.SEFLG_SPEED | sweph.SEFLG_SWIEPH, (result) => {
      if (!result || result.rc !== sweph.OK) {
        return reject(`❌ Error calculating planet ${planetId}`);
      }
      resolve({
        longitude: result.longitude % 360,
        speed: result.longitudeSpeed
      });
    });
  });
}

function getAngularDifference(a, b) {
  let diff = (a - b) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff; // signed difference
}


function detectAspect(moonLong, moonSpeed, planetLong, planetSpeed) {
  for (const aspect of ASPECTS) {
    const arc = getAngularDifference(moonLong, planetLong);
    const absArc = Math.abs(arc);

    const diff = Math.min(
      Math.abs(absArc - aspect.angle),
      Math.abs(absArc - (360 - aspect.angle))
    );

    if (diff <= aspect.orb) {
      let applying;

      if (aspect.angle === 180 || aspect.angle === 0) {
        const exactPoint = (planetLong + aspect.angle) % 360;
        const distanceToExact = getAngularDifference(exactPoint, moonLong);
        applying = (distanceToExact > 0 && moonSpeed > 0) ||
                   (distanceToExact < 0 && moonSpeed < 0);
      } else {
        const exactPoint1 = (planetLong + aspect.angle) % 360;
        const exactPoint2 = (planetLong - aspect.angle + 360) % 360;

        const dist1 = Math.abs(getAngularDifference(moonLong, exactPoint1));
        const dist2 = Math.abs(getAngularDifference(moonLong, exactPoint2));
        const exactPoint = dist1 < dist2 ? exactPoint1 : exactPoint2;

        const distToExact = getAngularDifference(exactPoint, moonLong);

        // Under 0.1° treat as exact — too close to call
        if (diff < 0.1) {
          applying = true; // label as "exact" in post
        } else {
          applying = distToExact > 0;
        }
      }

      return {
        ...aspect,
        orb: parseFloat(diff.toFixed(4)),
        applying,
      };
    }
  }
  return null;
}

// 🔹 Main function — get all Moon transits
async function getMoonTransits(date = null) {
  const julianDay = getCurrentJulianDay(date);

  const moon = await getPlanetLongitudeAndSpeed(julianDay, sweph.SE_MOON); // 👈 moon is defined here

  const transits = [];

  for (const planet of PLANETS) {
    const p = await getPlanetLongitudeAndSpeed(julianDay, planet.id);
		const aspect = detectAspect(moon.longitude, moon.speed, p.longitude, p.speed, planet.name);

    if (aspect) {
      transits.push({
        planet: planet.name,
        aspect: aspect.name,
        orb: aspect.orb,
				rx: p.speed < 0,
        applying: aspect.applying,
        moonLongitude: parseFloat(moon.longitude.toFixed(2)), // 👈 used here
        planetLongitude: parseFloat(p.longitude.toFixed(2)),
        planetSpeed: parseFloat(p.speed.toFixed(4)),
      });
    }
  }

  return transits;
}

module.exports = { getMoonTransits, getCurrentJulianDay };