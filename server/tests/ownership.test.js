const { checkOwnership } = require('../utils/permissions');
const AppError = require('../utils/AppError');

describe('Ownership Policy (Permissions)', () => {

    test('should return true if user owns the resource', () => {
        const resource = { user: '123' };
        expect(checkOwnership(resource, '123')).toBe(true);
    });

    test('should throw 404 if resource does not exist', () => {
        expect(() => checkOwnership(null, '123')).toThrow(AppError);
        try {
            checkOwnership(null, '123');
        } catch (err) {
            expect(err.statusCode).toBe(404);
            expect(err.message).toBe('No document found with that ID');
        }
    });

    test('should throw 404 (NOT 403) if user does not own resource', () => {
        const resource = { user: 'ownerId' };
        try {
            checkOwnership(resource, 'hackerId');
        } catch (err) {
            expect(err.statusCode).toBe(404);
            expect(err.message).toBe('No document found with that ID');
        }
    });

    // Test for ObjectIds equality logic if inputs are objects (mocks usually string, but ensure toString() called)
    test('should handle ObjectId objects correctly', () => {
        const resource = { user: { toString: () => '123' } };
        expect(checkOwnership(resource, '123')).toBe(true);
    });
});
