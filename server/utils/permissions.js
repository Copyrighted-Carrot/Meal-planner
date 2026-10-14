const AppError = require('./AppError');

/**
 * Checks if the resource belongs to the user.
 * Throws 404 if not found or if ownership mismatch (to prevent ID enumeration).
 * @param {Object} resource - The database document (must have 'user' field).
 * @param {string} userId - The ID of the authenticated user.
 */
const checkOwnership = (resource, userId) => {
    if (!resource) {
        throw new AppError('No document found with that ID', 404);
    }

    // Handle potential ObjectId objects
    const ownerId = resource.user ? resource.user.toString() : null;
    const currentUserId = userId ? userId.toString() : null;

    if (ownerId !== currentUserId) {
        // 404 Policy: Do not leak existence of resource
        throw new AppError('No document found with that ID', 404);
    }

    return true;
};

module.exports = { checkOwnership };
