/**
 * Script to generate a Brinn OAuth Access Token for a specific user.
 * This simulates the browser-based OAuth flow programmatically.
 * 
 * Usage: 
 *   export EMAIL=user@example.com
 *   export PASSWORD=your_password
 *   npx tsx src/scripts/generate-oauth-token.ts
 */

const BASE_URL = 'https://api.brinn.app/api';
const CLIENT_ID = 'claude-ai';
const CLIENT_SECRET = 'claude_secret_memolink_2025';
const REDIRECT_URI = 'https://claude.ai/auth/oauth/callback';

async function generateToken() {
    const email = 'naumanch969@gmail.com';
    const password = 'Test123$';

    if (!email || !password) {
        console.error("Error: EMAIL and PASSWORD environment variables are required.");
        process.exit(1);
    }

    console.log(`🚀 Starting OAuth token generation for ${email}...`);

    try {
        // 1. Login to get session token
        console.log("Step 1: Logging in...");
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const loginData: any = await loginRes.json();
        if (!loginRes.ok) throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
        
        const sessionToken = loginData.data.accessToken;
        console.log("✅ Logged in successfully.");

        // 2. Unlock Vault (Required for OAuth Approval to access MDK)
        console.log("Step 2: Unlocking vault...");
        const unlockRes = await fetch(`${BASE_URL}/auth/vault/unlock`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({ password })
        });

        if (!unlockRes.ok) {
            const unlockData = await unlockRes.json();
            throw new Error(`Vault unlock failed: ${JSON.stringify(unlockData)}`);
        }
        console.log("✅ Vault unlocked.");

        // 3. Approve OAuth Grant
        console.log("Step 3: Approving OAuth grant...");
        const approveRes = await fetch(`${BASE_URL}/oauth/approve`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                clientId: CLIENT_ID,
                redirectUri: REDIRECT_URI,
                scope: 'all',
                state: 'random_state'
            })
        });

        const approveData: any = await approveRes.json();
        if (!approveRes.ok) throw new Error(`Approval failed: ${JSON.stringify(approveData)}`);
        
        const authCode = approveData.data.code;
        console.log("✅ OAuth grant approved. Code received.");

        // 4. Exchange Code for Access Token
        console.log("Step 4: Exchanging code for access token...");
        const tokenRes = await fetch(`${BASE_URL}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grantType: 'authorization_code',
                code: authCode,
                redirectUri: REDIRECT_URI,
                clientId: CLIENT_ID,
                clientSecret: CLIENT_SECRET
            })
        });

        const tokenData: any = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);

        console.log("\n✨ SUCCESS! Here is your OAuth Access Token:");
        console.log("-------------------------------------------");
        console.log(tokenData.accessToken);
        console.log("-------------------------------------------");
        console.log("Expires in:", tokenData.expiresIn, "seconds");
        
    } catch (error: any) {
        console.error("\n❌ Error generating token:", error.message);
        process.exit(1);
    }
}

generateToken();
