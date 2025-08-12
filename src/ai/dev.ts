import { config } from 'dotenv';
config();

import '@/ai/flows/generate-rename-plan.ts';
import '@/ai/flows/suggest-code-fixes.ts';
import '@/ai/flows/explain-sql.ts';