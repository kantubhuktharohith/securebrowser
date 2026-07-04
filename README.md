## 📘 SecureExam
## 🔒 Project Description
**SecureExam** is a secure, AI-powered online examination platform.  
It ensures **fair, authenticated, and reliable online exams** using advanced features such as:
- AI-based ID verification
- Hall ticket generation
- Secure exam session management
- Real-time monitoring

This project combines **modern web technologies** and **cloud deployment** to deliver a production-ready exam solution.
---

## 🚀 Features
- ✅ **Student Management** – Generate hall tickets, store student details.  
- ✅ **Identity Verification** – AI-powered ID verification with fallback to manual verification.  
- ✅ **Secure Login & JWT Authentication** – Admin & student sessions are protected.  
- ✅ **Exam Session Management** – Start, stop, and track exams securely.  
- ✅ **Cloud Database** – Scalable PostgreSQL (NeonDB).  
- ✅ **Deployment Ready** – Works seamlessly on Render.  

---

## 🛠️ Tech Stack
### **Frontend**
- React + TypeScript + Vite → Fast, modular, and modern UI.
- TailwindCSS → Clean & responsive design.

### **Backend**
- Node.js + Express → Handles API routes.
- Drizzle ORM + NeonDB (PostgreSQL) → Database management.
- JWT Authentication → Secure login sessions.

### **AI Integration**
- OpenAI API → Used for ID card verification.

---

## ⚙️ Installation

### A. Run Locally (VS Code)
1. Clone the repository:
   ```bash
   git clone https://github.com/kantubhuktharohith/secureexam.git
   cd secureexam
   ```

2. Install dependencies:
   ```bash
   npm install --include=dev
   ```

3. Setup your `.env` file in the project root:
   ```env
   ADMIN_EMAIL=your-admin-email
   ADMIN_PASSWORD_HASH=your-bcrypt-password-hash
   DATABASE_URL=your-neon-database-url
   JWT_SECRET=your-random-secret-key
   OPENAI_API_KEY=your-openai-api-key
   SESSION_SECRET=your-session-secret
   NODE_ENV=development
   ```
   🔑 **How to get these values:**
   - `DATABASE_URL` → From **Neon.tech** (create a PostgreSQL instance).  
   - `OPENAI_API_KEY` → From [OpenAI platform](https://platform.openai.com/).  
   - `JWT_SECRET` → Generate any random secure string.  
   - `SESSION_SECRET` → Another random secure string.  
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` → Define your admin login. (Use bcrypt to hash a password).  

4. Push database schema:
   ```bash
   npm run db:push -- --force
   ```
5. Start the app:
   ```bash
   npm start
   ```

6. Open in browser:
   ```
   http://localhost:3000
   ```

---

### B. Deploy on Render
1. Create a new **Web Service** on [Render](https://render.com).  
2. Connect your **GitHub repository**.  
3. Add **Environment Variables** in the Render dashboard (from `.env`).  
4. Set **Build Command**:
   ```bash
   npm install --include=dev && npm run db:push -- --force && npm run build
   ```
5. Set **Start Command**:
   ```bash
   npm start
   ```
6. Deploy 🎉 Your app will be live at:  
   ```
   https://<your-app-name>.onrender.com
   ```
---

## 📂 Project Structure
```
secureexam/
 ├── client/          # React frontend
 ├── server/          # Express backend
 ├── dist/            # Build output
 ├── prisma/          # Database schema
 ├── package.json
 ├── vite.config.ts
 └── .env.example     # Example environment variables
```

## ✅ Future Enhancements
- 🔹 Proctoring with webcam monitoring.  
- 🔹 AI-based cheating detection.  
- 🔹 Multiple exam formats (MCQ, coding, subjective).  
- 🔹 Analytics dashboard for exam results.  
---
## 👨‍💻 Author
Built with ❤️ by **Rohith**  
📧 Contact: [admin@secureexam.com](mailto:kantubhuktharohith@gmail.com)
