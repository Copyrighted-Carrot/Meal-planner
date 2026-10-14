const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();
const cors = require("cors");

// Initialize Express App
const app = express();

// Middleware
app.use(express.json({ limit: "10kb" })); // Enable JSON body parsing with limit
app.use(cors()); // Enable CORS for frontend communication

// Security Middleware
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const securityMiddleware = require("./middleware/security");

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Relaxed limit for dev/testing (was 100)
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

// Apply Data Sanitization
securityMiddleware(app);

// Connect to Database
connectDB();

// Import Routes
const mealRoutes = require("./routes/mealRoutes");
const authRoutes = require("./routes/authRoutes");
const planRoutes = require("./routes/planRoutes");

// Use Routes
app.use("/api/auth", authRoutes);
app.use("/api/meals", mealRoutes);
app.use("/api/plan", planRoutes);
app.use('/api/grocery', require('./routes/groceryRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Root Route (Test API)
app.get("/", (req, res) => {
  res.send("✅ Meal Planner API is running...");
});

// Global Error Handler
const errorHandler = require("./middleware/errorHandler");

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// Process Safety: Handle Unhandled Rejections
process.on('unhandledRejection', (err) => {
  console.error('🔥 UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Process Safety: Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
