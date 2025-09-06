"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    const sequelize = qi.sequelize;
    const t = await sequelize.transaction();
    const table = "MessageTemplates";

    try {
      // Does the table exist?
      const [exists] = await sequelize.query(
        "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        { replacements: [table], transaction: t }
      );

      if (!exists.length) {
        // CREATE fresh table with the new schema (❌ no placeholders column)
        await qi.createTable(
          table,
          {
            id: {
              type: Sequelize.INTEGER,
              autoIncrement: true,
              primaryKey: true,
            },

            // business-scoped (NULL = system template)
            business_id: {
              type: Sequelize.INTEGER,
              allowNull: true,
              references: { model: "Businesses", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            // required category
            category_id: {
              type: Sequelize.INTEGER,
              allowNull: false,
              references: { model: "BusinessCategories", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            // bilingual template names
            template_name_en: { type: Sequelize.STRING, allowNull: false },
            template_name_ar: { type: Sequelize.STRING, allowNull: false },

            // bilingual bodies
            message_en: { type: Sequelize.TEXT, allowNull: false },
            message_ar: { type: Sequelize.TEXT, allowNull: false },

            createdAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
            },
            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.literal(
                "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
              ),
            },
          },
          { transaction: t }
        );

        await qi.addIndex(table, ["business_id", "template_name_en"], {
          name: "ix_msgtpl_biz_name_en",
          transaction: t,
        });
      } else {
        // UPGRADE existing schema
        const desc = await qi.describeTable(table);

        // business_id
        if (!("business_id" in desc)) {
          await qi.addColumn(
            table,
            "business_id",
            {
              type: Sequelize.INTEGER,
              allowNull: true,
              references: { model: "Businesses", key: "id" },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },
            { transaction: t }
          );
        }

        // template_name_en
        if (!("template_name_en" in desc)) {
          await qi.addColumn(
            table,
            "template_name_en",
            { type: Sequelize.STRING, allowNull: true },
            { transaction: t }
          );

          if ("template_name" in desc) {
            await sequelize.query(
              "UPDATE `MessageTemplates` SET template_name_en = template_name WHERE template_name_en IS NULL",
              { transaction: t }
            );
          }
          await qi.changeColumn(
            table,
            "template_name_en",
            { type: Sequelize.STRING, allowNull: false },
            { transaction: t }
          );
        }

        // template_name_ar
        if (!("template_name_ar" in desc)) {
          await qi.addColumn(
            table,
            "template_name_ar",
            { type: Sequelize.STRING, allowNull: true },
            { transaction: t }
          );
          await sequelize.query(
            "UPDATE `MessageTemplates` SET template_name_ar = COALESCE(template_name_ar, template_name_en)",
            { transaction: t }
          );
          await qi.changeColumn(
            table,
            "template_name_ar",
            { type: Sequelize.STRING, allowNull: false },
            { transaction: t }
          );
        }

        // ❌ REMOVE placeholders if it exists (we're deprecating it)
        if ("placeholders" in desc) {
          await qi.removeColumn(table, "placeholders", { transaction: t });
        }

        // add index if missing
        const [idxRows] = await sequelize.query(
          "SHOW INDEX FROM `MessageTemplates` WHERE Key_name = 'ix_msgtpl_biz_name_en'",
          { transaction: t }
        );
        if (!idxRows.length) {
          await qi.addIndex(table, ["business_id", "template_name_en"], {
            name: "ix_msgtpl_biz_name_en",
            transaction: t,
          });
        }
      }

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const qi = queryInterface;
    const sequelize = qi.sequelize;
    const t = await sequelize.transaction();
    const table = "MessageTemplates";

    try {
      const [exists] = await sequelize.query(
        "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        { replacements: [table], transaction: t }
      );
      if (!exists.length) {
        await t.commit();
        return;
      }

      // best-effort revert: drop added index/columns
      await sequelize
        .query("DROP INDEX `ix_msgtpl_biz_name_en` ON `MessageTemplates`", {
          transaction: t,
        })
        .catch(() => {});

      const desc = await qi.describeTable(table);

      const dropIf = async (col) => {
        if (col in desc) {
          await qi.removeColumn(table, col, { transaction: t });
        }
      };

      // revert the bilingual/ownership additions
      await dropIf("template_name_ar");
      await dropIf("template_name_en");
      await dropIf("business_id");

      // (Optional) bring back placeholders if you want true rollback symmetry
      if (!("placeholders" in desc)) {
        await qi.addColumn(
          table,
          "placeholders",
          { type: Sequelize.JSON, allowNull: true, defaultValue: null },
          { transaction: t }
        );
      }

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
};
