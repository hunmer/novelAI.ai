'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { createProjectSchema, type CreateProjectInput } from '@/lib/validations/project';
import type { Prisma } from '@prisma/client';

function serializeTags(tags?: string[] | null) {
  if (!tags || tags.length === 0) return null;
  const sanitized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return sanitized.length > 0 ? sanitized.join(',') : null;
}

export async function createProject(input: CreateProjectInput) {
  const validated = createProjectSchema.parse(input);

  const project = await prisma.project.create({
    data: {
      name: validated.name,
      description: validated.description,
      author: validated.author,
      coverImage: validated.coverImage,
      tags: serializeTags(validated.tags),
    },
  });

  revalidatePath('/');
  return { success: true, data: project };
}

export async function getProjects() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return projects;
}

export async function getProjectById(id: string) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      characters: true,
      scenes: true,
      dialogs: true,
      assets: true,
    },
  });
  return project;
}

export async function updateProject(id: string, input: Partial<CreateProjectInput>) {
  const validated = createProjectSchema.partial().parse(input);

  const data: Prisma.ProjectUpdateInput = {};

  if (validated.name !== undefined) {
    data.name = validated.name;
  }
  if (validated.description !== undefined) {
    data.description = validated.description;
  }
  if (validated.author !== undefined) {
    data.author = validated.author;
  }
  if (validated.coverImage !== undefined) {
    data.coverImage = validated.coverImage;
  }
  if (validated.tags !== undefined) {
    data.tags = serializeTags(validated.tags);
  }

  const project = await prisma.project.update({
    where: { id },
    data,
  });

  revalidatePath('/');
  revalidatePath(`/project/${id}`);
  return { success: true, data: project };
}

export async function deleteProject(id: string) {
  await prisma.project.delete({
    where: { id },
  });

  revalidatePath('/');
  return { success: true };
}
