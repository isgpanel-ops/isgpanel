// backend/services/db.js

let users = [];
let organizations = [];

module.exports = {
  async createOrganization(data) {
    const id = organizations.length + 1;
    const org = { id, ...data };
    organizations.push(org);
    return org;
  },

  async updateOrganization(id, updateData) {
    const index = organizations.findIndex(o => o.id === Number(id));
    if (index === -1) return null;
    organizations[index] = { ...organizations[index], ...updateData };
    return organizations[index];
  },

  async getOrganizationById(id) {
    return organizations.find(o => o.id === Number(id));
  },

  async createUser(data) {
    const id = users.length + 1;
    const user = { id, ...data };
    users.push(user);
    return user;
  },

  async countActiveUsers(orgId) {
    return users.filter(u => u.organizationId === Number(orgId)).length;
  },

  async updateUsersInOrg(orgId, updateData) {
    users = users.map(user =>
      user.organizationId === Number(orgId)
        ? { ...user, ...updateData }
        : user
    );
  },

  async _debugGetAll() {
    return { users, organizations };
  }
};
