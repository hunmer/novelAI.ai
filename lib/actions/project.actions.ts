'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { createProjectSchema, type CreateProjectInput } from '@/lib/validations/project';

export async function createProject(input: CreateProjectInput) {
  const validated = createProjectSchema.parse(input);

  const project = await prisma.project.create({
    data: {
      name: validated.name,
      description: validated.description,
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
  const project = await prisma.project.update({
    where: { id },
    data: input,
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
