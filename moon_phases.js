const dotenv = require("dotenv");
const process = require("process");

dotenv.config();

function comparePhaseDates(date, compareMonth, compareDay) {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return month < compareMonth || (month === compareMonth && day < compareDay);
}

async function fetchMoonData(date, latitude, longitude, timezone) {
  const formattedDate = date.toISOString().split('T')[0];
  const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${formattedDate}&coords=${latitude},${longitude}&tz=${timezone}`;

  console.log(latitude, longitude, timezone);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching Moon data:', error);
  }
}

function inferPhaseFromClosest(closestPhase, today) {
  const { phase, month, day, year } = closestPhase;
  const closestDate = new Date(Date.UTC(year, month - 1, day));
  const isPast = today >= closestDate;

  // The 8 phases in order
  const phases = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];

  const closestIndex = phases.indexOf(phase);
  if (closestIndex === -1) return phase; // unknown, return as-is

  if (isPast) {
    // closest phase already happened → we're in the phase AFTER it
    return phases[(closestIndex + 1) % phases.length];
  } else {
    // closest phase is upcoming → we're in the phase BEFORE it
    return phases[(closestIndex - 1 + phases.length) % phases.length];
  }
}

async function getCurrentMoonPhase() {
  const date = new Date(); // ✅ moved inside so it's always today
  const latitude = process.env.LAT_COORDINATE;
  const longitude = process.env.LONG_COORDINATE;
  const timezone = process.env.TIMEZONE;

  const data = await fetchMoonData(date, latitude, longitude, timezone);
  const phaseData = {
    currentPhase: null,
    importantClosePhase: null,
    importantClosePhaseDate: null,
  };

  if (data) {
    const currentPhase = data.properties.data.curphase;
    const closestPhase = data.properties.data.closestphase;
    const { phase, month, day, year } = closestPhase;

    console.log(data);
    console.log('curphase from API:', currentPhase);
    console.log('Closest Phase:', closestPhase);

    const hasImportantPhaseAfterToday = comparePhaseDates(date, month, day);

    if ((phase === 'New Moon' || phase === 'Full Moon') && hasImportantPhaseAfterToday) {
      phaseData.importantClosePhase = phase;
      phaseData.importantClosePhaseDate = `${month}/${day}/${year}`;
    }

    // ✅ Use curphase if the API gives it (phase-transition days), otherwise infer
    phaseData.currentPhase = currentPhase || inferPhaseFromClosest(closestPhase, date);
  }

  console.log('phaseData: ', phaseData);
  return phaseData;
}

module.exports = {
  getCurrentMoonPhase,
};