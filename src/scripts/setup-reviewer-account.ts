import database from '../config/database';
import User from '../features/auth/auth.model';
import { vaultService } from '../features/auth/vault.service';
import { encryptionSessionService } from '../core/encryption/encryption-session.service';
import { encryptionService } from '../core/encryption/encryption.service';
import Entry from '../features/entry/entry.model';
import Goal from '../features/goal/goal.model';
import Tag from '../features/tag/tag.model';

/**
 * Script to set up the official Reviewer account for the Anthropic MCP submission.
 * This ensures the account exists and has sample data for a rich review experience.
 */
async function setupReviewerAccount() {
  try {
    await database.connect();
    console.log('Connected to MongoDB');
    
    const email = 'reviewer@brinn.app';
    const password = 'BrinnReview2026!';
    const pin = '123456';
    
    let user = await User.findOne({ email });
    
    if (!user) {
      console.log('Creating Reviewer account...');
      user = await User.create({
        email,
        password,
        name: 'Brinn Reviewer',
        isActive: true,
        isOnboarded: true,
        isEmailVerified: true
      });
      console.log('Created reviewer user:', user._id);
    } else {
      console.log('Reviewer account already exists. Updating password...');
      user.password = password;
      await user.save();
    }

    // Initialize vault if not exists
    let mdk: Buffer;
    if (!user.vault || !user.vault.wrappedMDK_password) {
      console.log('Initializing Reviewer vault...');
      const result = await vaultService.initializeVault(user as any, {
        password,
        securityQuestion: 'What is the reviewer secret pin?',
        securityAnswer: pin
      });
      mdk = result.mdk;
      console.log('Reviewer vault initialized.');
    } else {
      // Unlock existing vault
      await vaultService.unlockVault(user._id.toString(), { password });
      const sessionMdk = await encryptionSessionService.getMDK(user._id.toString());
      if (!sessionMdk) throw new Error('Failed to retrieve MDK after unlocking');
      mdk = sessionMdk;
    }

    // Seed Sample Data
    console.log('Seeding sample data...');
    
    // Clear existing data for a fresh start
    await Entry.deleteMany({ userId: user._id });
    await Goal.deleteMany({ userId: user._id });
    await Tag.deleteMany({ userId: user._id });

    // 1. Create a Tag
    const tag = await Tag.create({
      userId: user._id,
      name: 'research',
      color: 'blue'
    });

    // 2. Create a Memo (Encrypted)
    const memoContent = "My morning routine has been evolving. I started meditation at 7 AM followed by a 20-minute workout. It significantly improves my focus for the rest of the day.";
    const encryptedMemo = encryptionService.encrypt(memoContent, mdk);
    
    await Entry.create({
      userId: user._id,
      content: encryptedMemo,
      title: 'Morning Routine Findings',
      tags: [tag._id],
      isPublic: false
    });

    // 3. Create a Goal (Encrypted)
    const goalDescription = "Achieve a consistent state of flow during deep work sessions by the end of Q2.";
    const encryptedGoal = encryptionService.encrypt(goalDescription, mdk);

    await Goal.create({
      userId: user._id,
      name: 'Professional Growth: Deep Work',
      description: encryptedGoal,
      status: 'active',
      priority: 'high'
    });

    console.log('\n-----------------------------------');
    console.log('🚀 REVIEWER ENVIRONMENT READY');
    console.log('-----------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Vault PIN: ${pin}`);
    console.log('-----------------------------------');
    console.log('\nSAMPLE DATA CREATED:');
    console.log('- Tag: research');
    console.log('- Memo: Morning Routine Findings');
    console.log('- Goal: Professional Growth: Deep Work');
    console.log('-----------------------------------');

  } catch (error) {
    console.error('Error setting up reviewer account:', error);
  } finally {
    await database.disconnect();
    process.exit(0);
  }
}

setupReviewerAccount();
