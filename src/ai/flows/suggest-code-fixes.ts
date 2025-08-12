'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting code fixes based on a database refactoring plan.
 *
 * It exports:
 * - `suggestCodeFixes`: An async function that takes a database refactoring plan and suggests code fixes.
 * - `SuggestCodeFixesInput`: The input type for the `suggestCodeFixes` function.
 * - `SuggestCodeFixesOutput`: The output type for the `suggestCodeFixes` function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCodeFixesInputSchema = z.object({
  plan: z.object({
    renames: z.array(
      z.object({
        scope: z.enum(['column', 'table']),
        tableFrom: z.string(),
        columnFrom: z.string().optional(),
        tableTo: z.string().optional(),
        columnTo: z.string().optional(),
        type: z.string().optional(),
      })
    ),
  }).describe('The database refactoring plan containing rename operations.'),
  codebaseContext: z.string().describe('Context about the codebase to help the LLM make better suggestions.'),
});
export type SuggestCodeFixesInput = z.infer<typeof SuggestCodeFixesInputSchema>;

const SuggestCodeFixesOutputSchema = z.object({
  suggestions: z.array(z.string()).describe('An array of suggested code fixes.'),
});
export type SuggestCodeFixesOutput = z.infer<typeof SuggestCodeFixesOutputSchema>;

export async function suggestCodeFixes(input: SuggestCodeFixesInput): Promise<SuggestCodeFixesOutput> {
  return suggestCodeFixesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCodeFixesPrompt',
  input: {schema: SuggestCodeFixesInputSchema},
  output: {schema: SuggestCodeFixesOutputSchema},
  prompt: `You are a senior software developer helping a colleague refactor their codebase after a database refactoring.

  Based on the following database refactoring plan, suggest code changes that should be made.
  Refactoring Plan:
  {{JSON.stringify plan}}

  Here is some context about the codebase to help guide your suggestions:
  {{codebaseContext}}

  Please provide a list of specific code changes that should be made to align the codebase with the database changes.
  Consider changes to data models, queries, and any other code that interacts with the database.
  Return an array of suggestions.  Do not include any surrounding commentary.`,
});

const suggestCodeFixesFlow = ai.defineFlow(
  {
    name: 'suggestCodeFixesFlow',
    inputSchema: SuggestCodeFixesInputSchema,
    outputSchema: SuggestCodeFixesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
