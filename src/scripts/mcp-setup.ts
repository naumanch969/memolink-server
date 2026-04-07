import mongoose from 'mongoose';
import { OAuthClient } from '../features/oauth/oauth.model';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MCP_CLIENT_ID = 'brinn_mcp_official';
const MCP_CLIENT_NAME = 'Brinn MCP';
const MCP_REDIRECT_URIS = [
  'http://localhost:6274/oauth/callback',
  'http://localhost:6274/oauth/callback/debug',
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback'
];

async function seedMcpClient() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const existingClient = await OAuthClient.findOne({ clientId: MCP_CLIENT_ID });

    if (existingClient) {
      console.log('Updating existing MCP Client...');
      existingClient.redirectUris = Array.from(new Set([...existingClient.redirectUris, ...MCP_REDIRECT_URIS]));
      await existingClient.save();
      console.log('Updated MCP Client redirect URIs.');
    } else {
      console.log('Creating new MCP Client...');
      const clientSecret = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      const newClient = new OAuthClient({
        clientId: MCP_CLIENT_ID,
        clientSecret,
        name: MCP_CLIENT_NAME,
        description: 'Official Brinn MCP Integration for AI Assistants',
        redirectUris: MCP_REDIRECT_URIS,
        grants: ['authorization_code', 'refresh_token'],
      });
      await newClient.save();
      console.log('-----------------------------------');
      console.log('MCP Client Created Successfully!');
      console.log(`Client ID: ${MCP_CLIENT_ID}`);
      console.log(`Client Secret: ${clientSecret}`);
      console.log('-----------------------------------');
      console.log('SAVE THESE CREDENTIALS FOR SUBMISSION');
    }

  } catch (error) {
    console.error('Error seeding MCP Client:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedMcpClient();
