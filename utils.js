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

  module.exports = {
    getByteIndex,
    getByteIndexedSlice,
    getMoonEmoji
  }