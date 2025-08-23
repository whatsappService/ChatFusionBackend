const bcrypt = require("bcryptjs");
const { User } = require("../models/associations");
const { hashPassword } = require("../utils/hashUtil");

exports.getAllUsers = async () => {
  return await User.findAll();
};

exports.getUserById = async (id) => {
  return await User.findByPk(id);
};

exports.createUser = async (data) => {
  data.password = await hashPassword(data.password);
  return await User.create(data);
};

exports.updateUser = async (id, data) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error("User not found");

  if (data.password) {
    data.password = await hashPassword(data.password);
  }

  await user.update(data);
  return user;
};

exports.deleteUser = async (id) => {
  const user = await User.findByPk(id);
  if (!user) throw new Error("User not found");
  await user.destroy();
  return { message: "User deleted successfully" };
};

exports.updateProfile = async (userId, userData) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // Allow updating only specific fields
  const updatableFields = ["full_name", "email_address", "phone_number"];
  Object.keys(userData).forEach((key) => {
    if (updatableFields.includes(key)) {
      user[key] = userData[key];
    }
  });

  await user.save();

  return {
    id: user.id,
    full_name: user.full_name,
    email_address: user.email_address,
    phone_number: user.phone_number,
    roles: user.roles,
    is_active: user.is_active,
    is_deleted: user.is_deleted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

exports.changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    throw new Error("Old password is incorrect");
  }

  user.password = await hashPassword(newPassword);
  await user.save();
};
exports.verifyPassword = async (userId, password) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new Error("User not found");
  }

  return await bcrypt.compare(password, user.password);
};
