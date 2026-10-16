/**
 * __tests__/gemini.test.js
 *
 * Unit tests for lib/gemini.js
 */

describe('lib/gemini.js', () => {
    const originalEnv = process.env;
    let geminiModule;

    beforeEach(async () => {
        jest.resetModules();
        process.env = { ...originalEnv };
        delete process.env.GEMINI_API_KEY;
        geminiModule = await import('../lib/gemini.js');
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('callGeminiApi throws when GEMINI_API_KEY is not configured', async () => {
        await expect(geminiModule.callGeminiApi('Test prompt'))
            .rejects
            .toThrow('GEMINI_API_KEY is not configured');
    });

    test('callGeminiApi succeeds when fetch returns candidate text', async () => {
        process.env.GEMINI_API_KEY = 'mock-key';

        const mockResponse = {
            candidates: [
                {
                    content: {
                        parts: [{ text: 'Trip summary from origin to destination.' }]
                    }
                }
            ]
        };

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const result = await geminiModule.callGeminiApi('Test telemetry prompt');
        expect(result).toBe('Trip summary from origin to destination.');
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('gemini-3.1-flash-lite:generateContent?key=mock-key'),
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': 'mock-key'
                }
            })
        );
    });

    test('callGeminiApi handles API errors properly', async () => {
        process.env.GEMINI_API_KEY = 'mock-key';

        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: jest.fn().mockResolvedValue('API key expired')
        });

        await expect(geminiModule.callGeminiApi('Test prompt'))
            .rejects
            .toThrow('Gemini API error (403): API key expired');
    });

    test('formatInTimezone correctly converts UTC date to local time', () => {
        const utcDate = new Date('2026-10-15T15:30:00Z');
        const formatted = geminiModule.formatInTimezone(utcDate, 'America/Sao_Paulo', 'full');
        // Sao Paulo is UTC-3, so 15:30 UTC is 12:30 local
        expect(formatted).toContain('12:30:00');

        const timeOnly = geminiModule.formatInTimezone(utcDate, 'America/Sao_Paulo', 'timeOnly');
        expect(timeOnly).toBe('12:30:00');
    });
});
