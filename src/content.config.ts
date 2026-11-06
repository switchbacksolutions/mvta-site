import { defineCollection } from 'astro:content';
import { z } from 'zod';
import { glob } from 'astro/loaders';

const trails = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/trails' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    heroImage: z.string().optional(),
    trailType: z.enum(['Loop', 'Out and Back', 'Point to Point']),
    distance: z.string().optional(),
    difficulty: z.enum(['Easy', 'Moderate', 'Challenging']),
    area: z.enum(['Meadow Vista/Applegate', 'Weimar/Colfax', 'Auburn Area', 'Alta/Dutch Flat', 'High Country']),
    uses: z.array(z.string()).default([]),
    access: z.string().optional(),
    directionsUrl: z.string().optional(),
    mapUrl: z.string().optional(),
    amenities: z.array(z.string()).default([]),
    galleryImages: z.array(z.string()).default([]),
    notes: z.string().optional(),
  }),
});

const board = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/board' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    image: z.string().optional(),
    order: z.number().default(99),
  }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/newsletters' }),
  schema: z.object({
    title: z.string(),
    // CloudCannon can commit a draft entry (PDF uploaded, metadata not yet
    // filled in) with a blank pubDate. Falling back to "now" instead of
    // throwing keeps one incomplete draft from failing the entire site build.
    pubDate: z.coerce.date().catch(() => new Date()),
    pdfFile: z.string(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    location: z.string().optional(),
    description: z.string(),
  }),
});

export const collections = { trails, board, newsletters, events };
