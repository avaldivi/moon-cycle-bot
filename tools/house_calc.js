const zodiacSigns = [
	"Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
	"Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];
  
function getHouseForRising(moonSign, risingSign) {
	const risingIndex = zodiacSigns.indexOf(risingSign);
	const moonIndex = zodiacSigns.indexOf(moonSign);

	if (risingIndex === -1 || moonIndex === -1) return null;

	const house = (moonIndex - risingIndex + 12) % 12 + 1;
	return house;
}

module.exports = {
	getHouseForRising
}
  