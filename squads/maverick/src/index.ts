// Ponto de entrada do Squad Maverick
import { z } from 'zod';

console.log("🦅 Maverick Squad Environment Loaded");

// Exemplo de interface baseada na task analyze-profile-structure
export const ProfileStructureSchema = z.object({
    username: z.string(),
    bio_text: z.string(),
    has_highlights: z.boolean(),
    highlights_structure: z.array(z.string()),
    key_highlight_summary: z.string().optional(),
    inferred_promise: z.string()
});

export type ProfileStructure = z.infer<typeof ProfileStructureSchema>;
