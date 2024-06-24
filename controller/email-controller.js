import Email from "../model/email.js";
import Imap from "imap";
import { inspect } from "util";
import { simpleParser } from "mailparser";

// import NodeCache from 'node-cache';
// const emailCache = new NodeCache({ stdTTL: 600 }); // Cache items for 10 minutes

import dotenv from "dotenv";

dotenv.config();

const imapConfig = {
  user: process.env.USER,
  password: process.env.APP_PASSWORD,
  host: "imap.gmail.com",
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
};

const fetchEmails = () => {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);

    imap.once("ready", () => {
      imap.openBox("INBOX", false, () => {
        imap.search(["UNSEEN"], (err, results) => {
          if (err) {
            reject(err);
            return;
          }
          if (!results || !results.length) {
            resolve([]);
            imap.end();
            return;
          }

          const f = imap.fetch(results, { bodies: "" });
          const emails = [];

          f.on("message", (msg) => {
            msg.on("body", (stream) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  reject(err);
                  return;
                }
               

                const { from, subject, text, date ,messageId} = parsed;
                const emailData = {
                    // _id:messageId,
                    to: process.env.USER,
                    from: from.text,
                    subject,
                    body: text,
                    date: date || new Date(), // Use the parsed date or current date if not available
                    name: 'Smart Mail',
                    starred: false,
                    bin: false,
                    type: 'inbox'
                  };
                  
                  // emails.push(emailData);

                //   // Save email to database
                //   const email = new Email(emailData);
                //   await email.save();
                
                const existingEmail = await Email.findOne({
                    from: emailData.from,
                    subject: emailData.subject,
                    date: emailData.date
                  });
                  if (!existingEmail) {
                    // Save email to database if it doesn't already exist
                    const email = new Email(emailData);
                    await email.save();
                    emails.push(emailData);
                  }

                console.log(emails);
              });
            });
          });

          f.once("error", (ex) => reject(ex));
          f.once("end", () => {
            imap.end();
            resolve(emails);
          });
        });
      });
    });

    imap.once("error", (err) => reject(err));
    imap.once("end", () => console.log("Connection ended"));

    imap.connect();
  });
};

export const getEmails = async (request, response) => {
  try {
    let emails;

    if (request.params.type === "starred") {
      emails = await Email.find({ starred: true, bin: false });
    } else if (request.params.type === "bin") {
      emails = await Email.find({ bin: true });
    } else if (request.params.type === "allmail") {
      emails = await Email.find({}); // Get all emails
    } else if (request.params.type === "inbox") {
      try {
        // emails = await fetchEmails();

        const existingUnreadEmails = await Email.find({ type: "inbox", bin: false });
        const newEmails = await fetchEmails();
        // lastFetchTime = new Date(); // Update the last fetch time
        emails = [...existingUnreadEmails, ...newEmails];
      } catch (error) {
        return response.status(500).json(error.message);
      }
    } else {
      emails = await Email.find({ type: request.params.type });
    }

    response.status(200).json(emails);
  } catch (error) {
    response.status(500).json(error.message);
  }
};

export const saveSendEmails = async (request, response) => {
  try {
    const { name, date, from, to, body, subject,type } = request.body;

    if (!name || !date || !from || !to || !type || !subject) {
      return response.status(400).json({ message: "Missing required fields" });
    }

    const email = new Email({ name, date, from, to, body, subject, type });
    await email.save();


    response.status(200).json("Email saved successfully");
  } catch (error) {
    console.error("Error saving email:", error);
    response.status(500).json({ message: error.message });
  }
};

export const toggleStarredEmail = async (request, response) => {
  try {
    await Email.updateOne(
      { _id: request.body.id },
      { $set: { starred: request.body.value } }
    );
    response.status(201).json("Value is updated");
  } catch (error) {
    response.status(500).json(error.message);
  }
};

export const deleteEmails = async (request, response) => {
  try {
    await Email.deleteMany({ _id: { $in: request.body } });
    response.status(200).json("Emails deleted successfully");
  } catch (error) {
    response.status(500).json(error.message);
  }
};

export const moveEmailsToBin = async (request, response) => {
  try {
    await Email.updateMany(
      { _id: { $in: request.body } },
      { $set: { bin: true, starred: false, type: "" } }
    );
    response.status(200).json("Emails moved to bin");
  } catch (error) {
    response.status(500).json(error.message);
  }
};
