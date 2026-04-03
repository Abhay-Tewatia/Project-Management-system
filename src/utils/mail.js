// Import libraries
import Mailgen from "mailgen";        // Email template banane ke liye
import nodemailer from "nodemailer"; // Email send karne ke liye


/**
 * 📩 sendEmail Function
 * 👉 Ye function email send karta hai using Mailgen + Nodemailer
 */
const sendEmail = async (options) => {

    // 🔹 Mailgen initialize (email ka design/template)
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Task Manager", // App ka naam
            link: "https://taskmanagelink.com"
        }
    });

    // 🔹 Plain text version (fallback for old email clients)
    const emailText = mailGenerator.generatePlaintext(options.mailgenContent);

    // 🔹 HTML version (actual styled email)
    const emailHtml = mailGenerator.generate(options.mailgenContent);


    // 🔹 SMTP transporter (Mailtrap config)
    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,          // SMTP server
        port: Number(process.env.MAILTRAP_SMTP_PORT), // Port number
        secure: false, // Mailtrap ke liye false
        auth: {
            user: process.env.MAILTRAP_SMTP_USER, // Username
            pass: process.env.MAILTRAP_SMTP_PASS  // Password
        }
    });


    // 🔹 Email ka final object
    const mailOptions = {
        from: "mail.taskmanager@example.com", // Sender
        to: options.email,                    // Receiver
        subject: options.subject,             // Subject
        text: emailText,                      // Plain text
        html: emailHtml                       // HTML content
    };


    // 🔹 Email send karna
    try {
        const info = await transporter.sendMail(mailOptions);

        console.log("✅ Email sent successfully");
        console.log("Message ID:", info.messageId);

        return info; // Optional return
    } catch (error) {
        console.error("❌ Email sending failed");
        console.error(error);

        throw error; // Controller ko error bhejna
    }
};



/**
 * 📧 Email Verification Template
 * 👉 Ye function verification email ka content banata hai
 */
const emailVerificationMailgenContent = (username, verificationUrl) => {
    return {
        body: {
            name: username, // User ka naam
            intro: "Welcome! Please verify your email.",

            action: {
                instructions: "Click below to verify your email:",
                button: {
                    color: "#22BC66",
                    text: "Verify Email",
                    link: verificationUrl // Verification link
                }
            },

            outro: "Need help? Reply to this email."
        }
    };
};



/**
 * 🔐 Forgot Password Template
 * 👉 Ye function password reset email ka content banata hai
 */
const forgetPasswordMailgenContent = (username, resetUrl) => {
    return {
        body: {
            name: username,
            intro: "You requested a password reset.",

            action: {
                instructions: "Click below to reset password:",
                button: {
                    color: "#22BC66",
                    text: "Reset Password",
                    link: resetUrl // Reset link
                }
            },

            outro: "If not requested, ignore this email."
        }
    };
};


// Export functions
export {
    sendEmail,
    emailVerificationMailgenContent,
    forgetPasswordMailgenContent
};