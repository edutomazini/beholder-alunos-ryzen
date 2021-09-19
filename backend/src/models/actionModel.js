const Sequelize = require('sequelize');
const database = require('../db');
const OrderTemplateModel = require('./orderTemplateModel');

const ActionModel = database.define('action', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    automationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    orderTemplateId: Sequelize.INTEGER,
    type: {
        type: Sequelize.STRING,
        allowNull: false
    },
    createdAt: Sequelize.DATE,
    updatedAt: Sequelize.DATE
})

ActionModel.belongsTo(OrderTemplateModel, {
    foreignKey: 'orderTemplateId'
});

module.exports = ActionModel;