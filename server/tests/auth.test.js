const authService = require('../services/authService');
const AppError = require('../utils/AppError');
const User = require('../models/User');

jest.mock('../models/User');
jest.mock('google-auth-library', () => {
    return {
        OAuth2Client: jest.fn().mockImplementation(() => {
            return { verifyIdToken: jest.fn() };
        })
    };
});

describe('Auth Service Unit Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('register should throw error if user exists', async () => {
        User.findOne.mockResolvedValue({ email: 'test@test.com' }); // Mock existing user
        await expect(authService.register({
            name: 'Test', email: 'test@test.com', password: 'password'
        })).rejects.toThrow(AppError);
    });

    test('login should throw error if user not found', async () => {
        User.findOne.mockResolvedValue(null);
        await expect(authService.login({
            email: 'missing@test.com', password: 'password'
        })).rejects.toThrow('Invalid Credentials');
    });
});
