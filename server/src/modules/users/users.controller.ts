import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
} from './users.service';

export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await getAllUsers();
    res.status(200).json({ success: true, data: users });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener usuarios' });
  }
};

export const getUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await getUserById(id as string);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al obtener usuario' });
  }
};

export const registerUserInDB = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, name, phone, role } = req.body;
    if (!email || !name || !role) {
      res.status(400).json({ message: 'Faltan campos requeridos' });
      return;
    }
    const user = await createUser({ email, name, phone, role });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Error al crear usuario' });
  }
};

export const updateUserData = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;
    const user = await updateUser(id as string, { name, phone });
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error al actualizar usuario' });
  }
};