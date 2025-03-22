const dotenv = require("dotenv");
const process = require("process");

dotenv.config();

function comparePhaseDates(dateString, compareMonth, compareDay) {
    const date = new Date(dateString);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
  
    return month < compareMonth || (month === compareMonth && day < compareDay);
  }

async function fetchMoonData(date, latitude, longitude, timezone) {
    const formattedDate = date.toISOString().split('T')[0];
    const url = `https://aa.usno.navy.mil/api/rstt/oneday?date=${formattedDate}&coords=${latitude},${longitude}&tz=${timezone}`;
  
    console.log(latitude, longitude, timezone)
    
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
  
  const date = new Date();
  const latitude = process.env.LAT_COORDINATE;
  const longitude = process.env.LONG_COORDINATE;
  const timezone = process.env.TIMEZONE;     // Eastern Daylight Savings Time; ends Nov 2nd 2025

  async function getCurrentMoonPhase() {
    const data = await fetchMoonData(date, latitude, longitude, timezone)
    const phaseData = { 
			currentPhase: null, 
			importantClosePhase: null, 
			importantClosePhaseDate: null 
    }

    if (data) {
			const currentPhase = data.properties.data.curphase
			const closestPhase = data.properties.data.closestphase
			const { phase, month, day, year } = closestPhase
			console.log(data)
			console.log('Moon Phase:', currentPhase);
			console.log('Closest Phase:', closestPhase);

			const hasImportantPhaseAfterToday = comparePhaseDates(date, month, day)

			if ((phase === 'New Moon' || phase === 'Full Moon') && hasImportantPhaseAfterToday) {
				phaseData.importantClosePhase = phase
				phaseData.importantClosePhaseDate = `${month}/${day}/${year}`
			}

			phaseData.currentPhase = currentPhase
    }

    console.log('phaseData: ', phaseData)
    return phaseData
  };

  module.exports = {
    getCurrentMoonPhase
  };
