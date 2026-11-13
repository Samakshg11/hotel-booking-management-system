const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5001),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/hotel_management?replicaSet=rs0'),
  JWT_SECRET: z.string().min(16).default('super_secret_jwt_key_for_takehome_demo_only_min_32_characters_long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  HOLD_MINUTES: z.coerce.number().int().positive().default(10),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.12),
  ALLOW_EARLY_CHECKIN: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;

