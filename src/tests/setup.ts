

// Connect to a test database in-memory logic or dedicated test DB
// For smoke tests not using a real DB, we might mock specific calls or just assume
// the service logic is pure enough for unit-testing.
// But since we want to test "Features", we should ideally mock Mongoose models or use mongodb-memory-server.
// Given constraints, I will create basic unit tests that mock the Mongoose models' generic behavior

export const mockMongooseModel = () => ({
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findById: jest.fn().mockReturnThis(),
    findOneAndUpdate: jest.fn().mockReturnThis(),
    findOneAndDelete: jest.fn().mockReturnThis(),
    create: jest.fn().mockReturnThis(),
    save: jest.fn().mockResolvedValue(true),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
    countDocuments: jest.fn().mockResolvedValue(0),
});
