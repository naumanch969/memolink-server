import { IUser } from "../../features/auth/auth.types";

// Add static methods to the interface
declare global {
     
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}
