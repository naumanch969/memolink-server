
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = 'http://[::1]:5001/api';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'password123';

async function runTest() {
    try {
        console.log('1. Authenticating...');
        let token = process.env.TEST_AUTH_TOKEN;

        if (!token) {
            try {
                const loginRes = await axios.post(`${API_URL}/auth/login`, {
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD
                });
                token = loginRes.data.data.accessToken;
                console.log('   Authenticated successfully.');
            } catch (e) {
                console.error('   Authentication failed. Please ensure test user exists or set TEST_AUTH_TOKEN.');
                console.error(e.response?.data || e.message);
                return;
            }
        }

        const headers = { Authorization: `Bearer ${token}` };

        const testCases = [
            {
                name: 'Case A: Specific Reminder',
                input: 'Remind me to call John at 5pm tomorrow',
                expectedIntent: 'CMD_REMINDER_CREATE'
            },
            {
                name: 'Case B: Long-Term Goal',
                input: 'I want to read 12 books by the end of the year',
                expectedIntent: 'CMD_GOAL_CREATE'
            },
            {
                name: 'Case C: Generic Task',
                input: 'Buy milk',
                expectedIntent: 'CMD_TASK_CREATE'
            },
            {
                name: 'Case D: Journal Entry',
                input: 'Today I felt really productive. The new feature is working great.',
                expectedIntent: 'JOURNALING'
            }
        ];

        console.log('\n2. Running Intent Tests...');

        for (const test of testCases) {
            console.log(`\n--- ${test.name} ---`);
            console.log(`   Input: "${test.input}"`);
            try {
                const res = await axios.post(`${API_URL}/agents/intent`, { text: test.input }, { headers });
                const { intent, task, data } = res.data;

                console.log(`   Result Intent: ${intent}`);
                console.log(`   Task Type: ${task?.type}`);

                if (intent === test.expectedIntent) {
                    console.log('   ✅ PASS');
                } else if (test.name === 'Case C' && (intent === 'CMD_TASK_CREATE' || intent === 'CMD_REMINDER_CREATE')) {
                    console.log('   ✅ PASS (Acceptable Variant)');
                } else {
                    console.log(`   ❌ FAIL (Expected ${test.expectedIntent})`);
                }

                if (data) {
                    console.log(`   Created Data ID: ${data._id}`);
                    if (data.title) console.log(`   Title: ${data.title}`);
                    if (data.date) console.log(`   Date: ${data.date}`);
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                console.error(`   ❌ ERROR:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
                if (axios.isAxiosError(error)) {
                    console.error('Response Data:', error.response?.data);
                    console.error('Response Status:', error.response?.status);
                }
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error('Test Suite Failed:', error);
    }
}

runTest();
