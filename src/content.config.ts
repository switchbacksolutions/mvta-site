import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    /** Post title — shown in listings, <title>, and OG tags */
    title: z.string(),

    /** Short description for SEO meta and post cards (aim for 150–160 chars) */
    description: z.string(),

    /** ISO 8601 publication date */
    pubDate: z.coerce.date(),

    /** ISO 8601 date of last meaningful edit — optional */
    updatedDate: z.coerce.date().optional(),

    /** Relative or absolute URL to the hero / banner image — optional */
    heroImage: z.string().optional(),

    /** Categorisation tags, e.g. ["astro", "typescript"] */
    tags: z.array(z.string()).default([]),

    /** When true the post is excluded from builds and the RSS feed */
    draft: z.boolean().default(false),
  }),
});

const trails = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/trails' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    heroImage: z.string().optional(),
    trailType: z.enum(['Loop', 'Out and Back', 'Point to Point']),
    distance: z.string().optional(),
    difficulty: z.enum(['Easy', 'Moderate', 'Challenging']),
    uses: z.array(z.string()).default([]),
    access: z.string().optional(),
    directionsUrl: z.string().optional(),
    mapUrl: z.string().optional(),
    amenities: z.array(z.string()).default([]),
    galleryImages: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});

export const collections = { blog, trails };
