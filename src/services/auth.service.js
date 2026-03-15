import { UserDB, Session } from '../data/db.js';

export const AuthService = {
  /**
   * Register a new user
   * @returns {object} user (without password)
   */
  register({ name, email, password }) {
    if (!name || !email || !password) throw new Error('All fields are required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    const user = UserDB.create({ name, email, password });
    const { password: _, ...safeUser } = user;
    Session.set(safeUser);
    return safeUser;
  },

  /**
   * Login an existing user
   */
  login({ email, password }) {
    const user = UserDB.getByEmail(email);
    if (!user) throw new Error('No account found with this email');
    if (user.password !== password) throw new Error('Incorrect password');
    const { password: _, ...safeUser } = user;
    Session.set(safeUser);
    return safeUser;
  },

  logout() {
    Session.clear();
  },

  currentUser() {
    return Session.get();
  },

  isLoggedIn() {
    return !!Session.get();
  },

  updateProfile(patch) {
    const current = Session.get();
    if (!current) throw new Error('Not logged in');
    const updated = UserDB.update(current.id, patch);
    const { password: _, ...safeUser } = updated;
    Session.set(safeUser);
    return safeUser;
  },
};
