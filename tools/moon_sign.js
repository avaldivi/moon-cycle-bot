const sweph = require("swisseph");

// 🔹 Set Swiss Ephemeris Data Path
// sweph.swe_set_ephe_path('./ephemeris/');

// 🔹 Get Moon’s Tropical Zodiac Sign
async function getMoonSign(date = null) {
  return new Promise((resolve, reject) => {
    const now = date || new Date();
    const julianDay = sweph.swe_julday(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      now.getUTCDate(),
      now.getUTCHours() + now.getUTCMinutes() / 60,
      sweph.SE_GREG_CAL
    );

    sweph.swe_calc_ut(julianDay, sweph.SE_MOON, sweph.SEFLG_SPEED, (result) => {
      if (!result || result.rc !== sweph.OK) {
        return reject("❌ Error calculating Moon position");
      }

      const longitude = result.longitude % 360;
      const zodiacSigns = [
        "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
        "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
      ];
      const signIndex = Math.floor(longitude / 30);
      resolve(zodiacSigns[signIndex]);
    });
  });
}

module.exports = {
	getMoonSign
}