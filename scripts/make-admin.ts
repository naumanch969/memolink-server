
import mongoose from 'mongoose';
import User from '../src/features/auth/auth.model';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const makeAdmin = async () => {
    const email = process.argv[2];

    if (!email) {
        console.error('Please provide an email address as an argument.');
        console.log('Usage: npx ts-node scripts/make-admin.ts <email>');
        process.exit(1);
    }

    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error("MONGODB_URI is not defined in .env");
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB.');

        const user = await User.findOne({ email });

        if (!user) {
            console.error(`User with email "${email}" not found.`);
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();

        console.log(`Successfully updated user "${user.name}" (${user.email}) to role "admin".`);
        console.log('IMPORTANT: The user must Log Out and Log In again for changes to take effect.');

    } catch (error) {
        console.error('Error updating user:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB.');
        process.exit(0);
    }
};

makeAdmin();
