
import { Person } from './person.model';
import { PersonService } from './person.service';

jest.mock('./person.model', () => {
    const mockPerson = jest.fn();
    (mockPerson as any).findOne = jest.fn();
    (mockPerson as any).find = jest.fn();
    (mockPerson as any).findOneAndUpdate = jest.fn();
    (mockPerson as any).countDocuments = jest.fn();
    return { Person: mockPerson };
});

jest.mock('../../config/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('PersonService', () => {
    let personService: PersonService;

    beforeEach(() => {
        jest.clearAllMocks();
        personService = new PersonService();
    });

    describe('createPerson', () => {
        it('should create a person if not duplicate', async () => {
            const userId = '507f1f77bcf86cd799439011';
            const personData = { name: 'John Doe', email: 'john@example.com' };

            (Person.findOne as jest.Mock).mockResolvedValue(null);

            const mockSave = jest.fn().mockResolvedValue({ ...personData, _id: '507f1f77bcf86cd799439013' });
            (Person as unknown as jest.Mock).mockImplementation((args) => ({
                ...args,
                save: mockSave,
            }));

            const result = await personService.createPerson(userId, personData);

            expect(Person.findOne).toHaveBeenCalled();
            expect(mockSave).toHaveBeenCalled();
            expect(result).toHaveProperty('name', 'John Doe');
        });

        it('should throw error if person exists', async () => {
            (Person.findOne as jest.Mock).mockResolvedValue({ _id: '507f1f77bcf86cd799439099' });

            await expect(personService.createPerson('507f1f77bcf86cd799439011', { name: 'John' }))
                .rejects.toThrow();
        });
    });

    describe('getPersonById', () => {
        it('should return person if found', async () => {
            const mockPerson = { _id: '507f1f77bcf86cd799439013', name: 'John' };
            (Person.findOne as jest.Mock).mockResolvedValue(mockPerson);

            const result = await personService.getPersonById('507f1f77bcf86cd799439013', '507f1f77bcf86cd799439011');
            expect(result).toEqual(mockPerson);
        });

        it('should throw if not found', async () => {
            (Person.findOne as jest.Mock).mockResolvedValue(null);
            await expect(personService.getPersonById('507f1f77bcf86cd799439013', '507f1f77bcf86cd799439011')).rejects.toThrow('Person not found');
        });
    });
});
