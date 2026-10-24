const Notification = require('../models/Notification');

let socketIOInstance = null;

const setSocketIO = (io) => {
  socketIOInstance = io;
};

/**
 * Creates a notification in MongoDB and emits it in real time via Socket.io if connected.
 */
const createNotification = async ({ recipient, type, title, message, data = {} }) => {
  try {
    const notification = await Notification.create({
      recipient,
      type,
      title,
      message,
      data,
    });

    if (socketIOInstance) {
      socketIOInstance.to(`user:${recipient.toString()}`).emit('notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

module.exports = {
  createNotification,
  setSocketIO,
};
