import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";
import bcrypt from "bcrypt";
import { signJwtForUser } from "../middleware/auth";
import { Not } from "typeorm";

export class UserService {
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Create a new user
   */
  async createUser(
    data: Partial<User>
  ): Promise<{ user: Omit<User, "password">; token: string }> {
    if (!data.email || !data.password || !data.name) {
      throw new Error("name, email and password are required");
    }

    // ✅ Query optimized: select only email to check existence
    const existing = await this.userRepo.findOne({
      where: { email: data.email },
      select: ["id"],
    });
    if (existing) {
      throw new Error("Email already in use");
    }

    const hashedPassword = await bcrypt.hash(String(data.password), 10);
    const userToSave = this.userRepo.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: data.role || "user",
    } as User);

    const saved = await this.userRepo.save(userToSave);

    // ✅ strip password before returning
    const { password, ...safeUser } = saved as any;
    const token = signJwtForUser({
      id: saved.id,
      email: saved.email,
      role: saved.role,
    });
    return { user: safeUser, token };
  }

  /**
   * Login user
   */
  async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<User, "password">; token: string }> {
    // ✅ optimized select, don’t fetch extra fields
    const user = await this.userRepo.findOne({
      where: { email },
      select: ["id", "email", "password", "role", "name"],
      cache: true, // 🔹 cache frequent lookups
    });
    if (!user) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Invalid credentials");

    const { password: _p, ...safeUser } = user as any;
    const token = signJwtForUser({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    return { user: safeUser, token };
  }

  /**
   * Get a user by ID (with bookings)
   */
  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ["bookings", "bookings.event"],
      cache: true, // 🔹 users are often read
    });
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      cache: true,
    });
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    // ✅ only fetch what’s needed
    const users = await this.userRepo.find({
      relations: ["bookings"],
      order: { id: "ASC" },
    });

    return users.map((u: any) => {
      const { password, ...rest } = u;
      return rest;
    }) as unknown as User[];
  }

  /**
   * Update user (securely handles password)
   */
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

  /**
   * Delete user
   */
  async deleteUser(id: number): Promise<boolean> {
    const result = await this.userRepo.delete(id);
    return result.affected !== 0;
  }
}

export default UserService;
