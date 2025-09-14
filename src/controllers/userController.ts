import { Request, Response } from "express";
import { UserService } from "../services/userService";

const userService = new UserService();

// Create new user
export const createUser = async (req: Request, res: Response) => {
  try {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const user = await userService.getUserById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Get all users
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updatedUser = await userService.updateUser(id, req.body);
    if (!updatedUser) return res.status(404).json({ error: "User not found" });
    res.json(updatedUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await userService.deleteUser(id);
    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// User login
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const result = await userService.login(email, password);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
};
