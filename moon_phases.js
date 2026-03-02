const dotenv = require("dotenv");
const process = require("process");

dotenv.config();

const IMPORTANT_PHASES = ["New Moon", "Full Moon"];

function derivePhaseFromData(illuminationStr, moonAngle) {
  const illumination = parseFloat(illuminationStr);
  const isWaxing = moonAngle <= 180;
  const distanceFrom180 = Math.abs(moonAngle - 180);

  if (illumination < 2) return "New Moon";
  if (illumination < 48) return isWaxing ? "Waxing Crescent" : "Waning Crescent";
  if (illumination < 52) return isWaxing ? "First Quarter" : "Last Quarter";
  if (illumination >= 99.5 && distanceFrom180 <= 5) return "Full Moon";
  if (illumination < 99.5) return isWaxing ? "Waxing Gibbous" : "Waning Gibbous";
  return isWaxing ? "Waxing Gibbous" : "Waning Gibbous";
}

async function fetchMoonData(date) {
  const formattedDate = date.toISOString().split('T')[0];
  const apiKey = process.env.IPGEO_API_KEY;
  const lat = process.env.LAT_COORDINATE;
  const long = process.env.LONG_COORDINATE;
  const url = `https://api.ipgeolocation.io/astronomy?apiKey=${apiKey}&lat=${lat}&long=${long}&date=${formattedDate}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching moon data:', error);
  }
}

async function findNextImportantPhase(fromDate) {
  let lastPhase = null;

  for (let i = 1; i <= 30; i++) {
    const date = new Date(fromDate);
    date.setUTCDate(date.getUTCDate() + i);
    const data = await fetchMoonData(date);

    if (data) {
      const phase = derivePhaseFromData(data.moon_illumination_percentage, data.moon_angle);

      // first iteration — capture current phase to detect transition
      if (lastPhase === null) {
        lastPhase = phase;
        continue;
      }

      // phase changed and it's an important one
      if (phase !== lastPhase && IMPORTANT_PHASES.includes(phase)) {
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const year = date.getUTCFullYear();
        return {
          phase,
          date: `${month}/${day}/${year}`,
        };
      }

      lastPhase = phase;
    }
  }

  return null;
}

async function getCurrentMoonPhase() {
  const date = new Date();
  const data = await fetchMoonData(date);

  const phaseData = {
    currentPhase: null,
    importantClosePhase: null,
    importantClosePhaseDate: null,
  };

  if (data) {
    console.log('illumination:', data.moon_illumination_percentage, 'angle:', data.moon_angle);

    phaseData.currentPhase = derivePhaseFromData(
      data.moon_illumination_percentage,
      data.moon_angle
    );

    const nextPhase = await findNextImportantPhase(date);
    if (nextPhase) {
      phaseData.importantClosePhase = nextPhase.phase;
      phaseData.importantClosePhaseDate = nextPhase.date;
    }
  }

  console.log('phaseData:', phaseData);
  return phaseData;
}

module.exports = {
  getCurrentMoonPhase,
};