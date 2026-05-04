import database from '../config/database';
import User from '../features/auth/auth.model';
import { vaultService } from '../features/auth/vault.service';

async function setupTestUser() {
  await database.connect();
  
  const email = 'test@example.com';
  let user = await User.findOne({ email });
  
  if (!user) {
    user = await User.create({
      email,
      password: 'Password123!',
      name: 'Test User',
      isActive: true,
      isOnboarded: true,
      isEmailVerified: true
    });
    console.log('Created test user:', user._id);
  } else {
    console.log('Test user already exists:', user._id);
  }

  // Initialize vault if not exists
  if (!user.vault || !user.vault.wrappedMDK_password) {
    await vaultService.initializeVault(user as any, {
      password: 'Password123!',
      securityQuestion: 'What is the color of the sky?',
      securityAnswer: 'Blue'
    });
    console.log('Vault initialized');
  }

  // Store MDK in session to simulate logged in state with unlocked vault
  // We need to do this in the actual app, but for seeding we just make sure it's ready
  
  await database.disconnect();
}

setupTestUser().catch(console.error);
