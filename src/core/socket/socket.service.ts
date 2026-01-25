import { Server as SocketServer } from 'socket.io';
import { logger } from '../../config/logger';
import { SocketEvents, UserRoleType } from './socket.types';

class SocketService {
    private static instance: SocketService;
    private _io: SocketServer | null = null;

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

    public get io(): SocketServer {
        if (!this._io) {
            throw new Error('Socket.io is not initialized. Call setIo first.');
        }
        return this._io;
    }

    /**
     * Emit to all connected clients
     */
    public emitAll(event: SocketEvents, data: any): void {
        this.io.emit(event, data);
    }

    /**
     * Emit to a specific user
     */
    public emitToUser(userId: string, event: SocketEvents, data: any): void {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    /**
     * Emit to a specific role
     */
    public emitToRole(role: UserRoleType, event: SocketEvents, data: any): void {
        this.io.to(`role:${role}`).emit(event, data);
    }

    /**
     * Emit to a specific room
     */
    public emitToRoom(room: string, event: SocketEvents, data: any): void {
        this.io.to(room).emit(event, data);
    }
}

export const socketService = SocketService.getInstance();
