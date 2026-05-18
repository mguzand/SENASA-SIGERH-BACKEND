import * as nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter;

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
    debug: true,
    logger: true,
  });
};
