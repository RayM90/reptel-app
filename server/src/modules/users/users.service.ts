/**
 * @file users.service.ts
 * @description Servicio de gestión de usuarios para RepTel API.
 * Maneja las operaciones CRUD de usuarios en la base de datos MySQL
 * mediante Prisma ORM. Los usuarios se autentican con AWS Cognito
 * pero sus datos se sincronizan en la BD local.
 * @module Users
 */

import prisma from '../../lib/prisma';

/**
 * Obtiene todos los usuarios del sistema
 * @returns Lista de usuarios sin el campo password
 */
export const getAllUsers = async () => {
  return prisma.user.findMany({
    select: {
      id: true,
      cognitoId: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      password: false, // Excluido por seguridad
    },
  });
};

/**
 * Obtiene un usuario por su ID interno
 * @param id - UUID del usuario en la BD
 * @returns Usuario encontrado o null
 */
export const getUserById = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      cognitoId: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      password: false, // Excluido por seguridad
    },
  });
};

/**
 * Obtiene un usuario por su ID de Cognito
 * @param cognitoId - ID del usuario en AWS Cognito
 * @returns Usuario encontrado o null
 */
export const getUserByCognitoId = async (cognitoId: string) => {
  return prisma.user.findUnique({
    where: { cognitoId },
  });
};

/**
 * Crea un nuevo usuario en la BD local sincronizado con Cognito
 * El password se marca como COGNITO_MANAGED ya que la autenticación
 * es manejada completamente por AWS Cognito
 * @param data - Datos del usuario a crear
 * @returns Usuario creado sin el campo password
 */
export const createUser = async (data: {
  cognitoId: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
}) => {
  const user = await prisma.user.create({
    data: {
      cognitoId: data.cognitoId,
      email: data.email,
      name: data.name,
      phone: data.phone,
      role: data.role as any,
      password: 'COGNITO_MANAGED', // La auth es manejada por Cognito
    },
  });

  // Excluir password de la respuesta
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Actualiza los datos de un usuario
 * @param id - UUID del usuario a actualizar
 * @param data - Campos a actualizar (name, phone)
 * @returns Usuario actualizado
 */
export const updateUser = async (
  id: string,
  data: { name?: string; phone?: string }
) => {
  return prisma.user.update({
    where: { id },
    data,
  });
};