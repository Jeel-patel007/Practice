const moment = require("moment");
const emailQueue = require("../services/emailQueue");
const db = require("../models");
const { Notification, Medicine, Mark_as_done_logs } = db;

const generateDate = (date, time) => {
  let dateCurrent = moment(date);
  const [hours, minutes] = time.split(":");
  dateCurrent.set({
    hour: parseInt(hours, 10),
    minute: parseInt(minutes, 10),
    second: 0,
    millisecond: 0,
  });
  return dateCurrent;
};

const createEmailHtml = (medicineName, description, logId) => `
  <p>Hello, greetings from Health and Wellness Medicine.
  This is a reminder notification for your medicine.
  Medicine name: ${medicineName},
  Description: ${description || ''}<p>
  <a href="http://localhost:3000/h/done/${logId}" class="text-xl w-28 h-40 bg-blue text-dark">Mark As Done</a>
`;

const scheduleEmailReminder = async () => {
  try {
    console.log("******* Reminder Function Started **********");

    const notificationData = await Notification.findAll({
      include: {
        required: true,
        attributes: ['id', 'medicine_name', 'description'],
        model: Medicine,
        as: 'medicine',
      },
      where: { status: 0 },
    });

    console.log(notificationData);

    for (const notification of notificationData) {
      try {
        const subject = "Health And Wellness Medicine Notification";
        const current = moment();

        if (notification.type === "recurring") {
          if (current.isBetween(notification.start_date, notification.end_date)) {
            const currentDay = new Date().getDay();
            let currentDate = generateDate(new Date(), notification.time);
            let delayMinutes = currentDate.diff(current, 'minutes');
            let delaySeconds = currentDate.diff(current, 'seconds');
            console.log(delayMinutes);

            if (delayMinutes < 0) delayMinutes = 1;

            if ((notification.recurring_type === "weekly" && notification.day === currentDay && delayMinutes < 1 && delaySeconds < 30)) {
              const result = await Mark_as_done_logs.create({
                'notification_id': notification.id,
              });
              const html = createEmailHtml(notification.medicine.medicine_name, notification.medicine.description, result.id);
              emailQueue.add("sendEmail", {
                email: notification.email,
                subject,
                html,
              });
            }
          } else if (current.isAfter(notification.end_date)) {
            await Notification.update({ status: 1 }, { where: { id: notification.id } });
          }
        } else {
          let notificationDate = generateDate(notification.start_date, notification.time);
          if (notificationDate.diff(current, 'minutes') < 1 && notificationDate.diff(current, 'minutes') > -3) {
            const delay = notificationDate.diff(current);
            const result = await Mark_as_done_logs.create({
              'notification_id': notification.id,
            });
            const html = createEmailHtml(notification.medicine.medicine_name, notification.medicine.description, result.id);
            emailQueue.add(
              "sendEmail",
              { email: notification.email, subject, html },
              { delay },
            );
            await Notification.update({ status: 1 }, { where: { id: notification.id } });
            console.log("email added into queue one time ");
          }
        }
      } catch (err) {
        console.error(`Error processing notification ${notification.id}:`, err);
      }
    }

    console.log("***** Reminder Completed ****");
  } catch (error) {
    console.error("Error in scheduleEmailReminder:", error);
  }
};

module.exports = scheduleEmailReminder;
