# Lightyear-Auth

Lightyear Auth is a small Node.js (Express) microservice for user authentication. It validates email and password credentials against Firebase Authentication and serves user profile records stored in PostgreSQL. It is meant to run as one service in a larger microservices setup (the Kubernetes manifests refer to a "marcianos" cluster and database).

## Features

- `POST /v1/users/login`: signs in with email and password through the Firebase client SDK and returns the Firebase user data (uid, email, tokens, provider data, metadata). On failure it returns `401` with the Firebase error code.
- `GET /v1/users/me`: reads a `Bearer` token from the `Authorization` header, takes the user id from the token (`user_id` or `sub`) and returns the matching user from PostgreSQL. The token is decoded with `jsonwebtoken`, but its signature is not verified.
- `GET /v1/users/all`: lists all users in the database. This route has no authentication.
- Winston logging to the console and to `logger/logs/app.log`.
- Dockerfile, Kubernetes Deployment and Service manifests, and a GitHub Actions workflow that builds the image, pushes it to Docker Hub and deploys to GKE.

## Tech stack

- Node.js (ES modules), Express 5, CORS
- Firebase JS SDK (`firebase`; `firebase-admin` is listed as a dependency but not used in the code)
- Sequelize with PostgreSQL (`pg`)
- Winston, jsonwebtoken, axios
- `amqplib` and `cookie-parser` are also listed as dependencies but not used in the code
- Docker, Kubernetes, GitHub Actions

## Project structure

```
index.js                   Express app and routes
config/db.config.js        Sequelize connection (PostgreSQL)
config/firebase.config.js  Firebase client initialization
models/User.js             User model
logger/logger.js           Winston logger
k8s/                       Deployment and Service manifests
.github/workflows/         Build and deploy pipeline
Dockerfile
```

## Getting started

Requirements: Node.js with `process.loadEnvFile` support (v20.12 or later), a PostgreSQL database and a Firebase project.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root (it is loaded when `NODE_ENV=development`) with these variables:

   ```
   PORT=3000
   DB_HOST=
   DB_NAME=
   DB_USER=
   DB_PASS=
   FIREBASE_API_KEY=
   FIREBASE_AUTH_DOMAIN=
   FIREBASE_PROJECT_ID=
   FIREBASE_STORAGE_BUCKET=
   FIREBASE_MESSAGING_SENDER_ID=
   FIREBASE_APP_ID=
   ```

3. Run the service:

   ```bash
   npm run dev     # development, with file watching
   npm start       # plain node index.js
   ```

The `user` table is not created by the code (there is no `sync` call), so it must exist in the database.

Docker:

```bash
docker build -t lightyear-auth .
docker run -p 3000:3000 --env-file .env lightyear-auth
```

There are no automated tests (`npm test` is a placeholder).

## Context

Part of a microservices project from the "Marcianos Team" (per `package.json`). The `RabbitMQ` keyword and the `amqplib` dependency suggest planned messaging, but the code does not use it yet.

## License

The repository contains the Apache License 2.0 text in `LICENSE`; `package.json` declares ISC.
