const mockQuery = jest.fn();
const mockGenerateSessionSummary = jest.fn();

jest.mock('../lib/db.js', () => ({
    query: mockQuery,
    __esModule: true
}));

jest.mock('../lib/gemini.js', () => ({
    generateSessionSummary: mockGenerateSessionSummary,
    __esModule: true
}));

const { runGenerateSessionAiDescriptionJob } = require('../lib/jobs/generateSessionAiDescription.js');

describe('lib/jobs/generateSessionAiDescription.js', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns idle status when no completed sessions are pending AI description', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const result = await runGenerateSessionAiDescriptionJob();

        expect(result).toEqual({
            status: 'idle',
            message: 'No sessions pending description.'
        });
        expect(mockGenerateSessionSummary).not.toHaveBeenCalled();
    });

    test('selects newest session and generates AI description', async () => {
        const mockSession = {
            ID: 'sess-123',
            START_UTC: '2026-10-15T12:00:00Z',
            END_UTC: '2026-10-15T12:45:00Z',
            DEVICE_ID: 'dev-001'
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockSession] });
        mockGenerateSessionSummary.mockResolvedValueOnce({
            sessionId: 'sess-123',
            description: 'Viagem de 12 km realizada com sucesso.'
        });

        const result = await runGenerateSessionAiDescriptionJob();

        expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('ORDER BY s.END_UTC DESC'));
        expect(mockGenerateSessionSummary).toHaveBeenCalledWith('sess-123');
        expect(result).toEqual({
            status: 'success',
            sessionId: 'sess-123',
            descriptionLength: 'Viagem de 12 km realizada com sucesso.'.length
        });
    });

    test('handles empty generation result gracefully', async () => {
        const mockSession = {
            ID: 'sess-empty',
            START_UTC: '2026-10-15T12:00:00Z',
            END_UTC: '2026-10-15T12:45:00Z'
        };

        mockQuery.mockResolvedValueOnce({ rows: [mockSession] });
        mockGenerateSessionSummary.mockResolvedValueOnce(null);

        const result = await runGenerateSessionAiDescriptionJob();

        expect(result).toEqual({
            status: 'warning',
            sessionId: 'sess-empty',
            message: 'No description generated.'
        });
    });
});
