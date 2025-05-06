import { signInWithEmailAndPassword } from 'firebase/auth'
import { rabbitMQConsumer } from './rabbitmq/consumer.js'
import { auth } from './config/firebase.config.js'
import express from 'express'
import { getLogger } from './logger/logger.js'
import cors from "cors";

const app = express()

app.use(express.json())
app.use(cors())

const logger = getLogger()

if (process.env.NODE_ENV === 'development') {
  process.loadEnvFile('.env');
}

const port = process.env.PORT || 3000

app.post('/v1/users/login', async (req, res) => {
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
    logger.error('Error during login:', err);
    // Provide a more specific error message if available
    const errorMessage = err.code ? `Firebase Error: ${err.code}` : 'Invalid credentials';
    res.status(401).json({ error: errorMessage });
  }
});

app.listen(port, async () => {
  await rabbitMQConsumer.connect()
  await rabbitMQConsumer.consume('registration-queue')
  logger.info(`Server is running on port ${port}`)
})
