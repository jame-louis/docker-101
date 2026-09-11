import { defineCollection, z } from 'astro:content';

// Lecture fields are the ones actually rendered on the list/detail pages.
// Anything an author wants to say beyond this belongs in the Markdown body.
const lectures = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    lectureNumber: z.number(),
    slidevUrl: z.string().optional(), // online slides; shows a "课件" link on the homepage schedule
    draft: z.boolean().default(false),
  }),
});

const assignments = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    assignmentNumber: z.number(),
    lectureRef: z.string(), // Matches lecture slug (e.g., "lecture01"); the assignment's detail page links back to this lecture
    submissionFormat: z.string().default('学号-HWxx.zip'),
    downloadFile: z.string().optional(),
    dueDate: z.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  lectures,
  assignments,
};
