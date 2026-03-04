const { getMoonSign } = require('../tools/moon_sign');
const { getCurrentMoonPhase } = require('../tools/moon_phases');
const { getMoonEmoji } = require('../tools/utils');

// 🔹 Mock Bluesky — we don't want to actually post
jest.mock('@atproto/api', () => ({
  AtpAgent: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue({}),
    post: jest.fn().mockResolvedValue({ uri: 'fake-uri', cid: 'fake-cid' })
  }))
}));

describe('Moon Phase Bot', () => {

  const testDate = process.env.TEST_DATE 
  ? new Date(process.env.TEST_DATE) 
  : new Date('2026-03-10T03:45:10Z'); // fallback default

  // 🔹 Test 1 — Real Moon sign calculation for a known date
  it('should calculate the correct moon sign for a known date', async () => {
    //const testDate = new Date('2026-03-10T03:45:10Z'); // known: Sagittarius
    const sign = await getMoonSign(testDate);
    expect(sign).toBe('Sagittarius');
  });

  // 🔹 Test 2 — Real Moon phase for a known date
  it('should calculate the correct moon phase for a known date', async () => {
    const moon = await getCurrentMoonPhase(new Date('2026-03-10T03:45:10Z'));
    expect(moon.currentPhase).toBeDefined();
    expect(typeof moon.currentPhase).toBe('string');
    console.log(`🌙 Moon phase: ${moon.currentPhase}`);
  });

  // 🔹 Test 3 — Message is under 300 characters
  it('should build a message under 300 characters', async () => {
    //const testDate = new Date('2026-03-10T03:45:10Z');
    const moon = await getCurrentMoonPhase(testDate);
    const moonSign = await getMoonSign(testDate);
    const moonEmoji = getMoonEmoji(moon.currentPhase);

    const templates = [
      `${moonEmoji} The Moon is in its ${moon.currentPhase} phase, transiting ${moonSign} today. Drop your rising sign below and I'll reveal which house it's activating in your chart! #astrology #astrosky`,
      `${moonEmoji} Moon in ${moonSign}, ${moon.currentPhase} phase. Which house is it lighting up for you? Reply with your rising sign to find out. #astrology #astrosky`,
      `${moonEmoji} The Moon is ${moon.currentPhase} in ${moonSign} today. Tell me your rising sign and I'll tell you exactly which house this energy is moving through for you. #astrology #astrosky`,
      `${moonEmoji} We've got a ${moon.currentPhase} Moon in ${moonSign} today! Curious which house this is activating for you? Drop your rising sign and let's explore your chart. #astrology #astrosky`,
    ];

    templates.forEach((message, i) => {
      console.log(`Template ${i + 1} (${message.length} chars): ${message}`);
      expect(message.length).toBeLessThan(300);
    });
  });

  // 🔹 Test 4 — Moon sign matches expected for multiple known dates
  it.each([
    ['2026-03-03T22:00:00Z', 'Virgo'],
    ['2026-03-04T18:34:00Z', 'Virgo'],
    ['2026-03-10T03:45:10Z', 'Sagittarius'],
  ])('Moon sign on %s should be %s', async (dateStr, expectedSign) => {
    const sign = await getMoonSign(new Date(dateStr));
    expect(sign).toBe(expectedSign);
  });

});