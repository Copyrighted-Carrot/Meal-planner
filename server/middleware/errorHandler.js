const errorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Server Error";

    // Only log full stack trace for 500 (unknown errors) or if not operational
    if (statusCode === 500) {
        console.error("🔥 Global Error Handler:", err);
    }

    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Max size is 1MB." });
    }

    res.status(statusCode).json({
        message,
        // Only show stack in dev and if it's a 500 (crash)
        error: process.env.NODE_ENV === "production" ? undefined : (statusCode === 500 ? err : undefined),
    });
};

module.exports = errorHandler;
