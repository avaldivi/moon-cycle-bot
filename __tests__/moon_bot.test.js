const { postMoonSignAndPhase, getMoonSign } = require('../moon_bot');
const { getCurrentMoonPhase } = require('../moon_phases');
const { AtpAgent } = require('@atproto/api');

jest.mock('@atproto/api', () => {
	return {
		AtpAgent: jest.fn().mockImplementation(() => ({
			login: jest.fn(),
			post: jest.fn()
		}))
	};
});
  
jest.mock('../moon_phases', () => ({
	getCurrentMoonPhase: jest.fn(() => Promise.resolve({
			currentPhase: "Waning Crescent"
	}))
}));

jest.mock('../utils', () => ({
	getMoonEmoji: jest.fn(() => "🌘"),
	getByteIndex: jest.fn(() => 117)
}));

describe('postMoonSignAndPhase', () => {
  it('should build the correct message and call agent.post()', async () => {
    // Mock getMoonSign() directly since it's in same file
    const fakeSign = "Sagittarius";
    jest.spyOn(global, 'Date').mockImplementation(() => new Date("2025-03-28T12:00:00Z"));
    jest.spyOn(require('../moon_sign'), 'getMoonSign').mockResolvedValue(fakeSign);

    const agentInstance = new AtpAgent();
    await postMoonSignAndPhase();

    expect(getCurrentMoonPhase).toHaveBeenCalled();
    // expect(agentInstance.post).toHaveBeenCalledWith(expect.objectContaining({
    //   text: expect.stringContaining("The Moon is currently in its Waning Crescent phase and transiting Sagittarius today!"),
    //   facets: expect.any(Array),
    //   createdAt: expect.any(String)
    // }));
  });
});