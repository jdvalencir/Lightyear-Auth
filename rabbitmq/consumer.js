import amqp from 'amqplib'
import { sendPasswordResetEmail, createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '../config/firebase.config.js'
import crypto from 'crypto'; // Import the crypto module
import axios from 'axios';

import { getLogger } from '../logger/logger.js'

const rmqUser = process.env.RMQ_USER || 'user'
const rmqPass = process.env.RMQ_PASS || 'password'
const rmqPort = process.env.RMQ_PORT || 5672
const rmqHost = process.env.RMQ_HOST || 'localhost'

const logger = getLogger()

class RabbitMQConsumer {
    constructor () {
        this.connection = null
        this.channel = null
    }

    async connect () {
        try {
            const url = `amqp://${rmqUser}:${rmqPass}@${rmqHost}:${rmqPort}`
            this.connection = await amqp.connect(url)
            this.channel = await this.connection.createChannel()
            logger.info('RabbitMQ connected')
        } catch (error) {
            logger.error('RabbitMQ connection error:', error)
            throw error
        }
    }

    async consume (queue) {
        try {
            await this.channel.assertQueue(queue, { durable: true })
            this.channel.consume(queue, async (msg) => {
                if (!msg) return 

                try { 
                    const data = JSON.parse(msg.content.toString())

                    const {
                        email,
                        firstName,
                        secondName,
                        lastName,
                        secondLastName,
                      } = data

                      const fullName = [firstName, secondName, lastName, secondLastName]
                      .filter(Boolean)
                      .join(' ')


                    logger.info(`Received message email: ${email}, fullName: ${fullName}`)

                    // Generate a temporary random password
                    const temporaryPassword = crypto.randomBytes(16).toString('hex'); 

                    // Use the temporary password for user creation
                    await createUserWithEmailAndPassword(auth, email, temporaryPassword) 
                    
                    logger.info(`User created with email: ${email}`)

                    try {
                        await sendPasswordResetEmail(auth, email)
                        logger.info(`Password reset email sent to ${email}`)
                    } catch (error) {
                        logger.error(`Error sending password reset email to ${email}:`, error)
                    }

                    const url = `http://mrpotato-adapter-service.mrpotato-adapter.svc.cluster.local/v1/adapter/registerCitizen`

                    const body = {
                        id: data.id,
                        name: fullName,
                        address: data.address,
                        email: email,
                        operatorId: "681466aaedee130015720b44",
                        operatorName: "Operador Marcianos"
                    }

                    const headers = {
                        'Content-Type': 'application/json',
                    }

                    const response = await axios.post(url, body, { headers })
                    
                    if (response.data && response.status === 201 && response.data.registered) {
                        logger.info(`Citizen registered successfully: ${response.data.registered}`)
                    } else {
                        logger.error(`Failed to register citizen: ${response.status} - ${response.statusText}`)
                        throw new Error(`Failed to register citizen: ${response.status} - ${response.statusText}`)
                    }
                    this.channel.ack(msg)
                } catch (error) {
                    // Log the specific Firebase error if available
                    if (error.code && error.message) {
                         logger.error(`Firebase Error (${error.code}): ${error.message}`);
                    } else {
                        logger.error('Error processing message:', error)
                    }
                    // Acknowledge the message even if processing fails to prevent reprocessing loop
                    // Consider moving to a dead-letter queue for failed messages in production
                    return this.channel.ack(msg) 
                }
            })
        } catch (error) {
            logger.error('RabbitMQ consume error:', error)
        }
    }

    async close () {
        try {
            await this.channel.close()
            await this.connection.close()
            logger.info('RabbitMQ connection closed')
        } catch (error) {
            logger.error('RabbitMQ close error:', error)
            throw error
        }
    }

    async publish (queue, data) {
        try {
            await this.channel.assertQueue(queue, { durable: true })
            this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), { persistent: true })
            logger.info('Message published:', data)
        } catch (error) {
            logger.error('RabbitMQ publish error:', error)
            throw error
        }
    }
}

export const rabbitMQConsumer = new RabbitMQConsumer()