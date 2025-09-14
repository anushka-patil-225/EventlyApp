// UserService: handles user registration, login, profile, and admin user management.

import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import { signJwtForUser } from "../middleware/auth";
import { Not } from "typeorm";

export class UserService {
  private userRepo = AppDataSource.getRepository(User);

  // Create a new user (returns safe user + JWT token)
  async createUser(
    data: Partial<User>
  ): Promise<{ user: Omit<User, "password">; token: string }> {
    if (!data.email || !data.password || !data.name) {
      throw new Error("name, email and password are required");
    }

    // Check if email already exists
    const existing = await this.userRepo.findOne({
      where: { email: data.email },
      select: ["id"],
    });
    if (existing) {
      throw new Error("Email already in use");
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(String(data.password), 10);
    const userToSave = this.userRepo.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role || "user",
    } as User);

    const saved = await this.userRepo.save(userToSave);

    // Remove password before returning user
    const { password, ...safeUser } = saved as any;

    // Generate JWT for authentication
    const token = signJwtForUser({
      id: saved.id,
      email: saved.email,
      role: saved.role,
    });
    return { user: safeUser, token };
  }

  // Login user (returns safe user + JWT token)
  async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<User, "password">; token: string }> {
    // Fetch only needed fields
    const user = await this.userRepo.findOne({
      where: { email },
      select: ["id", "email", "password", "role", "name"],
      cache: true,
    });
    if (!user) throw new Error("Invalid credentials");

    // Validate password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Invalid credentials");

    // Strip password before returning
    const { password: _p, ...safeUser } = user as any;

    // Generate JWT
    const token = signJwtForUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { user: safeUser, token };
  }

  // Get user by ID (with bookings and events)
  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ["bookings", "bookings.event"],
      cache: true,
    });
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      cache: true,
    });
  }

  // Get all users (admin only, strips password)
  async getAllUsers(): Promise<User[]> {
    const users = await this.userRepo.find({
      relations: ["bookings"],
      order: { id: "ASC" },
    });

    return users.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    }) as unknown as User[];
  }

  // Update user (rehashes password if provided)
  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) return null;

    const { password: newPassword, ...rest } = updates as any;
    Object.assign(user, rest);

    if (newPassword) {
      user.password = await bcrypt.hash(String(newPassword), 10);
    }

    const saved = await this.userRepo.save(user);
    const { password: _p, ...safe } = saved as any;
    return safe as unknown as User;
  }

  // Delete user by ID
  async deleteUser(id: number): Promise<boolean> {
    const result = await this.userRepo.delete(id);
    return result.affected !== 0;
  }
}

export default UserService;
