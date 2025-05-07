import { signInWithEmailAndPassword } from "firebase/auth";
import { getLogger } from "./logger/logger.js";
import { sequelize } from "./config/db.config.js";
import { User } from "./models/User.js";
import { auth } from "./config/firebase.config.js";
import express from "express";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

const logger = getLogger();

if (process.env.NODE_ENV === "development") {
  process.loadEnvFile(".env");
}

const port = process.env.PORT || 3000;

app.get("/v1/users/me", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.decode(token);

  const userId = decoded?.user_id || decoded?.sub;
  console.log("User ID from token:", userId);

  if (!userId) {
    return res.status(401).json({ error: "User ID not found in token" });
  }

  try {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    logger.error("Error fetching user:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/v1/users/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const response = await signInWithEmailAndPassword(auth, email, password);
    const { user } = response;
    const {
      uid,
      displayName,
      photoURL,
      emailVerified,
      providerData,
      metadata,
      refreshToken,
      accessToken,
      apiKey,
      tenantId,
      isAnonymous,
      phoneNumber,
    } = user;

    // Extract nested properties safely
    const { lastLoginAt, createdAt } = metadata || {};
    const providerId = providerData?.[0]?.providerId;
    const authDomain = user.auth?.config?.authDomain;

    // Construct the response object
    const responsePayload = {
      uid,
      email: user.email,
      displayName,
      photoURL,
      emailVerified,
      providerData,
      metadata,
      refreshToken,
      accessToken,
      apiKey,
      authDomain,
      tenantId,
      lastLoginAt,
      createdAt,
      providerId,
      isAnonymous,
      phoneNumber,
    };

    res.json(responsePayload);
  } catch (err) {
    logger.error("Error during login:", err);
    const errorMessage = err.code
      ? `Firebase Error: ${err.code}`
      : "Invalid credentials";
    res.status(401).json({ error: errorMessage });
  }
});

app.listen(port, async () => {
  try {
    await sequelize.authenticate();
    logger.info("Database connection has been established successfully.");
    logger.info("Database synchronized successfully.");
  } catch (error) {
    logger.error("Unable to connect to the database:", error);
  }
  logger.info(`Server is running on port ${port}`);
});
