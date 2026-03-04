import { emailService } from '../../config/email.service';
import { cryptoService } from '../../core/crypto/crypto.service';
import { User } from './auth.model';
import { authService } from './auth.service';
import { Otp } from './otp.model';
import { vaultService } from './vault.service';

jest.mock('./auth.model');
jest.mock('./otp.model');
jest.mock('./vault.service');
jest.mock('../../config/email.service');
jest.mock('../../core/crypto/crypto.service');
jest.mock('../../config/logger');

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register a new user', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password',
                name: 'Test User',
                securityQuestion: 'Who?',
                securityAnswer: 'Me'
            };
            const hashedPassword = 'hashedPassword';
            const otpCode = '123456';

            (User.findByEmail as jest.Mock).mockResolvedValue(null);
            (cryptoService.hashPassword as jest.Mock).mockResolvedValue(hashedPassword);
            (Otp.generateOtp as jest.Mock).mockResolvedValue(otpCode);
            (emailService.sendVerificationEmail as jest.Mock).mockResolvedValue(true);
            (vaultService.initializeVault as jest.Mock).mockResolvedValue({ recoveryPhrase: 'phrase', mdk: Buffer.alloc(32) });

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
            expect(vaultService.initializeVault).toHaveBeenCalled();
            expect(emailService.sendVerificationEmail).toHaveBeenCalled();
        });

        it('should throw if user exists', async () => {
            (User.findByEmail as jest.Mock).mockResolvedValue({ _id: 'existing' });
            await expect(authService.register({
                email: 'e',
                password: 'p',
                name: 'n',
                securityQuestion: 'q',
                securityAnswer: 'a'
            }))
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
                toJSON: jest.fn().mockReturnValue({ id: 'user123' }),
                vault: {
                    passwordSalt: 'salt',
                    wrappedMDK_password: 'wrapped'
                }
            };

            const selectMock = jest.fn().mockResolvedValue(mockUser);
            (User.findOne as jest.Mock).mockReturnValue({ select: selectMock });
            (cryptoService.comparePassword as jest.Mock).mockResolvedValue(true);
            (cryptoService.generateAccessToken as jest.Mock).mockReturnValue('access');
            (cryptoService.generateRefreshToken as jest.Mock).mockReturnValue('refresh');

            const result = await authService.login(credentials);

            expect(result.accessToken).toBe('access');
            expect(mockUser.save).toHaveBeenCalled();
        });
    });
});
