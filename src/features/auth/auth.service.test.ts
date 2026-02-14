
import { emailService } from '../../config/email';
import { User } from './auth.model';
import { authService } from './auth.service';
import { Otp } from './otp.model';

jest.mock('./auth.model');
jest.mock('./otp.model');
jest.mock('../../config/email');
jest.mock('../../core/utils/crypto');
jest.mock('../../config/logger');

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user', async () => {
            const userData = { email: 'test@example.com', password: 'password', name: 'Test User' };
            const hashedPassword = 'hashedPassword';
            const otpCode = '123456';

            (User.findByEmail as jest.Mock).mockResolvedValue(null);
            (Crypto.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
            (Otp.generateOtp as jest.Mock).mockResolvedValue(otpCode);
            (emailService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);

            const mockSave = jest.fn().mockResolvedValue({
                _id: 'user123',
                ...userData,
                password: hashedPassword
            });

            (User as unknown as jest.Mock).mockImplementation(() => ({
                save: mockSave,
                _id: 'user123',
                email: userData.email
            }));

            await authService.register(userData);

            expect(User.findByEmail).toHaveBeenCalledWith(userData.email);
            expect(mockSave).toHaveBeenCalled();
            expect(emailService.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should throw if user exists', async () => {
            (User.findByEmail as jest.Mock).mockResolvedValue({ _id: 'existing' });
            await expect(authService.register({ email: 'e', password: 'p', name: 'n' }))
                .rejects.toThrow('User with this email already exists');
        });
    });

    describe('login', () => {
        it('should login user with valid credentials', async () => {
            const credentials = { email: 'test@example.com', password: 'password' };
            const mockUser = {
                _id: 'user123',
                email: 'test@example.com',
                password: 'hashedPassword',
                role: 'user',
                save: jest.fn(),
                toJSON: jest.fn().mockReturnValue({ id: 'user123' })
            };

            const selectMock = jest.fn().mockResolvedValue(mockUser);
            (User.findOne as jest.Mock).mockReturnValue({ select: selectMock });
            (Crypto.comparePassword as jest.Mock).mockResolvedValue(true);
            (Crypto.generateAccessToken as jest.Mock).mockReturnValue('access');
            (Crypto.generateRefreshToken as jest.Mock).mockReturnValue('refresh');

            const result = await authService.login(credentials);

            expect(result.accessToken).toBe('access');
            expect(mockUser.save).toHaveBeenCalled(); // updates last login
        });
    });
});
