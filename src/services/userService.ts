import { AppDataSource } from "../config/data-source";
import { User } from "../entities/User";

export class UserService {
  private userRepo = AppDataSource.getRepository(User);

  /**
   * Create a new user
   */
  async createUser(data: Partial<User>): Promise<User> {
    const user = this.userRepo.create(data);
    return this.userRepo.save(user);
  }

  /**
   * Get a user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ["bookings", "bookings.event"], // fetch related bookings + events
    });
  }

  /**
   * Get a user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepo.find({
      relations: ["bookings"],
      order: { id: "ASC" },
    });
  }

  /**
   * Update user (e.g., role change)
   */
  async updateUser(id: number, updates: Partial<User>): Promise<User | null> {
    const user = await this.userRepo.findOneBy({ id });
    if (!user) return null;

    Object.assign(user, updates);
    return this.userRepo.save(user);
  }

  /**
   * Delete user
   */
  async deleteUser(id: number): Promise<boolean> {
    const result = await this.userRepo.delete(id);
    return result.affected !== 0;
  }
}
