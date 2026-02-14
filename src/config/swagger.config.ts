import swaggerJSDoc from 'swagger-jsdoc';
import { config } from './env';

const swaggerOptions: swaggerJSDoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MemoLink API',
            version: '1.0.0',
            description: 'API documentation for MemoLink personal journaling and life tracking application',
        },
        servers: [
            {
                url: config.NODE_ENV === 'production'
                    ? 'https://memolink-server.fly.dev'
                    : `http://localhost:${config.PORT || 8080}`,
                description: config.NODE_ENV === 'production' ? 'Production server' : 'Development server',
            },
        ],
    },
    apis: [
        './src/docs/openapi/root.yaml',
        './src/docs/openapi/components/*.yaml',
        './src/docs/openapi/features/*.yaml',
    ],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);
