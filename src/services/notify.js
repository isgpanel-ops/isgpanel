async function notifyUser({ user, title, message }) {
  console.log("[NOTIFY_USER]", user?._id?.toString(), title, message);
}

module.exports = { notifyUser };
