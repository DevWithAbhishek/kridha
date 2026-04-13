// bcrypt for admin passwords — faster than argon2 for this use case.
// argon2 is used for user PINs (high-value, user-set secrets).
// Admin passwords are longer, stronger (enforced), and login is rate-limited
// to 2/min — bcrypt cost 12 is sufficient and much faster.

import bcrypt from "bcrypt";

const COST = 12;

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export async function verifyAdminPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
