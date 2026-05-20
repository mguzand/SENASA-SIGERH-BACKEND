import * as nodemailer from 'nodemailer';
import { sendMailTemplate } from '../mails/send-vacations.mail';

let transporter: nodemailer.Transporter;

export const sendVacations = async (
  to: string,
  subject: string,

  managerName: string,
  employeeName: string,
  dates: string,
  requestedDays: string,
  comment: string,
  approveUrl: string,
  rejectUrl: string,
) => {
  refreshTransporter();
  try {
    const response = await transporter.sendMail({
      subject,
      html: sendMailTemplate(
        managerName,
        employeeName,
        dates,
        requestedDays,
        comment,
        approveUrl,
        rejectUrl,
      ),
      from: `"EMPLEADOS SENASA" <${process.env.EMAIL_USER}>`,
      to,
    });
    return response;
  } catch (error) {
    console.log(error);
  }
};

const refreshTransporter = async () => {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    requireTLS: true,
    debug: false,
    logger: false,
  });
};
