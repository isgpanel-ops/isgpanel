async function notifyUser({ user, title, message }) {
  // Şimdilik sadece logluyoruz
  // İleride: mail, panel bildirimi, SMS vs bağlanır
  console.log("[NOTIFY_USER]", {
    userId: user?._id,
    email: user?.email,
    title,
    message,
  });
}

async function notifyOrgAdmins({ org, title, message }) {
  console.log("[NOTIFY_ORG]", {
    orgId: org?._id,
    title,
    message,
  });
}

module.exports = {
  notifyUser,
  notifyOrgAdmins,
};
