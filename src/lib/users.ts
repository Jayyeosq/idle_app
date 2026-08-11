import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { readJSON, writeJSON } from "./storage";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  onboarded: boolean;
  createdAt: string;
};

type UsersFile = { users: User[] };

const USERS_FILE = "users.json";

async function loadUsers(): Promise<UsersFile> {
  return readJSON<UsersFile>(USERS_FILE, { users: [] });
}

async function saveUsers(data: UsersFile): Promise<void> {
  await writeJSON(USERS_FILE, data);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const { users } = await loadUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export async function findUserById(id: string): Promise<User | undefined> {
  const { users } = await loadUsers();
  return users.find((u) => u.id === id);
}

export async function createUser(email: string, password: string): Promise<User> {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error("An account with that email already exists.");
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: nanoid(12),
    email: email.toLowerCase(),
    passwordHash,
    onboarded: false,
    createdAt: new Date().toISOString(),
  };
  const data = await loadUsers();
  data.users.push(user);
  await saveUsers(data);
  return user;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.passwordHash);
}

export async function markOnboarded(userId: string): Promise<void> {
  const data = await loadUsers();
  const user = data.users.find((u) => u.id === userId);
  if (user) {
    user.onboarded = true;
    await saveUsers(data);
  }
}
