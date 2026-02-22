import { Server as SocketServer } from 'socket.io';
import { logger } from '../../config/logger';
import redisConnection from '../../config/redis';
import { SocketEvents, UserRoleType } from './socket.types';

class SocketService {
    private static instance: SocketService;
    private _io: SocketServer | null = null;
    private readonly REDIS_CHANNEL = 'SOCKET_BRIDGE';

    private constructor() { }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    public setIo(io: SocketServer): void {
        this._io = io;
        logger.info('Socket.io instance set in SocketService');
    }

    /**
     * Initializes a subscriber to listen for events from other processes (e.g., workers)
     */
    public initRedisBridge(subscriber: any): void {
        subscriber.subscribe(this.REDIS_CHANNEL, (err: any) => {
            if (err) {
                logger.error('Failed to subscribe to socket bridge channel', err);
                return;
            }
            logger.info('Subscribed to Socket Bridge channel');
        });

        subscriber.on('message', (channel: string, message: string) => {
            if (channel === this.REDIS_CHANNEL) {
                try {
                    const { target, event, userId, role, room, data } = JSON.parse(message);

                    if (!this._io) return;

                    switch (target) {
                        case 'all':
                            this._io.emit(event, data);
                            break;
                        case 'user':
                            this._io.to(`user:${userId}`).emit(event, data);
                            break;
                        case 'role':
                            this._io.to(`role:${role}`).emit(event, data);
                            break;
                        case 'room':
                            this._io.to(room).emit(event, data);
                            break;
                    }
                } catch (e) {
                    logger.error('Error handling socket bridge message', e);
                }
            }
        });
    }

    private publish(payload: any): void {
        redisConnection.publish(this.REDIS_CHANNEL, JSON.stringify(payload)).catch(err => {
            logger.error('Failed to publish to socket bridge', err);
        });
    }

    public get io(): SocketServer {
        if (!this._io) {
            // Instead of throwing, we return a proxy or just handle it in the emit methods
            // But to keep existing code working and just bridge it:
            return null as any;
        }
        return this._io;
    }

    /**
     * Emit to all connected clients
     */
    public emitAll(event: SocketEvents, data: any): void {
        if (this._io) {
            this._io.emit(event, data);
        } else {
            this.publish({ target: 'all', event, data });
        }
    }

    /**
     * Emit to a specific user
     */
    public emitToUser(userId: string, event: SocketEvents, data: any): void {
        if (this._io) {
            this._io.to(`user:${userId}`).emit(event, data);
        } else {
            this.publish({ target: 'user', userId, event, data });
        }
    }

    /**
     * Emit to a specific role
     */
    public emitToRole(role: UserRoleType, event: SocketEvents, data: any): void {
        if (this._io) {
            this._io.to(`role:${role}`).emit(event, data);
        } else {
            this.publish({ target: 'role', role, event, data });
        }
    }

    /**
     * Emit to a specific room
     */
    public emitToRoom(room: string, event: SocketEvents, data: any): void {
        if (this._io) {
            this._io.to(room).emit(event, data);
        } else {
            this.publish({ target: 'room', room, event, data });
        }
    }
}

export const socketService = SocketService.getInstance();
