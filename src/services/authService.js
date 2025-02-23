const bcrypt = require("bcryptjs");
const { User, Business, BusinessCategory } = require("../models/associations");
const { generateTokens, verifyRefreshToken } = require("../utils/tokenUtil");

exports.login = async (email_address, password) => {
  const user = await User.findOne({
    where: { email_address },
    include: [
      {
        model: Business,
        as: "business",
        include: [{ model: BusinessCategory, as: "category" }],
      },
    ],
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid credentials");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email_address: user.email_address,
      phone_number: user.phone_number,
      roles: user.roles,
      is_active: user.is_active,
      is_deleted: user.is_deleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      business: user.business
        ? {
            id: user.business.id,
            business_name: user.business.business_name,
            business_phone_number: user.business.business_phone_number,
            email: user.business.email,
            api_key: user.business.api_key,
            is_active: user.business.is_active,
            is_deleted: user.business.is_deleted,
            category: user.business.category
              ? {
                  id: user.business.category.id,
                  category_name: user.business.category.category_name,
                }
              : null,
          }
        : null,
    },
  };
};

exports.register = async (userData) => {
  userData.password = await bcrypt.hash(userData.password, 10);
  const newUser = await User.create(userData);

  const business = await Business.findOne({
    where: { id: newUser.business_id },
    include: { model: BusinessCategory, as: "category" },
  });

  return {
    id: newUser.id,
    email_address: newUser.email_address,
    phone_number: newUser.phone_number,
    roles: newUser.roles,
    is_active: newUser.is_active,
    is_deleted: newUser.is_deleted,
    createdAt: newUser.createdAt,
    updatedAt: newUser.updatedAt,
    business,
  };
};

exports.refreshToken = async (refreshToken) => {
  if (!refreshToken) throw new Error("Refresh token required");

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findByPk(decoded.id);

    if (!user) throw new Error("User not found");

    return generateTokens(user);
  } catch (error) {
    throw new Error("Invalid or expired refresh token");
  }
};

exports.getAuthUser = async (userId) => {
  const user = await User.findOne({
    where: { id: userId },
    include: [
      {
        model: Business,
        as: "business",
        include: [{ model: BusinessCategory, as: "category" }],
      },
    ],
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Generate new tokens
  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      full_name: user.full_name,
      email_address: user.email_address,
      phone_number: user.phone_number,
      roles: user.roles,
      is_active: user.is_active,
      is_deleted: user.is_deleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      business: user.business
        ? {
            id: user.business.id,
            business_name: user.business.business_name,
            business_phone_number: user.business.business_phone_number,
            email: user.business.email,
            api_key: user.business.api_key,
            is_active: user.business.is_active,
            is_deleted: user.business.is_deleted,
            category: user.business.category
              ? {
                  id: user.business.category.id,
                  category_name: user.business.category.category_name,
                }
              : null,
          }
        : null,
    },
  };
};
