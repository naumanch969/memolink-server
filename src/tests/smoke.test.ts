
import express from 'express';
import request from 'supertest';

describe('Server Smoke Test', () => {
    const app = express();
    app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

    it('should return 200 OK for health check', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
    });
});
