import { GroupDB, UserDB } from '../data/db.js';

export const GroupService = {
  createGroup({ name, createdBy }) {
    if (!name || name.trim().length < 2) throw new Error('Group name must be at least 2 characters');
    return GroupDB.create({ name: name.trim(), createdBy });
  },

  getUserGroups(userId) {
    return GroupDB.forUser(userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getGroup(groupId) {
    return GroupDB.getById(groupId);
  },

  /** Invite by email — finds the user and adds them */
  inviteMemberByEmail(groupId, email) {
    const user = UserDB.getByEmail(email);
    if (!user) throw new Error(`No user found with email: ${email}`);
    const group = GroupDB.getById(groupId);
    if (!group) throw new Error('Group not found');
    if (group.members.includes(user.id)) throw new Error('User is already in this group');
    return GroupDB.addMember(groupId, user.id);
  },

  addMember(groupId, userId) {
    const group = GroupDB.getById(groupId);
    if (!group) throw new Error('Group not found');
    if (group.members.includes(userId)) throw new Error('User already in group');
    return GroupDB.addMember(groupId, userId);
  },

  removeMember(groupId, userId) {
    GroupDB.removeMember(groupId, userId);
  },

  getGroupMembers(groupId) {
    const group = GroupDB.getById(groupId);
    if (!group) return [];
    return group.members.map(id => UserDB.getById(id)).filter(Boolean);
  },

  deleteGroup(groupId, requesterId) {
    const group = GroupDB.getById(groupId);
    if (!group) throw new Error('Group not found');
    if (group.createdBy !== requesterId) throw new Error('Only the group creator can delete it');
    GroupDB.delete(groupId);
  },
};
