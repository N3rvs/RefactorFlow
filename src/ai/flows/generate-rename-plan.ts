// This file is machine-generated - edit at your own risk!

'use server';

/**
 * @fileOverview An AI agent that can automatically generate a database refactoring plan from natural language.
 *
 * - generateRenamePlan - A function that generates a database refactoring plan in JSON format.
 * - GenerateRenamePlanInput - The input type for the generateRenamePlan function.
 * - GenerateRenamePlanOutput - The return type for the generateRenamePlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRenamePlanInputSchema = z.object({
  description: z
    .string()
    .describe(
      'A description of the desired database schema changes in natural language.'
    ),
});
export type GenerateRenamePlanInput = z.infer<typeof GenerateRenamePlanInputSchema>;

const GenerateRenamePlanOutputSchema = z.object({
  plan: z
    .string()
    .describe(
      'A JSON string representing the database refactoring plan, including renames for tables and columns.'
    ),
});
export type GenerateRenamePlanOutput = z.infer<typeof GenerateRenamePlanOutputSchema>;

export async function generateRenamePlan(input: GenerateRenamePlanInput): Promise<GenerateRenamePlanOutput> {
  return generateRenamePlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRenamePlanPrompt',
  input: {schema: GenerateRenamePlanInputSchema},
  output: {schema: GenerateRenamePlanOutputSchema},
  prompt: `You are a database administrator expert.

  You will generate a database refactoring plan in JSON format based on the user's description of the desired schema changes.
  The plan should include renames for tables and columns.

  Ensure the generated JSON is valid and follows this schema:
  {
    "renames": [
      { "scope":"column|table", "tableFrom":"...", "tableTo":"...", "columnFrom":"...", "columnTo":"...", "type":"..." }
    ]
  }

  Description: {{{description}}}
  `,
});

const generateRenamePlanFlow = ai.defineFlow(
  {
    name: 'generateRenamePlanFlow',
    inputSchema: GenerateRenamePlanInputSchema,
    outputSchema: GenerateRenamePlanOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
