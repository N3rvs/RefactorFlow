// This file uses server-side code.
'use server';

/**
 * @fileOverview Explains SQL refactoring scripts using AI.
 *
 * - explainSql - A function that explains the SQL scripts.
 * - ExplainSqlInput - The input type for the explainSql function.
 * - ExplainSqlOutput - The return type for the explainSql function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainSqlInputSchema = z.object({
  sqlScript: z.string().describe('The SQL script to explain.'),
});
export type ExplainSqlInput = z.infer<typeof ExplainSqlInputSchema>;

const ExplainSqlOutputSchema = z.object({
  explanation: z.string().describe('The explanation of the SQL script.'),
});
export type ExplainSqlOutput = z.infer<typeof ExplainSqlOutputSchema>;

export async function explainSql(input: ExplainSqlInput): Promise<ExplainSqlOutput> {
  return explainSqlFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainSqlPrompt',
  input: {schema: ExplainSqlInputSchema},
  output: {schema: ExplainSqlOutputSchema},
  prompt: `You are an expert database administrator.  Explain the following SQL script in clear, concise terms that a database administrator can understand.\n\nSQL Script:\n{{sqlScript}}`,
});

const explainSqlFlow = ai.defineFlow(
  {
    name: 'explainSqlFlow',
    inputSchema: ExplainSqlInputSchema,
    outputSchema: ExplainSqlOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
