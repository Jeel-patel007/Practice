const cron = require('node-cron');
const moment = require('moment');
const db = require('../models');
const generateCsv = require('../utils/csvGenerator');
const uploadCloudinary = require('./cloudinary');
const emailQueue = require('../services/emailQueue');
const { User, Notification, Medicine, Report, Mark_as_done_logs } = db;
const { Op } = require('sequelize');

const schedule = "0 0 * * 0";
const subject = "Health And Wellness Management Weekly Report";
const endDate = new Date();
const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const generateEmailContent = (notifications, uploadUrl) => {
  if (notifications.length === 0) {
    return `You have not added any email notifications this week. The system cannot generate your report. Please try our system to send reminders for your medicine.`;
  } else {
    return `<p>Hello, greetings from Health and Wellness Medicine.
      Here is your weekly report.<p>
      <a href="${uploadUrl}" class="text-xl w-28 h-40 bg-blue text-dark">Download Your Report</a>`;
  }
};

const transformNotifications = (notifications) => {
  return notifications.map(notification => ({
    First_Name: notification['markasdonelogs.medicine.User.first_name'],
    Last_Name: notification['markasdonelogs.medicine.User.last_name'],
    Medicine_Name: notification['markasdonelogs.medicine.medicine_name'],
    Description: notification['markasdonelogs.medicine.description'],
    Mark_As_Done: notification.mark_as_done,
    Type: notification['markasdonelogs.type'],
    Email: notification['markasdonelogs.email'],
    Time: notification['markasdonelogs.time'],
    Start_Date: moment(notification['markasdonelogs.start_date']).local().format('YYYY-MM-DD HH:mm:ss'),
    End_Date: moment(notification['markasdonelogs.end_date']).local().format('YYYY-MM-DD HH:mm:ss'),
    Created_At: moment(notification['markasdonelogs.createdAt']).local().format('YYYY-MM-DD HH:mm:ss')
  }));
};

const reportNotification = () => {
  cron.schedule(schedule, async () => {
    try {
      const users = await User.findAll({ raw: true });

      for (const user of users) {
        console.log("User ID:", user.id);
        try {
          const notifications = await Mark_as_done_logs.findAll({
            raw: true,
            include: {
              required: true,
              model: Notification,
              as: 'markasdonelogs',
              include: {
                required: true,
                attributes: ['medicine_name', 'description'],
                model: Medicine,
                as: 'medicine',
                include: {
                  attributes: ['first_name', 'last_name'],
                  model: User,
                  as: "User",
                  where: { id: user.id }
                }
              }
            },
            where: {
              createdAt: {
                [Op.between]: [startDate, endDate]
              }
            }
          });

          let html;
          if (notifications.length === 0) {
            html = generateEmailContent(notifications, null);
          } else {
            const transformedNotifications = transformNotifications(notifications);
            const file = generateCsv(transformedNotifications, Object.keys(transformedNotifications[0]), user.id);
            const upload = await uploadCloudinary(file);
            const result = await Report.create({
              user_id: user.id,
              reportfilepath: upload.url,
              fileoriginpath: file
            });
            if (!result) throw new Error("Something went wrong!");

            html = generateEmailContent(notifications, upload.url);
          }

          emailQueue.add("sendEmail", {
            email: user.email,
            subject,
            html
          });
          console.log(`Email added to queue for user: ${user.email}`);
        } catch (err) {
          console.error(`Error processing user ${user.id}:`, err);
        }
      }
    } catch (err) {
      console.error("Error in reportNotification:", err);
    }
  });
};

module.exports = reportNotification;
