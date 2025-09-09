import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

type JwtPayload = {
  id: number;
  email: string;
  role: "admin" | "user";
};

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token missing" });
  }

  const token = authHeader.substring("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const authorizeRoles = (...allowedRoles: Array<"admin" | "user">) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
};

export const signJwtForUser = (payload: JwtPayload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
};


