import { Server as HttpServer } from 'http';
import { Socket, Server as SocketServer } from 'socket.io';
import { config } from '../../config/env';
import { logger } from '../../config/logger';
import { agentService } from '../../features/agent/services/agent.service';
import { cryptoService } from '../crypto/crypto.service';
import { socketService } from './socket.service';
import { SocketEvents } from './socket.types';


export class SocketManager {
    private io: SocketServer;

    constructor(server: HttpServer) {

        this.io = new SocketServer(server, {
            cors: {
                origin: process.env.CLIENT_URL || '*',
                methods: ['GET', 'POST'],
                credentials: true
            },
            pingTimeout: 60000,
            allowEIO3: true
        });

        // Initialize globally accessible service
        socketService.setIo(this.io);

        // Setup Redis Bridge for cross-process communication (Workers -> Server)
        this.initRedisBridge();

        // Setup middleware
        this.setupMiddleware();

        // Setup connection handlers
        this.setupHandlers();

        logger.info('SocketManager initialized');
    }

    private async initRedisBridge(): Promise<void> {
        try {
            const IORedis = (await import('ioredis')).default;
            const subscriber = new IORedis(config.REDIS_URL);

            socketService.initRedisBridge(subscriber);

            subscriber.on('error', (err) => {
                logger.error('Redis Bridge Subscriber Error:', err);
            });
        } catch (error) {
            logger.error('Failed to initialize Redis Socket Bridge:', error);
        }
    }

    private setupMiddleware(): void {
        this.io.use((socket: Socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization;

            if (!token) {
                logger.warn('Socket connection attempt without token');
                return next(new Error('Authentication error: Token missing'));
            }

            try {
                // Remove Bearer if present
                const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
                const decoded = cryptoService.verifyToken(cleanToken);

                // Attach user data to socket
                socket.data = {
                    userId: decoded.userId,
                    role: decoded.role
                };

                next();
            } catch (error) {
                logger.warn('Socket authentication failed:', error);
                next(new Error('Authentication error: Invalid token'));
            }
        });
    }

    private setupHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            const { userId, role } = socket.data;

            // Join personal room
            const userIdStr = userId.toString();
            socket.join(`user:${userIdStr}`);

            // Join role-based room
            if (role) {
                socket.join(`role:${role}`);
            }

            logger.info(`Socket connected: ${socket.id} (User: ${userIdStr}, Role: ${role})`);

            socket.on(SocketEvents.DISCONNECT, (reason) => {
                logger.info(`Socket disconnected: ${socket.id}. Reason: ${reason}`);
            });

            // Room management
            socket.on('join', (room: string) => {
                socket.join(room);
                logger.debug(`Socket ${socket.id} joined room: ${room}`);
            });

            socket.on('leave', (room: string) => {
                socket.leave(room);
                logger.debug(`Socket ${socket.id} left room: ${room}`);
            });

            // Partner AI Chat
            socket.on('partner:message', async (data: { message: string }) => {
                try {
                    const { message } = data;
                    if (!message) return;

                    // Notify start
                    socket.emit(SocketEvents.PARTNER_RESPONSE_START);

                    // Call agent service
                    await agentService.chatStream(userIdStr, message, (chunk) => {
                        socket.emit(SocketEvents.PARTNER_RESPONSE_CHUNK, { chunk });
                    });

                    // Notify end
                    socket.emit(SocketEvents.PARTNER_RESPONSE_END);

                } catch (error) {
                    logger.error('Socket partner:message failed', error);
                    socket.emit('error', { message: 'Failed to process AI response' });
                }
            });
        });
    }
}
