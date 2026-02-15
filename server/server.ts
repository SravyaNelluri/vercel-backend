import express, { Request, Response } from 'express';
import 'dotenv/config';
import cors from 'cors';    
import { getAuth } from './lib/auth.js';
import userRouter from './routes/userRouters.js';
import projectRouter from './routes/projectRoutes.js';
import testRouter from './routes/testRoutes.js';
import { stripeWebhook } from './controllers/stripeWebhook.js';

// Validate critical environment variables
const requiredEnvVars = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('[server] ERROR: Missing required environment variables:', missingEnvVars.join(', '));
}

// Log any crashes instead of silently exiting
process.on('unhandledRejection', (reason) => {
    console.error('[server] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[server] Uncaught exception:', err);
});

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = 3000;
const corsOptions ={
    origin: process.env.TRUSTED_ORIGINS?.split(',').map(origin => origin.trim()) || [],
    credentials:true,          
      //access-control-allow-credentials:true
}

app.use(cors(corsOptions));
app.post('/api/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

let authHandlerPromise: Promise<(req: Request, res: Response) => unknown> | null = null;
const getAuthHandler = async () => {
    if (!authHandlerPromise) {
        authHandlerPromise = (async () => {
            const auth = await getAuth();
            const { toNodeHandler } = await import('better-auth/node');
            return toNodeHandler(auth);
        })();
    }

    return authHandlerPromise;
};

app.all('/api/auth/*', async (req: Request, res: Response) => {
    const handler = await getAuthHandler();
    return handler(req, res);
});


app.use(express.json({ limit: '50mb' }));
app.get('/', (req: Request, res: Response) => {
    res.send('Server is Live!');
});
app.get('/api', (req: Request, res: Response) => {
    res.send('API is Live!');
});

// API Routes
app.use('/api/user', userRouter);
app.use('/api/project', projectRouter);
app.use('/api/test', testRouter);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
    console.error('[server] Error:', err);
    res.status(500).json({ 
        error: 'Internal Server Error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' 
    });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running at http://localhost:${port}`);
    });
}

// Export for Vercel
export default app;