# TaskManagement Backend - Vercel Deployment Guide

Hướng dẫn deploy backend Express lên Vercel để chạy 24/7. Android app sẽ liên lạc với server này thay vì phải chạy `npm run server` locally.

---

## **📋 Yêu cầu**

- ✅ Tài khoản Vercel (free: https://vercel.com)
- ✅ Git repository (GitHub, GitLab, hoặc Bitbucket)
- ✅ CockroachDB Cloud connection string
- ✅ Database schema đã được init (chạy `db_start.sql` 1 lần)

---

## **🚀 Các bước deploy**

### **Bước 1: Chuẩn bị Git**

```bash
# 1. Đảm bảo folder runvercel có tất cả các file:
ls -la
# Phải có: server.js, db_start.sql, package.json, vercel.json, .env.example

# 2. Tạo .gitignore
echo "node_modules/" > .gitignore
echo ".env" >> .gitignore
echo "uploads/" >> .gitignore

# 3. Commit và push lên GitHub
git add .
git commit -m "Add Vercel backend deployment"
git push origin main
```

### **Bước 2: Setup Vercel Project**

1. **Truy cập** https://vercel.com/new
2. **Chọn** "Import Git Repository"
3. **Paste** URL repository GitHub của bạn
   - Ví dụ: `https://github.com/username/TaskManagement`
4. **Chọn** project root: `/runvercel`
5. **Click** "Deploy"

### **Bước 3: Thêm Environment Variables**

**Sau khi deploy xong, cập nhật biến môi trường:**

1. Truy cập Vercel Dashboard
2. Chọn project `TaskManagement`
3. Vào **Settings** → **Environment Variables**
4. **Thêm biến:**
   ```
   DATABASE_URL = postgresql://user:password@your_cluster.crdb.io:26257/taskmanagement?sslmode=require
   ```
   (Lấy connection string từ CockroachDB Cloud console)

5. **Redeploy** để áp dụng biến mới:
   - **Deployments** → **Redeploy** → **Show Build Logs**

---

## **⚙️ Cấu hình Android App**

### **Sửa API endpoint để gọi Vercel server:**

**File:** `src/services/api.ts`

```typescript
// ❌ OLD (localhost):
const BASE_URL = 'http://10.0.2.2:3000';

// ✅ NEW (Vercel URL):
const BASE_URL = 'https://your-project.vercel.app';
```

**Lấy URL Vercel:**
- Vercel Dashboard → Project → URL (ví dụ: `https://taskmanagement-backend-abc123.vercel.app`)

---

## **🔄 Database Initialization (First Time Only)**

**Phải chạy db_start.sql 1 lần duy nhất:**

### **Option 1: Dùng Beekeeper Studio (Recommend)**

1. **Connect** tới CockroachDB
2. **Mở** `db_start.sql` trong Beekeeper
3. **Chạy** toàn bộ script
4. ✅ Xong! Functions đã được tạo

### **Option 2: Command Line**

```bash
psql "postgresql://user:password@cluster.crdb.io:26257/taskmanagement?sslmode=require" < db_start.sql
```

---

## **✅ Kiểm tra Backend Hoạt Động**

### **1. Health Check**

```bash
# Mở browser hoặc curl:
curl https://your-project.vercel.app/api/health

# Response:
{"ok": true, "now": "2026-06-25T10:30:00.000Z"}
```

### **2. Xem Logs**

**Vercel Dashboard:**
- Chọn project
- **Deployments** → **Latest** → **Functions** → **server.js**
- Xem real-time logs

---

## **🗂️ Folder Structure**

```
runvercel/
├── server.js              # Express backend
├── db_start.sql           # Database schema & functions
├── package.json           # Vercel + dependencies
├── vercel.json            # Vercel config
├── .env.example           # Template environment variables
└── README.md              # Guide này
```

---

## **📝 Troubleshooting**

### **❌ "Missing DATABASE_URL"**
→ Kiểm tra **Settings** → **Environment Variables** đã add biến chưa

### **❌ "Connection refused"**
→ Kiểm tra DATABASE_URL connection string có đúng không
→ Confirm CockroachDB firewall cho phép Vercel IPs

### **❌ "Function not found"**
→ Kiểm tra `db_start.sql` đã chạy thành công chưa (bước 1)

### **❌ "CORS error" từ Android**
→ Vercel server đã set `cors()` middleware, không cần sửa

---

## **🔐 Security Notes**

⚠️ **PRODUCTION:**
- Thay đổi `fn_hash_password()` từ plain text → bcrypt (xem README chính)
- Add rate limiting vào routes
- Enable HTTPS (Vercel tự động)
- Backup CockroachDB định kỳ

---

## **📞 Lệnh Hữu Ích**

```bash
# Test kết nối database local
psql "postgresql://..." -c "SELECT * FROM users LIMIT 1;"

# Redeploy từ Vercel CLI
vercel deploy --prod

# Xem environment variables
vercel env list
```

---

## **✨ Lợi ích của phương án này**

✅ **24/7 Uptime:** Server luôn chạy, không cần `npm run server`
✅ **Free tier:** Vercel miễn phí cho ứng dụng Node.js
✅ **Auto scaling:** Xử lý nhiều request cùng lúc
✅ **Easy redeploy:** Chỉ cần `git push` → tự deploy
✅ **Production-ready:** Sẵn sàng cho production

---

## **🎉 Done!**

App sẽ kết nối tới: `https://your-project.vercel.app`

Không cần chạy `npm run server` nữa! 🚀
