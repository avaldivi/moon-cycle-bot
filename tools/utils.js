function getByteIndex(message, substring) {
    const charIndex = message.indexOf(substring);
    const before = message.slice(0, charIndex);
    return Buffer.byteLength(before, 'utf8');
  }
  
  function getByteIndexedSlice(str, byteStart, byteEnd) {
    const buf = Buffer.from(str, 'utf8');
    const sliced = buf.slice(byteStart, byteEnd);
    return sliced.toString('utf8');
  }
  
  function getMoonEmoji(phase) {
    const phaseMap = {
      "New Moon": "🌑",
      "Waxing Crescent": "🌒",
      "First Quarter": "🌓",
      "Waxing Gibbous": "🌔",
      "Full Moon": "🌕",
      "Waning Gibbous": "🌖",
      "Last Quarter": "🌗",
      "Waning Crescent": "🌘"
    };
  
    return phaseMap[phase] || "🌙"; // fallback just in case
  }

  function getTimezoneOffset(date, timezone) {
    // Use Intl to get the correct offset including DST for a given timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });
    
    const parts = formatter.formatToParts(date);
    const offsetStr = parts.find(p => p.type === 'timeZoneName')?.value; // e.g. "GMT-4" or "GMT-5"
    const match = offsetStr?.match(/GMT([+-]\d+)/);
    return match ? parseInt(match[1]) : -5;
  }

  module.exports = {
    getByteIndex,
    getByteIndexedSlice,
    getMoonEmoji,
    getTimezoneOffset
  }