const dotenv = require("dotenv");
const process = require("process");
const { getTimezoneOffset } = require('./utils')

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
  const tz = process.env.TIMEZONE; // "America/New_York"
  const offset = getTimezoneOffset(date, tz); // automatically -4 or -5 depending on DST
  
  // Get local date in that timezone
  const localDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  const apiKey = process.env.IPGEO_API_KEY;
  const lat = process.env.LAT_COORDINATE;
  const long = process.env.LONG_COORDINATE;
  const url = `https://api.ipgeolocation.io/astronomy?apiKey=${apiKey}&lat=${lat}&long=${long}&date=${formattedDate}&tz=${offset}`;

  console.log('Fetching for date:', formattedDate, 'offset:', offset);

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
    date.setDate(date.getDate() + i);
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
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
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

    // set currentPhase FIRST
    phaseData.currentPhase = derivePhaseFromData(
      data.moon_illumination_percentage,
      data.moon_angle
    );

    // THEN check if today is already an important phase
    if (IMPORTANT_PHASES.includes(phaseData.currentPhase)) {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      phaseData.importantClosePhase = phaseData.currentPhase;
      phaseData.importantClosePhaseDate = `${month}/${day}/${year}`;
    } else {
      const nextPhase = await findNextImportantPhase(date);
      if (nextPhase) {
        phaseData.importantClosePhase = nextPhase.phase;
        phaseData.importantClosePhaseDate = nextPhase.date;
      }
    }
  }

  console.log('phaseData:', phaseData);
  return phaseData;
}

module.exports = {
  getCurrentMoonPhase,
};